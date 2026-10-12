import { useCallback, useState } from 'react';

/**
 * C 端公私域（家庭 / 个人）。
 *
 * 与 B 端 packages/admin/src/lib/domain.ts 是同一套「域」概念（家庭 = FAMILY + PUBLIC，
 * 个人 = PERSONAL + PRIVATE），但落地方式不同：
 *
 * B 端侧栏要跟着当前页高亮，所以域以 URL 为准、localStorage 兜底；C 端首页是个"入口枢纽"
 * （URL 就是 '/'，没有 scope 段），域无处可从 URL 派生——这里只存本机（localStorage 'h5-domain'）。
 * 和 B 端一样属于"这台设备当前想看哪一档"的本机偏好，不进后端。
 *
 * 首页按当前域收敛九宫格入口：家庭域显示 家常菜谱 / 相册 / 视频，个人域只显示 相册 / 视频
 * （菜谱是家庭共享、没有个人版，和 B 端"菜谱只在家庭域出现"同一口径）。相册/视频各只有一个入口，
 * 点进去是家庭还是私人由当前域决定，复用现有 /album↔/album/personal、/video↔/video/personal 路由。
 */
export type Domain = 'FAMILY' | 'PERSONAL';

/** 域偏好存本机（与 B 端 admin-domain 各自独立，两端互不串台）。 */
const DOMAIN_KEY = 'h5-domain';

function readStoredDomain(): Domain {
  try {
    return localStorage.getItem(DOMAIN_KEY) === 'PERSONAL' ? 'PERSONAL' : 'FAMILY';
  } catch {
    // 隐私模式读 localStorage 会抛，退回家庭域
    return 'FAMILY';
  }
}

function writeStoredDomain(domain: Domain): void {
  try {
    localStorage.setItem(DOMAIN_KEY, domain);
  } catch {
    // 写不进去只是下次进来不记住，本次切换照常生效
  }
}

/**
 * 当前域 + 切换域。
 *
 * C 端只有首页用得到（域牌 + 按域过滤入口），用组件本地 state 即可，不需要 context——
 * 切域不会跳路由（首页 URL 不变），刷新后从 localStorage 复原。
 */
export function useDomain(): { domain: Domain; setDomain: (target: Domain) => void } {
  const [domain, setDomainState] = useState<Domain>(readStoredDomain);

  const setDomain = useCallback((target: Domain) => {
    setDomainState(target);
    writeStoredDomain(target);
  }, []);

  return { domain, setDomain };
}
