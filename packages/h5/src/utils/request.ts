/**
 * h5 的 fetch 薄封装（C 端只借 @family-home/shared 的图片处理与当前账号，不借它的 axios）。
 *
 * 页面打的都是 C 端自己的接口（`/api/c/**`，方案 §5.4），这一层只管发请求、拆 Result、
 * 顺带把身份带上，不关心是哪个业务域；换 URL 改各 api 文件即可，这里不用动。
 *
 * 【身份只有一个来源】Authorization 头里的登录令牌由 shared 的令牌缓存现取，页面与 api 文件都不碰这个头，
 * 所以"换账号"只需要清一次缓存，下一发请求自动变成另一个人（与 B 端 lib/http 同一口径）。
 * 令牌是后端 HMAC 签名的，改一个字节就验不过——这取代了旧那个可被手搓冒充的 X-User-Id。
 */
import { AUTH_HEADER, BEARER_PREFIX, clearCurrentUser, getAuthToken } from '@family-home/shared/auth';

interface ApiResult<T> {
  code: string;
  message: string;
  data: T;
  success: boolean;
}

/** 区分明确拒绝与网络/服务端未知结果：下单未知结果必须用原版本重试。 */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 当前账号的 Authorization 头；没登录时是空对象，fetch 干脆不带这个头 */
function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { [AUTH_HEADER]: BEARER_PREFIX + token } : {};
}

/** 拆 Result：非 2xx 也尽量把后端那句中文业务提示取出来（GlobalExceptionHandler 就是这么返的） */
async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res
      .json()
      .then((data: ApiResult<unknown>) => data)
      .catch(() => undefined);
    // 401 = 本机那枚令牌已经不认了（过期、被篡改，或账号被删）。清掉，下一帧就回到登录页重选，
    // 而不是让每个请求都顶着一句"请先登录"反复失败。
    if (res.status === 401) clearCurrentUser();
    throw new ApiError(body?.message || `请求失败（HTTP ${res.status}）`, res.status);
  }
  const data = (await res.json()) as ApiResult<T>;
  if (!data.success || data.code !== '0') {
    throw new Error(data.message || '请求失败');
  }
  return data.data;
}

export async function requestJson<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      ...authHeaders(),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return unwrap<T>(res);
}

export function getJson<T>(url: string): Promise<T> {
  return requestJson<T>('GET', url);
}

/**
 * multipart 上传（相册上传入口用）。
 *
 * 这里**不能**手动设 Content-Type：boundary 得由浏览器自己带上，写死了后端解不出文件。
 * 身份头照带，否则新传的图片不知道是谁加的。
 */
export async function postMultipart<T>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: form });
  return unwrap<T>(res);
}
