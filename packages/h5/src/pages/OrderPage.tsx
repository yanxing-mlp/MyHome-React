import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { resolveRecipeCover } from "@family-home/shared/image";
import {
  clearCart,
  listCategories,
  listOnShelfRecipes,
  listOrderStatistics,
  listPractices,
  setCartItem,
  type CartPractice,
  type PracticeGroup,
  type Recipe,
  type RecipePracticeGroup,
  type RecipeCategory,
} from "../api/recipe";
import { readAppendOrderId } from "../utils/orderActions";
import { practiceSummary as summarizePractices } from "../utils/practice";
import { useToast } from "../utils/toast";
import { useSharedCart } from "../utils/useSharedCart";
import { DELETED_USER_NAME, useUserNames } from "../utils/userNames";
import "./OrderPage.css";

/** 未分类兜底分区的 key（分类被删除的菜品会落到这里，如当前的南昌拌粉） */
const OTHER_KEY = "__other__";

/** 购物车一行：数量 + 所选做法（一菜一行，做法随行覆盖保存） */
interface CartRow {
  qty: number;
  practices: CartPractice[];
  /** 加购人 ID */
  creatorId?: number | null;
}

/** 菜品列表一排放几列 */
type DishColumns = 1 | 2 | 3;

/**
 * 列数选择存本机：这是"这台手机看着舒不舒服"的偏好，不是家庭共享数据，
 * 所以不落后端、不占接口（购物车那种全家共用的才进库）。
 */
const COLUMNS_KEY = "recipe-order-columns";

const COLUMN_OPTIONS: DishColumns[] = [1, 2, 3];

/** 只认 1/2/3，存过别的（或没存过）都回到默认的 1 列 */
function readStoredColumns(): DishColumns {
  const raw = window.localStorage.getItem(COLUMNS_KEY);
  return raw === "2" || raw === "3" ? (Number(raw) as DishColumns) : 1;
}

/**
 * C 端点餐页（参考门店小程序点餐布局）。
 *
 * 左侧分类栏 + 右侧菜品列表 + 底部购物车栏 + 菜品详情浮层。
 * 右侧一次性展示所有菜品（按分类分区 + 未分类兜底），
 * 左栏点击滚动定位、列表滚动反向联动高亮。
 * 顶栏右上角可切 1/2/3 列：1 列是横向行卡（封面在左），2/3 列同一份数据换竖卡
 * （上图下名、藏掉描述），只换排布不改数据，选择记本机。
 * 加购数量落在后端 recipe_cart_item 表（家庭共用单车），页面乐观更新、失败回滚。
 * 卡片上的 + 只给"没做法可挑"的菜直接加购；绑了做法分组的菜必须先开详情浮层挑完做法再加
 * （浮层内仍只强制必选组）。
 * 菜品卡片左下角显示"点过 x 次"，x 取点单统计的累计下单份数（口径见 orderCounts）。
 * 底部车栏的已选菜品抽屉每行带一张小封面图（这道菜没图就不占位）。
 * 下单入口只有底部车栏那一个（跳确认订单页）；菜品详情浮层只做加购。
 * 从待制作订单点「继续加菜」进来时，车栏按钮变成"加入订单 #x"，下单会并进那一单而不是新建。
 */
