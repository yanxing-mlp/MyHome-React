import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { cancelOrder, completeOrder, reorderOrder } from "../api/recipe";

export type ReorderState = { reorderNotice?: string };
/** 继续加菜的目标由路由 state 从订单页经点餐页传到确认页。 */
export type AppendOrderState = { appendOrderId?: number };

export function readAppendOrderId(state: unknown): number | null {
  const id = (state as AppendOrderState | null | undefined)?.appendOrderId;
  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null;
}

/** 四种操作只做各自的事；同步屏障阻止连点，离开页面后响应不能再跳转或提示。 */
export function useOrderActions(notify: (text: string) => void) {
  const navigate = useNavigate();
  const location = useLocation();
  const [busyId, setBusyId] = useState<number | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    busy.current = false;
    setBusyId(null);
    return () => { generation.current += 1; };
  }, [location.key]);

  const runStatusAction = useCallback(async (
    orderId: number,
    action: (id: number) => Promise<null>,
    okText: string,
  ): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    const before = generation.current;
    setBusyId(orderId);
    try {
      await action(orderId);
      if (before !== generation.current) return false;
      notify(okText);
      return true;
    } catch (e) {
      if (before === generation.current) notify(e instanceof Error ? e.message : "操作失败");
      return false;
    } finally {
      if (before === generation.current) {
        busy.current = false;
        setBusyId(null);
      }
    }
  }, [notify]);

  const complete = useCallback(
    (id: number) => runStatusAction(id, completeOrder, "已标记完成"),
    [runStatusAction],
  );
  const cancel = useCallback(
    (id: number) => runStatusAction(id, cancelOrder, "已取消这一单"),
    [runStatusAction],
  );

  const reorder = useCallback(async (orderId: number, dishCount: number): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    const before = generation.current;
    setBusyId(orderId);
    try {
      const result = await reorderOrder(orderId);
      if (before !== generation.current) return;
      const notice = result.skippedCount > 0
        ? `已加入购物车 ${result.addedCount} 道菜，${result.skippedCount} 道菜已下架没加入`
        : `已把这单的 ${dishCount} 道菜加入购物车`;
      navigate("/recipe/order", { state: { reorderNotice: notice } satisfies ReorderState });
    } catch (e) {
      if (before === generation.current) notify(e instanceof Error ? e.message : "操作失败");
    } finally {
      if (before === generation.current) {
        busy.current = false;
        setBusyId(null);
      }
    }
  }, [navigate, notify]);

  const addMore = useCallback((orderId: number): void => {
    navigate("/recipe/order", { state: { appendOrderId: orderId } satisfies AppendOrderState });
  }, [navigate]);

  return { busyId, complete, cancel, reorder, addMore };
}
