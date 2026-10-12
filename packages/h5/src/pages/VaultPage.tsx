import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  listVaultAccounts,
  revealVaultPassword,
  type VaultAccount,
  type VaultScope,
} from '../api/vault';
import { useToast } from '../utils/toast';
import './VaultPage.css';

/**
 * C 端"看密码本"（家庭 / 私人按 scope 参数化，路由 `/vault`、`/vault/personal`）。
 *
 * **纯只读**：列当前分区的条目（平台名 + 账号），点某一条的「显示口令」才现取口令——
 * 不新增、不编辑、不删除（增删改仍只在 B 端"密码本"，与相册/视频 C 端"能看不能删"、
 * 且 C 端从不做管理动作同一口径）。返回按钮回首页。
 *
 * 口令按需 reveal（不预取）：明文只进这一层的浮层 state，浮层一关就置空，绝不落 localStorage、不打日志。
 * reveal 走 POST（GET 的 URL 会进 access log / 浏览器历史），响应是传输层密文，由 api 层用
 * @family-home/shared/crypto 解开后交给这里展示——与 B 端 VaultPasswordModal 同一套加解密、同一口径。
 *
 * UI 全部手写 fh-* 样式，不引组件库（h5 一贯如此）；浮层点空白或 Esc 关闭。
 */

/** 浮层里正在看的那一条：password 为 null 表示还在解密或取失败。 */
interface RevealState {
  name: string;
  account: string;
  password: string | null;
  loading: boolean;
  error: string;
}

export function VaultPage({ scope = 'PUBLIC' }: { scope?: VaultScope }) {
  const navigate = useNavigate();
  const isPrivate = scope === 'PRIVATE';
  const [accounts, setAccounts] = useState<VaultAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reveal, setReveal] = useState<RevealState | null>(null);
  /** 正在解密的条目 id，用于把那一行的按钮置成"解密中…"并防重复点。 */
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const { toast, showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    listVaultAccounts(scope)
      .then((list) => {
        if (!cancelled) setAccounts(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  /** 点「显示口令」：现取这一条的明文，成功开浮层，失败在浮层里给一句重试。 */
  const onReveal = (item: VaultAccount) => {
    if (revealingId !== null) return;
    setRevealingId(item.id);
    setReveal({ name: item.name, account: item.account, password: null, loading: true, error: '' });
    revealVaultPassword(item.id, scope)
      .then(({ password }) => {
        setReveal({ name: item.name, account: item.account, password, loading: false, error: '' });
      })
      .catch((e: unknown) => {
        setReveal({
          name: item.name,
          account: item.account,
          password: null,
          loading: false,
          error: e instanceof Error ? e.message : '没取到口令，请重试',
        });
      })
      .finally(() => setRevealingId(null));
  };

  const closeReveal = () => setReveal(null);

  /** 复制明文到剪贴板；clipboard API 不可用（非安全上下文）时退回临时 textarea + execCommand。 */
  const copyPassword = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('已复制口令');
    } catch {
      showToast('复制失败，请长按手动复制');
    }
  };

  useEffect(() => {
    if (!reveal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeReveal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reveal]);

  return (
    <div className="fh-vault">
      <header className="fh-vault__header">
        <button type="button" className="fh-vault__back" onClick={() => navigate('/')}>
          ‹
        </button>
        <h1 className="fh-vault__title">{isPrivate ? '私人密码本' : '家庭密码本'}</h1>
      </header>

      {loading ? (
        <div className="fh-vault__state">加载中…</div>
      ) : loadError ? (
        <div className="fh-vault__state">
          <p>{loadError}</p>
          <button
            type="button"
            className="fh-vault__retry"
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </div>
      ) : accounts.length === 0 ? (
        <div className="fh-vault__state">
          {isPrivate
            ? '还没有私人密码，先在管理后台的个人域里添加吧'
            : '还没有密码条目，先在管理后台添加几条吧'}
        </div>
      ) : (
        <main className="fh-vault__list">
          {accounts.map((item) => (
            <div className="fh-vault__card" key={item.id}>
              <span className="fh-vault__badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" focusable="false">
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  <path d="M6 10h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
                  <path d="M12 14v3" />
                </svg>
              </span>
              <span className="fh-vault__meta">
                <span className="fh-vault__name">{item.name}</span>
                <span className="fh-vault__account">{item.account}</span>
              </span>
              <button
                type="button"
                className="fh-vault__reveal-btn"
                disabled={revealingId === item.id}
                onClick={() => onReveal(item)}
              >
                {revealingId === item.id ? '解密中…' : '显示口令'}
              </button>
            </div>
          ))}
        </main>
      )}

      {reveal && (
        <div
          className="fh-vault__overlay"
          role="dialog"
          aria-label="查看口令"
          onClick={closeReveal}
        >
          <div className="fh-vault__sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fh-vault__sheet-title">查看口令</div>
            <div className="fh-vault__sheet-label">
              {reveal.name} · {reveal.account}
            </div>
            {reveal.loading ? (
              <div className="fh-vault__sheet-hint">正在解密…</div>
            ) : reveal.error ? (
              <div className="fh-vault__sheet-error">{reveal.error}</div>
            ) : (
              <div className="fh-vault__sheet-password">{reveal.password}</div>
            )}
            <div className="fh-vault__sheet-actions">
              {!reveal.loading && !reveal.error && (
                <button
                  type="button"
                  className="fh-vault__sheet-copy"
                  onClick={() => reveal.password && copyPassword(reveal.password)}
                >
                  复制
                </button>
              )}
              <button type="button" className="fh-vault__sheet-close" onClick={closeReveal}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fh-vault__toast">{toast}</div>}
    </div>
  );
}