export function OrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  /** 当前定位分区（分类 id 字符串或 OTHER_KEY） */
  const [activeSection, setActiveSection] = useState("");
  /** 菜品列表列数（本机偏好，进页面从 localStorage 读） */
  const [columns, setColumns] = useState<DishColumns>(readStoredColumns);
  /**
   * recipeId -> 累计下单份数，卡片上显示成"点过 x 次"。
   * 口径是与 B 端点单统计同一个 SUM(qty)；一份菜点 3 份算 3，不是一单算一次。
   */
  const [orderCounts, setOrderCounts] = useState<Map<number, number>>(
    new Map(),
  );
  const [cartOpen, setCartOpen] = useState(false);
  /** 非 null 时展示菜品详情浮层 */
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  /** 做法字典（全部分组 + 选项，后端已排好序） */
  const [practiceGroups, setPracticeGroups] = useState<PracticeGroup[]>([]);
  /** 详情浮层里的做法选中态：groupId -> optionId */
  const [detailPicks, setDetailPicks] = useState<Map<number, number>>(new Map());
  const { toast, showToast } = useToast();
  const { snapshot, loading: cartLoading, error: cartError, busy: cartBusy, mutate } = useSharedCart(showToast);
  const userNames = useUserNames();
  const cart = useMemo(() => new Map<number, CartRow>(
    (snapshot?.items ?? []).map((item) => [item.recipeId, {
      qty: item.qty, practices: item.practices ?? [], creatorId: item.creatorId,
    }]),
  ), [snapshot]);
  const cartUnavailable = cartBusy || !!cartError || !snapshot;
  /**
   * 「继续加菜」的目标订单（订单页经路由 state 带过来，这里只是读出来换个按钮文案、
   * 再原样传给确认页）。null 就是普通点餐，下单新建一单。
   */
  const appendOrderId = readAppendOrderId(location.state);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listCategories(), listOnShelfRecipes(), listPractices()])
      .then(([cats, list, groups]) => {
        if (cancelled) return;
        setCategories(cats);
        setRecipes(list);
        setPracticeGroups(groups);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // "点过 x 次"是纯展示信息，单独发、失败就整块不显示：
    // 混进上面那个 Promise.all 会让统计接口一挂就整个点餐页打不开。
    listOrderStatistics()
      .then((stats) => {
        if (cancelled) return;
        setOrderCounts(new Map(stats.map((s) => [s.recipeId, s.totalQty])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 「再来一单」跳回来时带的一句话（router 的 location.state，一次性）。
   * 展示完立刻把 state 清掉，否则用户在点餐页刷新一下会再弹一次。
   */
  const reorderNotice = (location.state as { reorderNotice?: string } | null)
    ?.reorderNotice;
  useEffect(() => {
    if (!reorderNotice) return;
    showToast(reorderNotice);
    navigate(location.pathname, { replace: true, state: null });
  }, [reorderNotice, showToast, navigate, location.pathname]);

  /** 全量菜品按分类分区连续展示；挂不到现存分类的菜落进"未分类"兜底分区 */
  const sections = useMemo(() => {
    const known = new Set(categories.map((c) => String(c.id)));
    const list = categories
      .map((c) => ({
        key: String(c.id),
        title: c.name,
        dishes: recipes.filter((r) => r.categoryId === c.id),
      }))
      .filter((s) => s.dishes.length > 0);
    const others = recipes.filter(
      (r) => r.categoryId == null || !known.has(String(r.categoryId)),
    );
    if (others.length > 0) {
      list.push({ key: OTHER_KEY, title: "未分类", dishes: others });
    }
    return list;
  }, [categories, recipes]);

  const listRef = useRef<HTMLElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  /** 点击定位的平滑滚动期间暂停反向联动，避免高亮来回跳 */
  const suppressSpy = useRef(false);
  const spyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** 高亮始终指向一个真实存在的分区 */
  useEffect(() => {
    if (sections.length === 0) return;
    if (!sections.some((s) => s.key === activeSection)) {
      setActiveSection(sections[0].key);
    }
  }, [sections, activeSection]);

  /** 左栏点击 → 右侧滚动定位到分区 */
  const goSection = useCallback((key: string) => {
    const container = listRef.current;
    const el = sectionRefs.current.get(key);
    if (!container || !el) return;
    setActiveSection(key);
    suppressSpy.current = true;
    if (spyTimer.current) clearTimeout(spyTimer.current);
    spyTimer.current = setTimeout(() => {
      suppressSpy.current = false;
    }, 500);
    const top =
      el.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    container.scrollTo({ top, behavior: "smooth" });
  }, []);

  /** 切列数：改内存 state + 记本机，列表只是换排布，不重新请求数据 */
  const selectColumns = useCallback((next: DishColumns) => {
    setColumns(next);
    window.localStorage.setItem(COLUMNS_KEY, String(next));
  }, []);

  /** 右侧滚动 → 高亮跟随滚到的分区；滚到底时强制点亮最后一个分区 */
  const handleListScroll = useCallback(() => {
    if (suppressSpy.current) return;
    const container = listRef.current;
    if (!container || sections.length === 0) return;
    if (
      container.scrollTop + container.clientHeight >=
      container.scrollHeight - 2
    ) {
      setActiveSection(sections[sections.length - 1].key);
      return;
    }
    const cTop = container.getBoundingClientRect().top;
    let current = sections[0].key;
    for (const s of sections) {
      const el = sectionRefs.current.get(s.key);
      if (el && el.getBoundingClientRect().top - cTop <= 4) {
        current = s.key;
      } else {
        break;
      }
    }
    setActiveSection(current);
  }, [sections]);

  const recipeById = useMemo(() => {
    const map = new Map<number, Recipe>();
    recipes.forEach((r) => map.set(r.id, r));
    return map;
  }, [recipes]);

  /** 菜品的默认做法选择：每个绑定的分组取它配置的默认选项；没配或选项已被删 = 不预选 */
  const defaultPractices = useCallback(
    (recipe: Recipe): CartPractice[] => {
      const picks: CartPractice[] = [];
      (recipe.practiceGroups ?? []).forEach((bound) => {
        const optionId = bound.defaultOptionId;
        if (optionId == null) return;
        const hit = practiceGroups
          .find((g) => g.id === bound.groupId)
          ?.options.find((o) => o.id === optionId);
        if (hit) picks.push({ groupId: bound.groupId, optionId: hit.id });
      });
      return picks;
    },
    [practiceGroups],
  );

  /**
   * 有没有"能挑做法"的分组（绑了、字典里还在、组内有选项）：有就不让卡片上的 +
   * 直接加购——加出去是一条没挑做法的行——改成先打开详情浮层挑完再加。
   * 浮层里仍然只强制必选组，非必选组可以不挑。
   * 组内没选项的分组不算：详情浮层压根不展示它，拦了等于白拦。
   */
  const needsPracticeChoice = useCallback(
    (recipe: Recipe): boolean =>
      (recipe.practiceGroups ?? []).some((bound) => {
        const group = practiceGroups.find((g) => g.id === bound.groupId);
        return group != null && group.options.length > 0;
      }),
    [practiceGroups],
  );

  /** 乐观回显；写入携带所见版本，冲突只回读、不重放绝对值。 */
  const setQty = useCallback(
    (id: number, qty: number, practices?: CartPractice[]) => {
      if (cartUnavailable) return;
      const effective = practices ?? cart.get(id)?.practices ?? [];
      void mutate(
        (version) => setCartItem(version, id, qty, effective),
        (previous) => {
          const items = previous.items.filter((item) => item.recipeId !== id);
          if (qty > 0) {
            const index = previous.items.findIndex((item) => item.recipeId === id);
            items.splice(index < 0 ? items.length : index, 0, { recipeId: id, qty, practices: effective });
          }
          return { ...previous, items };
        },
      );
    },
    [cartUnavailable, cart, mutate],
  );

  const totalQty = useMemo(() => {
    let sum = 0;
    cart.forEach((row) => {
      sum += row.qty;
    });
    return sum;
  }, [cart]);

  const openDetail = useCallback(
    (dish: Recipe) => {
      setDetailRecipe(dish);
      // 已加购的行回显已存做法，未加购的按菜品配置的默认选项预选
      const saved = cart.get(dish.id)?.practices ?? [];
      const source = saved.length > 0 ? saved : defaultPractices(dish);
      setDetailPicks(new Map(source.map((p) => [p.groupId, p.optionId])));
    },
    [cart, defaultPractices],
  );

  /** 详情浮层要展示的做法分组：绑定了、字典里还在、组内有选项（配置顺序即展示顺序） */
  const detailPracticeGroups = useMemo(() => {
    if (!detailRecipe) return [];
    return (detailRecipe.practiceGroups ?? [])
      .map((bound) => ({
        bound,
        group: practiceGroups.find((g) => g.id === bound.groupId),
      }))
      .filter(
        (x): x is { bound: RecipePracticeGroup; group: PracticeGroup } =>
          x.group != null && x.group.options.length > 0,
      );
  }, [detailRecipe, practiceGroups]);

  /** 必选分组还没挑做法：加入购物车先禁用，别等提交才报错 */
  const missingRequiredPractice = detailPracticeGroups.some(
    ({ bound }) => bound.required === true && !detailPicks.has(bound.groupId),
  );

  /**
   * 详情浮层点选做法：该行已在购物车则同步落库，未加购只更新选中态。
   * 再点一次已选中的选项 = 取消该组的做法，但必选分组不给取消（点了没反应）。
   */
  const handlePick = useCallback(
    (groupId: number, optionId: number) => {
      const next = new Map(detailPicks);
      const deselect =
        !detailPracticeGroups.some(
          (x) => x.group.id === groupId && x.bound.required === true,
        ) && next.get(groupId) === optionId;
      if (deselect) {
        next.delete(groupId);
      } else {
        next.set(groupId, optionId);
      }
      setDetailPicks(next);
      if (detailRecipe) {
        const row = cart.get(detailRecipe.id);
        if (row) {
          setQty(
            detailRecipe.id,
            row.qty,
            Array.from(next.entries()).map(([g, o]) => ({ groupId: g, optionId: o })),
          );
        }
      }
    },
    [detailPicks, detailPracticeGroups, detailRecipe, cart, setQty],
  );

  /** 做法选择 -> 选项名摘要（与确认订单页共用工具函数） */
  const practiceSummary = useCallback(
    (list: CartPractice[]) => summarizePractices(practiceGroups, list),
    [practiceGroups],
  );

  /** 购物车里按加入顺序展示（Map 保持插入序）；被清空分类后仍保留已加购的菜 */
  const cartItems = useMemo(
    () =>
      Array.from(cart.entries())
        .map(([id, row]) => ({ recipe: recipeById.get(id), ...row }))
        .filter(
          (item): item is { recipe: Recipe; qty: number; practices: CartPractice[]; creatorId?: number | null } =>
            item.recipe != null,
        ),
    [cart, recipeById],
  );

  /**
   * 购物车按加购人分模块：一个人的菜集中在一个模块里，组内保持加菜顺序，
   * 组顺序 = 这个人第一道菜出现的顺序。
   * 标题为空的两种情况都刻意不渲染：`creatorId` 为 NULL（历史数据/无身份加购），
   * 以及用户字典还没到（避免"已删除账号"先闪一下）。
   */
  const cartGroups = useMemo(() => {
    const groups = new Map<string, { label: string | null; items: typeof cartItems }>();
    for (const item of cartItems) {
      const key = item.creatorId == null ? "none" : `u${item.creatorId}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          label:
            item.creatorId != null && userNames
              ? userNames.get(item.creatorId) ?? DELETED_USER_NAME
              : null,
          items: [],
        };
        groups.set(key, group);
      }
      group.items.push(item);
    }
    return Array.from(groups.values());
  }, [cartItems, userNames]);

  /** 详情浮层当前做法选中的数组形态（加购/改量请求用） */
  const detailPicksPayload: CartPractice[] = Array.from(detailPicks.entries()).map(
    ([groupId, optionId]) => ({ groupId, optionId }),
  );

  /** 详情页当前要加的份数（从购物车回显，没加过默认为 1） */
  const [detailQty, setDetailQty] = useState(1);

  // 打开新菜品时重置份数为 1；已加购的回显当前数量
  useEffect(() => {
    if (!detailRecipe) return;
    const saved = cart.get(detailRecipe.id)?.qty ?? 0;
    setDetailQty(saved > 0 ? saved : 1);
  }, [detailRecipe?.id]);

  /** 别人的做法修改随共享车回显；未加购的菜仍保留本机尚未提交的选择。 */
  useEffect(() => {
    if (cartBusy || !detailRecipe) return;
    const row = cart.get(detailRecipe.id);
    if (row) setDetailPicks(new Map(row.practices.map((pick) => [pick.groupId, pick.optionId])));
  }, [cart, cartBusy, detailRecipe]);

  /** 详情浮层"加入购物车"：按当前选的份数加购，然后关窗 */
  const handleAddToCartAndClose = useCallback(() => {
    if (!detailRecipe) return;
    setQty(
      detailRecipe.id,
      (cart.get(detailRecipe.id)?.qty ?? 0) + detailQty,
      detailPicksPayload,
    );
    setDetailRecipe(null);
  }, [detailRecipe, cart, detailQty, detailPicksPayload, setQty]);

  if (loading || cartLoading) {
    return (
      <div className="fh-order">
        <div className="fh-order__state">加载中…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="fh-order">
        <div className="fh-order__state">
          <p>{loadError}</p>
          <button
            type="button"
            className="fh-order__retry"
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fh-order">
      <header className="fh-order__header">
        <button
          type="button"
          className="fh-order__back"
          onClick={() => navigate("/")}
        >
          ‹
        </button>
        <h1 className="fh-order__title">今天吃什么</h1>
        <button
          type="button"
          className="fh-order__entries"
          onClick={() => navigate("/recipe/orders")}
        >
          我的订单
        </button>
        <div className="fh-order__cols" role="group" aria-label="菜品列表列数">
          {COLUMN_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`fh-order__cols-btn${columns === n ? " is-active" : ""}`}
              onClick={() => selectColumns(n)}
              aria-label={`按 ${n} 列展示`}
              aria-pressed={columns === n}
            >
              {/* 图标就是"这一排几列"本身：n 根竖条，不另找字形 */}
              <span className="fh-order__cols-icon" aria-hidden="true">
                {Array.from({ length: n }, (_, i) => (
                  <i key={i} />
                ))}
              </span>
            </button>
          ))}
        </div>
      </header>

      <div className="fh-order__body">
        <aside className="fh-order__side">
          {sections.length === 0 && (
            <div className="fh-order__side-empty">暂无分类</div>
          )}
          {sections.map((sec) => (
            <button
              key={sec.key}
              type="button"
              className={`fh-order__side-item${sec.key === activeSection ? " is-active" : ""}`}
              onClick={() => goSection(sec.key)}
            >
              <span className="fh-order__side-name">{sec.title}</span>
            </button>
          ))}
        </aside>

        <main
          className={`fh-order__list${columns > 1 ? ` fh-order__list--grid-${columns}` : ""}`}
          ref={listRef}
          onScroll={handleListScroll}
        >
          {sections.length === 0 && (
            <div className="fh-order__empty">
              还没有菜品，去 B 端菜谱管理加几个吧
            </div>
          )}
          {sections.map((sec) => (
            <div
              key={sec.key}
              className="fh-dish-section"
              ref={(el) => {
                if (el) {
                  sectionRefs.current.set(sec.key, el);
                } else {
                  sectionRefs.current.delete(sec.key);
                }
              }}
            >
              <div className="fh-dish-section__title">{sec.title}</div>
              {/* 卡片区单独一层，切列数只给这一层加 grid，不影响 sticky 分区头 */}
              <div className="fh-dish-section__dishes">
              {sec.dishes.map((dish) => {
                const qty = cart.get(dish.id)?.qty ?? 0;
                const ordered = orderCounts.get(dish.id) ?? 0;
                return (
                  <div
                    key={dish.id}
                    className="fh-dish fh-dish--clickable"
                    onClick={() => openDetail(dish)}
                  >
                    <div className="fh-dish__cover">
                      <img src={resolveRecipeCover(dish.coverUrl)} alt={dish.name} />
                    </div>
                    <div className="fh-dish__info">
                      <div className="fh-dish__name">{dish.name}</div>
                      {dish.description && (
                        <div className="fh-dish__desc">{dish.description}</div>
                      )}
                      <div className="fh-dish__bottom">
                        {ordered > 0 && (
                          <span className="fh-dish__ordered">
                            点过 {ordered} 次
                          </span>
                        )}
                        {qty === 0 ? (
                          <button
                            type="button"
                            className="fh-dish__add"
                            onClick={(e) => {
                              e.stopPropagation();
                              // 这道菜有做法可挑：先打开详情浮层挑完再加，不给直接加进车
                              if (needsPracticeChoice(dish)) openDetail(dish);
                              else setQty(dish.id, 1, defaultPractices(dish));
                            }}
                            disabled={cartUnavailable}
                            aria-label={`加购${dish.name}`}
                          >
                            +
                          </button>
                        ) : (
                          <div className="fh-dish__stepper">
                            <button
                              type="button"
                              className="fh-dish__step"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQty(dish.id, qty - 1);
                              }}
                              disabled={cartUnavailable}
                              aria-label={`减少${dish.name}`}
                            >
                              −
                            </button>
                            <span className="fh-dish__qty">{qty}</span>
                            <button
                              type="button"
                              className="fh-dish__step fh-dish__step--plus"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQty(dish.id, qty + 1);
                              }}
                              disabled={cartUnavailable}
                              aria-label={`增加${dish.name}`}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          ))}
        </main>
      </div>

      <footer className="fh-order__cart-bar">
        <button
          type="button"
          className={`fh-order__cart-btn${totalQty > 0 ? " has-items" : ""}`}
          onClick={() => totalQty > 0 && setCartOpen(true)}
        >
          <span className="fh-order__cart-icon">
            🛒
            {totalQty > 0 && (
              <span className="fh-order__cart-badge">{totalQty}</span>
            )}
          </span>
          <span className="fh-order__cart-text">
            {cartError || (totalQty > 0 ? `已选 ${totalQty} 份` : "还没选菜")}
          </span>
        </button>
        <button
          type="button"
          className={`fh-order__submit${totalQty > 0 ? " is-enabled" : ""}`}
          disabled={totalQty === 0 || cartUnavailable}
          onClick={() =>
            navigate("/recipe/order/confirm", {
              // 加菜模式下把目标订单号交给确认页，那边据此改调 append 接口
              state: appendOrderId === null ? null : { appendOrderId },
            })
          }
        >
          {appendOrderId === null ? "去下单" : `加入订单 #${appendOrderId}`}
        </button>
      </footer>

      {cartOpen && (
        <div className="fh-order__mask" onClick={() => setCartOpen(false)}>
          <div className="fh-order__sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fh-order__sheet-head">
              <span>已选菜品</span>
              <button
                type="button"
                className="fh-order__sheet-clear"
                disabled={cartUnavailable}
                onClick={() => {
                  setCartOpen(false);
                  void mutate(clearCart, (previous) => ({ ...previous, items: [] }));
                }}
              >
                清空
              </button>
            </div>
            {cartGroups.map((group, groupIndex) => (
              <div key={group.label ?? `group-${groupIndex}`} className="fh-order__sheet-group">
                {group.label && (
                  <div className="fh-order__sheet-creator">
                    <span>{group.label}</span>
                    <span className="fh-order__sheet-creator-count">
                      {group.items.reduce((sum, item) => sum + item.qty, 0)} 份
                    </span>
                  </div>
                )}
                {group.items.map(({ recipe, qty, practices }) => (
                  <div key={recipe.id} className="fh-order__sheet-item">
                    <img className="fh-thumb" src={resolveRecipeCover(recipe.coverUrl)} alt="" />
                    <div className="fh-order__sheet-info">
                      <span className="fh-order__sheet-name">{recipe.name}</span>
                      {practices.length > 0 && (
                        <span className="fh-order__sheet-practices">
                          {practiceSummary(practices)}
                        </span>
                      )}
                    </div>
                    <div className="fh-dish__stepper">
                      <button
                        type="button"
                        className="fh-dish__step"
                        onClick={() => setQty(recipe.id, qty - 1)}
                        disabled={cartUnavailable}
                        aria-label={`减少${recipe.name}`}
                      >
                        −
                      </button>
                      <span className="fh-dish__qty">{qty}</span>
                      <button
                        type="button"
                        className="fh-dish__step fh-dish__step--plus"
                        onClick={() => setQty(recipe.id, qty + 1)}
                        disabled={cartUnavailable}
                        aria-label={`增加${recipe.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {detailRecipe && (
        <div className="fh-order__mask" onClick={() => setDetailRecipe(null)}>
          <div
            className="fh-detail__sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fh-detail__cover">
              <img src={resolveRecipeCover(detailRecipe.coverUrl)} alt={detailRecipe.name} />
              <button
                type="button"
                className="fh-detail__close"
                onClick={() => setDetailRecipe(null)}
                aria-label="关闭菜品详情"
              >
                ✕
              </button>
            </div>
            <div className="fh-detail__body">
              <div className="fh-detail__title-row">
                <span className="fh-detail__name">{detailRecipe.name}</span>
                {detailRecipe.category && (
                  <span className="fh-detail__category">
                    {detailRecipe.category}
                  </span>
                )}
              </div>
              {detailRecipe.description && (
                <p className="fh-detail__desc">{detailRecipe.description}</p>
              )}
              {detailPracticeGroups.map(({ bound, group }) => (
                <div key={group.id} className="fh-detail__practice-group">
                  <span className="fh-detail__practice-label">
                    {bound.required === true && (
                      <span className="fh-detail__practice-required">*</span>
                    )}
                    {group.name}
                  </span>
                  <div className="fh-detail__practice-options">
                    {group.options.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`fh-detail__practice-chip${detailPicks.get(group.id) === opt.id ? " is-active" : ""}`}
                        disabled={cartUnavailable}
                        onClick={() => handlePick(group.id, opt.id)}
                      >
                        {opt.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="fh-detail__footer">
              {/* 详情页步进器：始终显示，让用户选份数；按钮文案带上当前的份数 */}
              <div className="fh-dish__stepper fh-detail__stepper">
                <button
                  type="button"
                  className="fh-dish__step"
                  onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                  disabled={cartUnavailable}
                  aria-label={`减少份数`}
                >
                  −
                </button>
                <span className="fh-dish__qty">{detailQty}</span>
                <button
                  type="button"
                  className="fh-dish__step fh-dish__step--plus"
                  onClick={() => setDetailQty((q) => q + 1)}
                  disabled={cartUnavailable}
                  aria-label={`增加份数`}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="fh-detail__primary"
                disabled={missingRequiredPractice || cartUnavailable}
                onClick={handleAddToCartAndClose}
              >
                ＋ 加入购物车{detailQty > 1 ? `（${detailQty} 份）` : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fh-order__toast">{toast}</div>}
    </div>
  );
}
