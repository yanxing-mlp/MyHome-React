import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { resolveRecipeCover } from "@family-home/shared/image";
import {
  appendCartToOrder, createOrder, getCart, getOrder, listOnShelfRecipes, listPractices,
  type CartSnapshot, type PracticeGroup, type Recipe,
} from "../api/recipe";
import { ORDER_STATUS_PENDING, orderStatusLabel } from "../constants/orderStatus";
import { readAppendOrderId } from "../utils/orderActions";
import { startPolling } from "../utils/polling";
import { practiceSummary } from "../utils/practice";
import { ApiError } from "../utils/request";
import { DELETED_USER_NAME, useUserNames } from "../utils/userNames";
import "./OrderPage.css";
import "./OrderConfirmPage.css";

/** 确认页轮询整车；只提交所见版本，菜品快照仍由服务端权威生成。 */
export function OrderConfirmPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const appendOrderId = readAppendOrderId(location.state);
  const [snapshot, setSnapshot] = useState<CartSnapshot | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [practiceGroups, setPracticeGroups] = useState<PracticeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [targetStatus, setTargetStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const submittingRef = useRef(false);
  // 响应丢失时保留原版本；即使别人已开始下一车，重试也不能把下一车提交掉。
  const attempt = useRef<CartSnapshot | null>(null);
  const generation = useRef(0);
  const alive = useRef(false);
  const userNames = useUserNames();

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    Promise.all([listOnShelfRecipes(), listPractices()])
      .then(([list, groups]) => {
        if (cancelled) return;
        setRecipes(list);
        setPracticeGroups(groups);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      alive.current = false;
      generation.current += 1;
    };
  }, []);

  useEffect(() => {
    attempt.current = null;
    submittingRef.current = false;
    setSnapshot(null);
    setTargetStatus(null);
    setRetrying(false);
    setSubmitting(false);
    setErrorMsg("");
    setSyncError("");
    return () => { generation.current += 1; };
  }, [appendOrderId]);

  useEffect(() => startPolling(async (isCurrent) => {
    if (submittingRef.current) return;
    const before = generation.current;
    try {
      const [cart, target] = await Promise.all([
        getCart(), appendOrderId === null ? Promise.resolve(null) : getOrder(appendOrderId),
      ]);
      if (!isCurrent() || before !== generation.current) return;
      // 未知提交结果尚未确认时仍轮询，但不能替换屏幕上的原提交内容。
      if (!attempt.current) {
        setSnapshot((previous) => !previous || cart.version >= previous.version ? cart : previous);
      }
      setTargetStatus(target?.status ?? null);
      setSyncError("");
    } catch (e) {
      if (isCurrent() && before === generation.current) {
        setSyncError(e instanceof Error ? e.message : "购物车刷新失败");
      }
    }
  }), [appendOrderId, refreshKey]);

  const rows = useMemo(() => {
    const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
    return (snapshot?.items ?? []).map((item) => ({
      ...item,
      name: byId.get(item.recipeId)?.name ?? "已下架菜品",
      coverUrl: byId.get(item.recipeId)?.coverUrl,
    }));
  }, [snapshot, recipes]);
  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
  /**
   * 与购物车抽屉同一口径：按加购人分模块，一个人一个模块，模块内保持原有行顺序，
   * 模块顺序 = 这个人第一道菜出现的顺序。
   * `creatorId` 为 NULL 或字典未到时 label 为 null，模块头整块不渲染。
   */
  const rowGroups = useMemo(() => {
    const groups = new Map<string, { label: string | null; items: typeof rows }>();
    for (const row of rows) {
      const key = row.creatorId == null ? "none" : `u${row.creatorId}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          label:
            row.creatorId != null && userNames
              ? userNames.get(row.creatorId) ?? DELETED_USER_NAME
              : null,
          items: [],
        };
        groups.set(key, group);
      }
      group.items.push(row);
    }
    return Array.from(groups.values());
  }, [rows, userNames]);
  const targetBlocked = appendOrderId !== null && targetStatus !== ORDER_STATUS_PENDING;
  const disabled = submitting || (!retrying && (!snapshot || rows.length === 0 || !!syncError || targetBlocked));

  const handleSubmit = async () => {
    if (submittingRef.current || disabled || !snapshot) return;
    const submitted = attempt.current ?? snapshot;
    attempt.current = submitted;
    submittingRef.current = true;
    const before = ++generation.current;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const orderId = appendOrderId === null
        ? await createOrder(submitted.version)
        : await appendCartToOrder(appendOrderId, submitted.version).then(() => appendOrderId);
      if (alive.current && before === generation.current) {
        navigate(`/recipe/orders/${orderId}`, { replace: true });
      }
    } catch (e) {
      if (!alive.current || before !== generation.current) return;
      const rejected = e instanceof ApiError && e.status >= 400 && e.status < 500;
      if (rejected) {
        attempt.current = null;
        setRetrying(false);
        setSyncError("正在刷新购物车…");
        setRefreshKey((key) => key + 1);
        setErrorMsg(e.message);
      } else {
        setRetrying(true);
        setErrorMsg("暂未确认下单结果，请重试确认，不会重复下单");
      }
    } finally {
      if (alive.current && before === generation.current) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  };

  const backToMenu = () => navigate("/recipe/order", {
    state: appendOrderId === null ? null : { appendOrderId },
  });
  const submitText = submitting
    ? (appendOrderId === null ? "下单中…" : "加入中…")
    : retrying ? "重试确认" : appendOrderId === null ? "下单" : `加入订单 #${appendOrderId}`;

  if (loading || (!snapshot && !syncError)) {
    return <div className="fh-order"><div className="fh-order__state">加载中…</div></div>;
  }
  if (loadError) {
    return (
      <div className="fh-order"><div className="fh-order__state">
        <p>{loadError}</p>
        <button type="button" className="fh-order__retry" onClick={() => window.location.reload()}>重新加载</button>
      </div></div>
    );
  }

  return (
    <div className="fh-order">
      <header className="fh-order__header">
        <button type="button" className="fh-order__back" disabled={submitting} onClick={backToMenu}>‹</button>
        <h1 className="fh-order__title">确认订单</h1>
        {rows.length > 0 && <span className="fh-confirm__count">共点 {totalQty} 份</span>}
      </header>
      {rows.length === 0 ? (
        <div className="fh-order__state">
          <p>{syncError || "购物车是空的，先去点两个菜吧"}</p>
          <button type="button" className="fh-order__retry" onClick={backToMenu}>返回点餐</button>
        </div>
      ) : (
        <main className="fh-confirm__list">
          {rowGroups.map((group, groupIndex) => (
            <div key={group.label ?? `group-${groupIndex}`} className="fh-confirm__group">
              {group.label && (
                <div className="fh-confirm__creator">
                  <span>{group.label}</span>
                  <span className="fh-confirm__creator-count">
                    {group.items.reduce((sum, row) => sum + row.qty, 0)} 份
                  </span>
                </div>
              )}
              {group.items.map((row) => (
                <div key={row.recipeId} className="fh-confirm__item">
                  <img className="fh-thumb" src={resolveRecipeCover(row.coverUrl)} alt="" />
                  <div className="fh-confirm__info">
                    <div className="fh-confirm__name">{row.name}</div>
                    {(row.practices?.length ?? 0) > 0 && (
                      <div className="fh-confirm__practices">{practiceSummary(practiceGroups, row.practices ?? [])}</div>
                    )}
                  </div>
                  <span className="fh-confirm__qty">×{row.qty}</span>
                </div>
              ))}
            </div>
          ))}
        </main>
      )}
      {(rows.length > 0 || errorMsg) && (
        <footer className="fh-confirm__footer">
          {(errorMsg || syncError) && <div className="fh-confirm__error">{errorMsg || syncError}</div>}
          {!retrying && targetBlocked && targetStatus && (
            <div className="fh-confirm__error">订单{orderStatusLabel(targetStatus)}，不能继续加菜</div>
          )}
          {rows.length > 0 && (
            <button type="button" className="fh-confirm__submit" disabled={disabled} onClick={() => void handleSubmit()}>
              {submitText}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
