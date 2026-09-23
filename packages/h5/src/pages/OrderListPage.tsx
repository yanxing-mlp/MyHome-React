import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { resolveRecipeCover } from "@family-home/shared/image";
import { listOrders, type Order } from "../api/recipe";
import {
  ORDER_STATUS_CANCELLED,
  ORDER_STATUS_COMPLETED,
  ORDER_STATUS_PENDING,
  orderStatusLabel,
} from "../constants/orderStatus";
import { useOrderActions } from "../utils/orderActions";
import { formatOrderTime } from "../utils/time";
import { DELETED_USER_NAME, useUserNames } from "../utils/userNames";
import { useToast } from "../utils/toast";
import "./OrderPage.css";
import "./OrderListPage.css";

/**
 * C 端订单列表页。
 *
 * 最近下单的在前（后端已排好），每张卡片展示状态、下单时间、明细行和合计份数，
 * 明细行行首带这道菜下单时的封面小图（快照为空时给默认封面，见 shared 的 resolveRecipeCover）；
 * 点进详情页；卡片底部按状态给操作（见 utils/orderActions）：
 * 待制作＝「继续加菜」＋「取消订单」＋「已完成」，其余状态（已完成/已取消）只给「再来一单」。
 * 「取消」两端都有，但已完成与已取消都是定稿档：两端都没有后退的入口，误点了只能再下一单；
 * 待制作的单不给「再来一单」——同一顿还没做完，复制成新单没有意义。
 * 合计那一行前面带上"谁下的单"：订单只存 creator_id，昵称现查账号字典（见 utils/userNames），
 * 字典还没到或这单没记添加人，就整段不显示，不去凑一个占位符。
 */
export function OrderListPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const names = useUserNames();
  const { toast, showToast } = useToast();
  const { busyId, complete, cancel, reorder, addMore } = useOrderActions(showToast);

  /** null = 不显示（没这个 id，或字典还没加载完） */
  const creatorName = (id?: number | null) =>
    id == null || !names ? null : names.get(id) ?? DELETED_USER_NAME;

  useEffect(() => {
    let cancelled = false;
    listOrders()
      .then((list) => {
        if (!cancelled) setOrders(list);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
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

  /** 标记完成 / 取消成功后就地改那一条的状态：不重新拉列表，避免整页闪一下 */
  const applyStatus = (
    order: Order,
    status: string,
    run: (id: number) => Promise<boolean>,
  ) => {
    void run(order.id).then((ok) => {
      if (ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, status } : o)),
        );
      }
    });
  };

  return (
    <div className="fh-order">
      <header className="fh-order__header">
        <button
          type="button"
          className="fh-order__back"
          onClick={() => navigate("/recipe/order")}
        >
          ‹
        </button>
        <h1 className="fh-order__title">家庭订单</h1>
      </header>

      {orders.length === 0 ? (
        <div className="fh-order__state">
          <p>还没有订单，先去点两个菜吧</p>
          <button
            type="button"
            className="fh-order__retry"
            onClick={() => navigate("/recipe/order")}
          >
            去点餐
          </button>
        </div>
      ) : (
        <main className="fh-orders__list">
          {orders.map((order) => (
            <div
              key={order.id}
              className="fh-orders__card"
              onClick={() => navigate(`/recipe/orders/${order.id}`)}
            >
              <div className="fh-orders__card-head">
                <span className="fh-orders__status">
                  {orderStatusLabel(order.status)}
                </span>
                <span className="fh-orders__time">
                  {formatOrderTime(order.createTime)}
                </span>
              </div>
              {order.items.map((item) => (
                <div key={item.recipeId} className="fh-orders__dish">
                  <img className="fh-thumb" src={resolveRecipeCover(item.coverUrl)} alt="" />
                  <span className="fh-orders__dish-name">{item.recipeName}</span>
                  <span className="fh-orders__dish-qty">×{item.qty}</span>
                </div>
              ))}
              <div className="fh-orders__total">
                {/* 下单人靠在最前，份数仍是这一行的落点；查不到名字就整段不出现 */}
                {creatorName(order.creatorId) && (
                  <span className="fh-orders__creator">{creatorName(order.creatorId)} 下单</span>
                )}
                共 {order.totalQty} 份
              </div>
              {/* 整张卡片可点进详情，所以这些按钮必须 stopPropagation；
                  按钮按状态分岔：待制作才给加菜/取消/完成，其余状态只给「再来一单」。 */}
              <div className="fh-order-actions">
                {order.status === ORDER_STATUS_PENDING ? (
                  <>
                    <button
                      type="button"
                      className="fh-order-actions__btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        addMore(order.id);
                      }}
                    >
                      继续加菜
                    </button>
                    <button
                      type="button"
                      className="fh-order-actions__btn"
                      disabled={busyId !== null}
                      onClick={(e) => {
                        e.stopPropagation();
                        applyStatus(order, ORDER_STATUS_CANCELLED, cancel);
                      }}
                    >
                      取消订单
                    </button>
                    <button
                      type="button"
                      className="fh-order-actions__btn fh-order-actions__btn--primary"
                      disabled={busyId !== null}
                      onClick={(e) => {
                        e.stopPropagation();
                        applyStatus(order, ORDER_STATUS_COMPLETED, complete);
                      }}
                    >
                      已完成
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="fh-order-actions__btn"
                    disabled={busyId !== null}
                    onClick={(e) => {
                      e.stopPropagation();
                      void reorder(order.id, order.items.length);
                    }}
                  >
                    再来一单
                  </button>
                )}
              </div>
            </div>
          ))}
        </main>
      )}

      {toast && <div className="fh-order__toast">{toast}</div>}
    </div>
  );
}
