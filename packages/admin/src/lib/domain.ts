import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

/**
 * 公私域（家庭 / 个人）。
 *
 * B 端侧栏过去把「家庭相册 / 个人相册」并列成两个一级菜单，文件、视频、密码本又各自
 * 把「公共 / 私人」做成二级子菜单——同一件事在菜单里出现两遍。现在收敛成一个全局「域」：
 * 头像下拉里切「家庭 / 个人」，侧栏只显示当前域那一档。
 *
 * 相册用 FAMILY/PERSONAL，文件/视频/密码本用 PUBLIC/PRIVATE，两套枚举在 UI 上统一映射到
 * 「家庭 / 个人」这一个开关：家庭 = FAMILY + PUBLIC，个人 = PERSONAL + PRIVATE。
 */
export type Domain = 'FAMILY' | 'PERSONAL';

/** 各域切换后没有对应模块时的落地页。 */
export const FAMILY_LANDING = '/home';
export const PERSONAL_LANDING = '/album/personal/groups';

/** 域偏好存本机（和侧栏收起状态同一口径：这是"这台设备看着顺不顺手"，不进后端）。 */
const DOMAIN_KEY = 'admin-domain';

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
 * 从 pathname 反推当前域。
 *
 * 只有带公私域的四个模块（相册 / 文件 / 视频 / 密码本）能从 URL 判定；首页、菜谱、点单、
 * 账号管理、个人中心这些域无关的页面返回 null，交给调用方回落到"上次记住的域"。
 */
export function resolveDomainFromPath(pathname: string): Domain | null {
  if (
    pathname.startsWith('/album/personal') ||
    pathname.startsWith('/file/private') ||
    pathname.startsWith('/video/private') ||
    pathname.startsWith('/vault/private')
  ) {
    return 'PERSONAL';
  }
  if (
    pathname.startsWith('/album') ||
    pathname.startsWith('/file') ||
    pathname.startsWith('/video') ||
    pathname.startsWith('/vault')
  ) {
    return 'FAMILY';
  }
  return null;
}

/**
 * 切到目标域时该跳去哪。
 *
 * 规则（用户口径）：跳到"当前模块的对应档"——在家庭相册就跳到个人相册、在公共文件就跳到私人文件；
 * 当前模块在目标域不存在（首页 / 菜谱 / 点单 / 账号管理 / 个人中心）时，回落到目标域的落地页。
 * 相册详情页（/album/:id）的 groupId 是域内专有的，跨域带过去必然 404，所以一律回落到分组列表。
 */
export function switchDomainPath(pathname: string, target: Domain): string {
  // 相册：图片管理 / 相册分组 / 图片分布 三个列表页一一对应；详情页与裸 /album 回落到分组列表
  if (pathname.startsWith('/album')) {
    const tail = pathname.startsWith('/album/personal')
      ? pathname.slice('/album/personal'.length)
      : pathname.slice('/album'.length);
    const known = ['/images', '/groups', '/distribution'];
    const sub = known.find((k) => tail === k || tail.startsWith(`${k}/`)) ?? '/groups';
    return target === 'PERSONAL' ? `/album/personal${sub}` : `/album${sub}`;
  }
  // 文件 / 视频 / 密码本：public ↔ private 直接对调
  for (const base of ['/file', '/video', '/vault']) {
    if (pathname.startsWith(base)) {
      return target === 'PERSONAL' ? `${base}/private` : `${base}/public`;
    }
  }
  // 域无关页：回落到目标域落地页
  return target === 'PERSONAL' ? PERSONAL_LANDING : FAMILY_LANDING;
}

/**
 * 当前域 + 切换域。
 *
 * 域优先从 URL 派生（URL 是真相，和路由里 scope 由路径决定同一口径）；域无关页回落到本机记住的
 * 偏好。每次落在带域的页面上都把偏好同步过去，这样从个人相册点进"个人中心"再出来，菜单还停在个人域。
 *
 * AdminLayout（渲染哪套菜单）和 CurrentUserBlock（下拉里的切换项）各自调用，读同一个 location，
 * 不需要额外的 context。
 */
export function useDomain(): { domain: Domain; setDomain: (target: Domain) => void } {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const pathDomain = resolveDomainFromPath(pathname);
  const domain: Domain = pathDomain ?? readStoredDomain();

  // 落在带域的页面上时，把偏好同步成当前域（幂等，重复写同一个值无副作用）
  useEffect(() => {
    if (pathDomain) writeStoredDomain(pathDomain);
  }, [pathDomain]);

  const setDomain = useCallback(
    (target: Domain) => {
      writeStoredDomain(target);
      // 已经在目标域就不动（点当前域那一项是 no-op）
      if (resolveDomainFromPath(pathname) === target) return;
      navigate(switchDomainPath(pathname, target));
    },
    [navigate, pathname],
  );

  return { domain, setDomain };
}
