import { useEffect, useState } from 'react';
import { FH_LOGO, FH_LOGO_ALT } from '@family-home/shared/brand';
import { setAuthToken, setCurrentUser } from '@family-home/shared/auth';
import { listUserOptions, login, type UserOption } from '../api/user';
import './LoginPage.css';

/**
 * C 端登录页（没有本机账号时唯一能看到的一屏）。
 *
 * 【两样东西：下拉选账号 + 填密码】不做验证码、不做"忘记密码"：家里几个人共用，
 * 忘了口令就去 B 端登一次、在「个人中心」自己改（这一页只有 B 端有），实在不行让管理员
 * 删号重建——账号管理那边没有"替别人重置口令"这条路。为这一步做找回链路不值当。
 * 密码只在登录这一次交给后端核对，本机不缓存、也不进日志（见 shared/auth）。
 *
 * 【只有一屏，没有"返回"】没登录时 App 只渲染这一页，走到哪儿都先回到这里；
 * 登录成功后缓存写进本机，以后打开直接进首页（"登录一次即可"）。
 *
 * 账号列表拉不到时下拉是空的、按钮一直是禁用态：这一步不报错也没别的可做，
 * 后端起了再进一次就行（比给一个"能点但必失败"的按钮诚实）。
 */
export function LoginPage() {
  const [options, setOptions] = useState<UserOption[]>([]);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listUserOptions()
      .then((list) => {
        if (active) setOptions(list);
      })
      .catch(() => {
        /* 空下拉即"还没起来"，不给红字吓家里人 */
      });
    return () => {
      active = false;
    };
  }, []);

  const canSubmit = userId !== '' && password !== '' && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      // 密码不 trim：库里存的就是按输入原样算出来的哈希，前后端两边都得一致
      const { token, ...display } = await login(Number(userId), password);
      // 令牌与展示对象分开存：令牌是之后每个请求的 Authorization 凭据，展示对象只喂 UI。
      setAuthToken(token);
      setCurrentUser(display);
    } catch (e: unknown) {
      // 后端那句中文（密码不对 / 账号不存在）原样显示，不翻译成"登录失败"
      setError(e instanceof Error ? e.message : '登录失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fh-login">
      <div className="fh-login__brand">
        <img className="fh-login__logo" src={FH_LOGO} alt={FH_LOGO_ALT} width={56} height={56} />
        <h1 className="fh-login__title">家庭 Home</h1>
        <p className="fh-login__subtitle">我们的小窝</p>
      </div>

      <div className="fh-login__form">
        <select
          className="fh-login__field"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          <option value="">选择账号</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>

        <input
          className="fh-login__field"
          type="password"
          autoComplete="current-password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="button"
          className="fh-login__submit"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
        >
          {submitting ? '登录中…' : '进入'}
        </button>

        {error && <p className="fh-login__error">{error}</p>}
      </div>
    </div>
  );
}
