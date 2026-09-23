/** 家庭共享数据每 3 秒刷新；上一轮结束后才计时，不堆积慢请求。 */
export const POLL_INTERVAL = 3000;

/** 首次立即读取；后台暂停，回到前台立即刷新；清理后在途响应不得再更新页面。 */
export function startPolling(read: (isCurrent: () => boolean) => Promise<void>) {
  let active = true;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const isCurrent = () => active;
  const run = async () => {
    if (!active || running) return;
    clearTimeout(timer);
    running = true;
    try {
      await read(isCurrent);
    } finally {
      running = false;
      if (active && document.visibilityState !== 'hidden') {
        timer = setTimeout(() => void run(), POLL_INTERVAL);
      }
    }
  };
  const resume = () => {
    if (document.visibilityState === 'hidden') clearTimeout(timer);
    else void run();
  };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('focus', resume);
  void run();
  return () => {
    active = false;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('focus', resume);
  };
}
