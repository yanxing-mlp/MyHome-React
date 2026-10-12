import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { clearCurrentUser, useCurrentUser } from '@family-home/shared/auth';
import { FH_LOGO, FH_LOGO_ALT } from '@family-home/shared/brand';
import { resolveUserAvatar } from '@family-home/shared/image';
import { FAMILY_ENTRIES, PERSONAL_ENTRIES, type EntryCode } from '../constants/entries';
import { useDomain } from '../lib/domain';

/** 入口对应的内页路由；新增入口时必须补齐映射。 */
const PATH_BY_CODE: Record<EntryCode, string> = {
  ALBUM: '/album',
  PERSONAL_ALBUM: '/album/personal',
  RECIPE: '/recipe/order',
  VIDEO: '/video',
  PERSONAL_VIDEO: '/video/personal',
  VAULT: '/vault',
  PERSONAL_VAULT: '/vault/personal',
};

const ICON_PATH_BY_CODE: Record<EntryCode, string> = {
  ALBUM: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M3 16l6-6 5 5 3-3 4 4 M16 7h.01',
  PERSONAL_ALBUM: 'M7 10V7a5 5 0 0 1 10 0v3 M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z M12 14v3',
  RECIPE: 'M3 3v5a4 4 0 0 0 8 0V3 M7 3v18 M20 3c-4 2-5 6-5 10h5 M20 3v18',
  // 家庭视频 = 屏幕里一个播放三角；私人视频沿用「个人 = 挂锁」的图形语言（与私人相册同一把锁），锁身里放播放三角
  VIDEO: 'M4 5h16v14H4z M10 9l5 3-5 3z',
  PERSONAL_VIDEO: 'M8 10V7a4 4 0 0 1 8 0v3 M6 10h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z M10 13v5l4.5-2.5z',
  // 家庭密码本 = 一把钥匙（区别于相册那把挂锁）；私人密码本 = 挂锁，沿用「个人 = 挂锁」的图形语言
  VAULT: 'M2.6 17.4A2 2 0 0 0 2 18.8V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.2a2 2 0 0 0 1.4-.6l.8-.8a6.5 6.5 0 1 0-4-4Z M16.5 7.5h.01',
  PERSONAL_VAULT: 'M8 10V7a4 4 0 0 1 8 0v3 M6 10h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z M12 14v3',
};

/** 域牌前置图标：家庭=一群人（team），个人=一个人（user），与 B 端 DomainSwitch 同一图形语言。 */
const DOMAIN_ICON = {
  family: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1 M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M21 20v-1a4 4 0 0 0-3-3.87 M16 4.13a4 4 0 0 1 0 7.75',
  personal: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
};

/**
 * C 端 home 页。
 *
 * 静态入口按每行三列的九宫格排列，只展示已有功能，不填充空白占位。
 * 右上角头像展开「家庭 / 个人」切域 + 分隔线 + 「注销」（v29：切域入口从下方那枚域牌收进这里，
 * 域牌退化为只读指示）；清本机身份后回到登录页，再次进入需要重新登录，不删除账号。
 * 这一格不只是装饰——点餐、传图进去之后落库的"下单人/添加人"就是它。
 */
export function HomePage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { domain, setDomain } = useDomain();
  const isFamily = domain === 'FAMILY';
  const entries = isFamily ? FAMILY_ENTRIES : PERSONAL_ENTRIES;
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
        userButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [userMenuOpen]);

  const goEntry = (code: EntryCode) => {
    navigate(PATH_BY_CODE[code]);
  };

  return (
    <div className="fh-home">
      {/* 品牌位：图形取 shared 的 FH_LOGO（与 B 端侧栏同一份 SVG），文字仍是 HTML 文本，
          这样中文跟着系统字体走；只有 C 端首页放品牌，内页顶栏是"返回 + 页名"，不重复占位 */}
      <div className="fh-home__brand">
        <img className="fh-home__logo" src={FH_LOGO} alt={FH_LOGO_ALT} width={44} height={44} />
        <div>
          <h1 className="fh-home__title">家庭 Home</h1>
          <p className="fh-home__subtitle">我们的小窝</p>
        </div>
        {user && (
          <div
            className="fh-home__user-wrap"
            ref={userMenuRef}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setUserMenuOpen(false);
              }
            }}
          >
            <button
              ref={userButtonRef}
              type="button"
              className="fh-home__user"
              aria-label={`${user.name}，账号操作`}
              aria-expanded={userMenuOpen}
              aria-controls={userMenuOpen ? 'fh-home-user-actions' : undefined}
              onClick={() => setUserMenuOpen((open) => !open)}
            >
              <img
                className="fh-home__user-avatar"
                src={resolveUserAvatar(user.avatarUrl)}
                alt=""
                width={32}
                height={32}
              />
              <span className="fh-home__user-name">{user.name}</span>
              <svg className="fh-home__user-chevron" viewBox="0 0 12 12" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" focusable="false">
                <path d="m3 4.5 3 3 3-3" />
              </svg>
            </button>
            {userMenuOpen && (
              <div id="fh-home-user-actions" className="fh-home__user-menu" role="group" aria-label="账号操作">
                <p className="fh-home__menu-domain-hint">家庭全家可见 · 个人仅自己可见</p>
                <div className="fh-home__menu-domain" role="group" aria-label="切换家庭或个人">
                  <button
                    type="button"
                    className={`fh-home__menu-domain-opt${isFamily ? ' fh-home__menu-domain-opt--active-family' : ''}`}
                    aria-pressed={isFamily}
                    onClick={() => {
                      setDomain('FAMILY');
                      setUserMenuOpen(false);
                    }}
                  >
                    家庭
                  </button>
                  <button
                    type="button"
                    className={`fh-home__menu-domain-opt${!isFamily ? ' fh-home__menu-domain-opt--active-personal' : ''}`}
                    aria-pressed={!isFamily}
                    onClick={() => {
                      setDomain('PERSONAL');
                      setUserMenuOpen(false);
                    }}
                  >
                    个人
                  </button>
                </div>
                <div className="fh-home__menu-sep" />
                <button type="button" onClick={clearCurrentUser}>注销</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 域牌（只读指示）：显示当前在哪一档（家庭=蓝、个人=紫，与 B 端 DomainSwitch 同一图形语言），
          不再是按钮——切换挪到了右上角头像下拉里，这里只负责"一眼看出当前域"。
          切域只换首页展示的入口，不跳路由。 */}
      <div className="fh-home__domain">
        <span className={`fh-home__domain-badge fh-home__domain-badge--${isFamily ? 'family' : 'personal'}`}>
          <svg className="fh-home__domain-icon" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d={isFamily ? DOMAIN_ICON.family : DOMAIN_ICON.personal} />
          </svg>
          <span>{isFamily ? '家庭' : '个人'}</span>
        </span>
      </div>

      <div className="fh-home__grid">
        {entries.map((entry) => (
          <button
            key={entry.code}
            type="button"
            className="fh-entry-card"
            onClick={() => goEntry(entry.code)}
          >
            <span className="fh-entry-card__icon" style={{ background: entry.gradient }}>
              <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d={ICON_PATH_BY_CODE[entry.code]} />
              </svg>
            </span>
            <span className="fh-entry-card__title">{entry.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
