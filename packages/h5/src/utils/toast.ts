import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 轻量 toast（点餐页 / 订单列表 / 订单详情共用）。
 *
 * h5 不带 UI 库（antd 只在 admin），这类一次性提示自己实现 8 行就够；
 * 组件卸载时清掉定时器，避免在已卸载的组件上 setState。
 */
export function useToast() {
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(text);
    timer.current = setTimeout(() => setToast(""), 1800);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { toast, showToast };
}
