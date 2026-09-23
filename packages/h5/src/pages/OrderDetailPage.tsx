import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { resolveRecipeCover } from "@family-home/shared/image";
import {
  getOrder,
  listPractices,
  type Order,
  type PracticeGroup,
} from "../api/recipe";
import {
  ORDER_STATUS_CANCELLED,
  ORDER_STATUS_COMPLETED,
  ORDER_STATUS_PENDING,
  orderStatusLabel,
} from "../constants/orderStatus";
import { useOrderActions } from "../utils/orderActions";
import { practiceSummary } from "../utils/practice";
import { formatOrderTime } from "../utils/time";
import { DELETED_USER_NAME, useUserNames } from "../utils/userNames";
import { useToast } from "../utils/toast";
import { startPolling } from "../utils/polling";
import { ApiError } from "../utils/request";
import "./OrderPage.css";
import "./OrderDetailPage.css";

/**
 * C 端订单详情页。
 *
 * 明细里的菜名、封面图和做法都是下单时的快照，所以菜品之后改名、换图、下架、删除都照样能看清
 * 当时点了什么；做法选项若已从字典里删掉，摘要会跳过它（与购物车摘要同一口径）。
 * 每行行首一张封面小图，快照里没图（这道菜当时没图，或这单早于封面快照字段）就不渲染占位。
 * 摘要条那一行带上下单人：订单只存 creator_id，昵称现查账号字典（见 utils/userNames），查不到就不显示。
 * 底部操作与列表卡片同一套（见 utils/orderActions）：待制作给「继续加菜」＋「取消订单」＋「已完成」，
 * 已完成/已取消只给「再来一单」。确认页下单后也直接落到这一页。
 */
export function OrderDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [practiceGroups, setPracticeGroups] = useState<PracticeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const generation = useRef(0);
  const acting = useRef(false);
  const names = useUserNames();
  const { toast, showToast } = useToast();
  const { busyId, complete, cancel, reorder, addMore } = useOrderActions(showToast);

  /** null = 不显示（这单没记添加人，或账号字典还没到） */
  const creatorName =
    order?.creatorId == null || !names
      ? null
      : names.get(order.creatorId) ?? DELETED_USER_NAME;

  useEffect(() => {
    let active = true;
    acting.current = false;
    setOrder(null);
    setLoading(true);
    setLoadError("");
    setSyncError("");
    listPractices().then((groups) => {
      if (active) setPracticeGroups(groups);
    }).catch(() => undefined);
    return () => { active = false; generation.current += 1; };
  }, [id]);

  useEffect(() => {
    const orderId = Number(id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      setLoadError("订单不存在");
      setLoading(false);
      return;
    }
    return startPolling(async (isCurrent) => {
      if (acting.current) return;
      const before = generation.current;
      try {
        const data = await getOrder(orderId);
        if (!isCurrent() || before !== generation.current) return;
        setOrder(data);
        setLoadError("");
        setSyncError("");
      } catch (e) {
        if (!isCurrent() || before !== generation.current) return;
        const message = e instanceof Error ? e.message : "订单刷新失败";
        setSyncError(message);
        if (e instanceof ApiError && e.status === 404) {
          setOrder(null);
          setLoadError(message);
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    });
  }, [id, refreshKey]);

  if (loading) {
    return (
      <div className="fh-order">
        <div className="fh-order__state">加载中…</div>
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className="fh-order">
        <header className="fh-order__header">
          <button
            type="button"
            className="fh-order__back"
            onClick={() => navigate("/recipe/orders")}
          >
            ‹
          </button>
          <h1 className="fh-order__title">订单详情</h1>
        </header>
        <div className="fh-order__state">
          <p>{loadError || syncError}</p>
          <button
            type="button"
            className="fh-order__retry"
            onClick={() => navigate("/recipe/orders")}
          >
            返回订单列表
          </button>
        </div>
      </div>
    );
  }

  /** 操作前使旧轮询失效；结果回显后重读，份数和其它端的最终状态也一起同步。 */
  const applyStatus = (status: string, run: (id: number) => Promise<boolean>) => {
    if (acting.current) return;
    acting.current = true;
    const before = ++generation.current;
    void run(order.id).then((ok) => {
      if (before !== generation.current) return;
      if (ok) setOrder((prev) => (prev ? { ...prev, status } : prev));
      setRefreshKey((key) => key + 1);
    }).finally(() => {
      if (before === generation.current) acting.current = false;
    });
  };

  return (
    <div className="fh-order">
      <header className="fh-order__header">
        <button
          type="button"
          className="fh-order__back"
          onClick={() => navigate("/recipe/orders")}
        >
          ‹
        </button>
        <h1 className="fh-order__title">订单详情</h1>
        <span className="fh-order-detail__count">共 {order.totalQty} 份</span>
      </header>

      <div className="fh-order-detail__meta">
        <span className="fh-order-detail__status">{orderStatusLabel(order.status)}</span>
        <span className="fh-order-detail__time">
          {/* 下单人接在时间前面（"大宝 · 09-21 12:00 下单"）；查不到名字时整段前缀不出现，
              和列表页同一口径：不拿"未知"占位 */}
          {creatorName && `${creatorName} · `}
          {formatOrderTime(order.createTime, true)} 下单
        </span>
        {/* 订单号就是 recipe_order.id：B 端点单列表那一列叫「订单号」显示的也是它，
            两端同一个数才对得上，所以不另造一个业务单号字段 */}
        <span className="fh-order-detail__no">订单号 #{order.id}</span>
      </div>

      <main className="fh-order-detail__list">
        {order.items.map((item) => {
          const practices = item.practices ?? [];
          return (
            <div key={item.recipeId} className="fh-order-detail__item">
              <img className="fh-thumb" src={resolveRecipeCover(item.coverUrl)} alt="" />
              <div className="fh-order-detail__info">
                <div className="fh-order-detail__name">{item.recipeName}</div>
                {practices.length > 0 && (
                  <div className="fh-order-detail__practices">
                    {practiceSummary(practiceGroups, practices)}
                  </div>
                )}
              </div>
              <span className="fh-order-detail__qty">×{item.qty}</span>
            </div>
          );
        })}
      </main>

      {syncError && <div role="alert" className="fh-order-detail__error">{syncError}</div>}
      <footer className="fh-order-actions fh-order-detail__actions">
        {/* C 端只给往前走的方向：待制作才给「继续加菜」「取消订单」「已完成」，
            完成/取消之后这一单就定稿了，只剩「再来一单」（复制成购物车内容，仍要再走一次确认页） */}
        {order.status === ORDER_STATUS_PENDING ? (
          <>
            <button
              type="button"
              className="fh-order-actions__btn"
              disabled={busyId !== null || !!syncError}
              onClick={() => addMore(order.id)}
            >
              继续加菜
            </button>
            <button
              type="button"
              className="fh-order-actions__btn"
              disabled={busyId !== null || !!syncError}
              onClick={() => applyStatus(ORDER_STATUS_CANCELLED, cancel)}
            >
              取消订单
            </button>
            <button
              type="button"
              className="fh-order-actions__btn fh-order-actions__btn--primary"
              disabled={busyId !== null || !!syncError}
              onClick={() => applyStatus(ORDER_STATUS_COMPLETED, complete)}
            >
              已完成
            </button>
          </>
        ) : (
          <button
            type="button"
            className="fh-order-actions__btn"
            disabled={busyId !== null || !!syncError}
            onClick={() => void reorder(order.id, order.items.length)}
          >
            再来一单
          </button>
        )}
      </footer>

      {toast && <div className="fh-order__toast">{toast}</div>}
    </div>
  );
}
