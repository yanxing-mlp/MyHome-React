import { useCallback, useLayoutEffect, useRef } from 'react';
import { getCurrentUserId, useCurrentUser } from '@family-home/shared/auth';

/** 异步校验/提交开始时取快照；关闭、卸载、换身份或换业务上下文后不可继续提交。 */
export function useValidationSession(active = true, context = '') {
  const user = useCurrentUser();
  const key = JSON.stringify([active, user?.id, context]);
  const session = useRef<object | null>(null);
  useLayoutEffect(() => {
    session.current = active ? {} : null;
    return () => { session.current = null; };
  }, [active, key]);

  const capture = useCallback(() => {
    const marker = session.current;
    const identity = getCurrentUserId();
    return () => marker !== null && session.current === marker && identity === getCurrentUserId();
  }, []);
  return { key, capture };
}
