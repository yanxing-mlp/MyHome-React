/**
 * Admin 端专用 HTTP 客户端。
 * 
 * baseURL 设为 '/admin/' 以匹配 Vite base 配置，
 * 这样 API 请求会变成 /admin/api/...，然后由 Vite proxy 去掉 /admin 前缀转发到后端。
 */
import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import type { ApiResult } from '@family-home/shared/http';
import { ApiError, SUCCESS_CODE } from '@family-home/shared/http';
import { AUTH_HEADER, BEARER_PREFIX, clearCurrentUser, getAuthToken, getCurrentUserId } from '@family-home/shared/auth';

export const http = axios.create({ baseURL: '/admin/', timeout: 60_000 });

/**
 * 每个请求都带上"我是谁"。
 *
 * 后端拦截器（CurrentUserInterceptor）认的是 {@code Authorization: Bearer <token>}：验签验有效期后才把人
 * 写进上下文（旧的 X-User-Id 可被前端手搓冒充，已废弃）。默认注入当前令牌；密码本/文档用 withIdentity
 * 固定发起身份，避免异步步骤跨账号发送。没登录时不带头，需要身份的接口返回 401，由响应拦截器打回登录页。
 */
http.interceptors.request.use((config) => {
  const token = getAuthToken();
  const bearer = token ? BEARER_PREFIX + token : null;
  const expected = config.headers.get(AUTH_HEADER);
  if (expected != null && String(expected) !== bearer) {
    throw new axios.CanceledError('身份已切换，操作已取消');
  }
  if (bearer) config.headers.set(AUTH_HEADER, bearer);
  return config;
});

/**
 * 在异步加密、上传或查询开始前捕获身份；不能把旧请求交给新账号发送。
 *
 * 比对锚点仍是账号 id（调用方从渲染期的 {@code user.id} 传进来），令牌则在这一刻现取——
 * 换账号时 id 变、令牌也变，两道都对得上才算"还是同一个人"。
 */
export function withIdentity(userId = getCurrentUserId()): AxiosRequestConfig {
  if (!userId || userId !== getCurrentUserId()) {
    throw new axios.CanceledError('身份已切换，请重新操作');
  }
  const token = getAuthToken();
  if (!token) {
    throw new axios.CanceledError('登录状态已失效，请重新登录');
  }
  return { headers: { [AUTH_HEADER]: BEARER_PREFIX + token } };
}

// 添加响应拦截器，处理 HTTP 错误（下载的错误 Result 同样可能装在 Blob 中）
http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    const status = error.response?.status;
    let body = error.response?.data as any;
    if (error.config?.responseType === 'blob' && body instanceof Blob) {
      try { body = JSON.parse(await body.text()); } catch { body = undefined; }
    }
    const message = body && typeof body.message === 'string' && body.message
      ? body.message
      : status === undefined
        // 没有 response：后端没起 / 网络断了。原来这里会拼出"请求失败（HTTP undefined）"。
        ? '连不上后端服务，请确认服务已启动'
        : `请求失败（HTTP ${status}）`;
    const token = getAuthToken();
    const bearer = token ? BEARER_PREFIX + token : null;
    if (status === 401 && bearer != null && error.config?.headers.get(AUTH_HEADER) === bearer) {
      // 旧身份的迟到响应不能登出新账号；App 登录门槛由 useCurrentUser 驱动。
      clearCurrentUser();
    }
    // 抛 ApiError 而不是 Error：useApiMutation 认的是 ApiError（`error instanceof ApiError`），
    // 之前这里抛裸 Error，导致后端那句可直接展示的中文（"该昵称已存在"之类）在弹窗里全变成"操作失败，请重试"。
    return Promise.reject(new ApiError(body?.code ?? 'HTTP_ERROR', message, status));
  },
);

async function unwrap<T>(promise: Promise<{ data: ApiResult<T> }>): Promise<T> {
  const res = await promise;
  const body = res.data;
  if (body.code !== SUCCESS_CODE) {
    throw new ApiError(body.code, body.message ?? '请求失败');
  }
  return body.data as T;
}

/** 类型化的 GET，直接返回 data 字段 */
export function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return unwrap<T>(http.get<ApiResult<T>>(url, config));
}

/** 类型化的 POST */
export function post<T>(url: string, payload?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return unwrap<T>(http.post<ApiResult<T>>(url, payload, config));
}

/** 类型化的 PUT */
export function put<T>(url: string, payload?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return unwrap<T>(http.put<ApiResult<T>>(url, payload, config));
}

/** 类型化的 DELETE */
export function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return unwrap<T>(http.delete<ApiResult<T>>(url, config));
}

/** 查询参数拼接 */
export function toQuery<T extends object>(params: T): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      for (const item of value) search.append(key, String(item));
    } else {
      search.append(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** 密码本、文档和文档分类共用的数据分区；与相册 FAMILY/PERSONAL 独立。 */
export type DataScope = 'PUBLIC' | 'PRIVATE';
export type { PageResult, PageRequest } from '@family-home/shared/http';
