import { useCallback, useEffect, useRef, useState } from 'react';
import { getCart, type CartSnapshot } from '../api/recipe';
import { startPolling } from './polling';

/** 共享车轮询与本机写操作共用一道响应屏障，旧 GET 不会覆盖新写入。 */
export function useSharedCart(notify: (message: string) => void) {
  const [snapshot, setSnapshot] = useState<CartSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const current = useRef<CartSnapshot | null>(null);
  const writing = useRef(false);
  const generation = useRef(0);
  const alive = useRef(false);

  const apply = useCallback((next: CartSnapshot) => {
    if (current.current && next.version < current.current.version) return;
    current.current = next;
    setSnapshot(next);
    setError('');
  }, []);

  useEffect(() => {
    alive.current = true;
    const stop = startPolling(async (isCurrent) => {
      if (writing.current) return;
      const before = generation.current;
      try {
        const next = await getCart();
        if (isCurrent() && before === generation.current) apply(next);
      } catch (e) {
        if (isCurrent() && before === generation.current) {
          setError(e instanceof Error ? e.message : '购物车刷新失败');
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    });
    return () => {
      alive.current = false;
      generation.current += 1;
      stop();
    };
  }, [apply]);

  const mutate = useCallback(async (
    write: (version: number) => Promise<CartSnapshot>,
    optimistic: (previous: CartSnapshot) => CartSnapshot,
  ) => {
    const previous = current.current;
    if (!previous || writing.current) return;
    writing.current = true;
    const before = ++generation.current;
    setBusy(true);
    setSnapshot(optimistic(previous));
    try {
      const next = await write(previous.version);
      if (alive.current && before === generation.current) apply(next);
    } catch (e) {
      if (!alive.current || before !== generation.current) return;
      notify(e instanceof Error ? e.message : '购物车保存失败');
      setSnapshot(previous);
      setError('购物车同步失败，请稍后重试');
      // 绝对值写请求失败不自动重放；先回读，不能把别人刚清掉的车重新加回来。
      try {
        const next = await getCart();
        if (alive.current && before === generation.current) apply(next);
      } catch {
        // 后续轮询继续恢复；同步失败期间禁用编辑与去下单。
      }
    } finally {
      writing.current = false;
      if (alive.current && before === generation.current) setBusy(false);
    }
  }, [apply, notify]);

  return { snapshot, loading, error, busy, mutate };
}
