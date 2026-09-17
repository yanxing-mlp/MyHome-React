import { useEffect, useState } from 'react';

/**
 * 断点判定。
 *
 * 刻意不用 antd 的 Grid.useBreakpoint —— 自己实现有两个好处：
 * 1. 不绑定组件库版本（antd v5 → v6 的 Grid API 有变动风险）；
 * 2. h5 包也能复用，而 h5 不装 antd。
 *
 * 断点值与 antd 保持一致：lg = 992px。方案 §7.2 的导航切换以它为界。
 */
const QUERIES = {
  /** < 768px：手机。菜谱列表在这一档从 Table 换成卡片列表 */
  sm: '(max-width: 767px)',
  /** >= 768px 且 < 992px：平板/大屏手机横屏 */
  md: '(min-width: 768px) and (max-width: 991px)',
  /** >= 992px：桌面。左侧固定 Sider */
  lg: '(min-width: 992px)',
} as const;

function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(query).matches;
}

/** 是否为桌面宽度（>= 992px）。用于决定 Sider 常驻还是收进 Drawer。 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => matches(QUERIES.lg));

  useEffect(() => {
    const mql = window.matchMedia(QUERIES.lg);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    // Safari 14 以前只支持 addListener，这里两者都兜一下
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      setIsDesktop(mql.matches);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    setIsDesktop(mql.matches);
    return () => mql.removeListener(onChange);
  }, []);

  return isDesktop;
}

/** 是否为手机宽度（< 768px）。用于决定表格是否降级成卡片列表。 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => matches(QUERIES.sm));

  useEffect(() => {
    const mql = window.matchMedia(QUERIES.sm);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      setIsMobile(mql.matches);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    setIsMobile(mql.matches);
    return () => mql.removeListener(onChange);
  }, []);

  return isMobile;
}

export { QUERIES as BREAKPOINT_QUERIES };
