import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { SUCCESS_CODE, type ApiResult } from './types';

/**
 * 业务/网络异常。axios 拦截器把所有非 2xx 归一成这个类型，
 * 页面层只需要 catch 一种异常、读 message 就能直接展示。
 */
export class ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number | undefined;

  constructor(code: string, message: string, httpStatus?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function fallbackMessage(status: number | undefined, error: AxiosError): string {
  if (status === undefined) {
    // 没有 response：网络断开、后端没起、或 Vite proxy 目标不可达
    return error.code === 'ECONNABORTED' ? '请求超时，请稍后重试' : '连不上后端服务，请确认服务已启动';
  }
  switch (status) {
    case 400:
      return '请求参数有误';
    case 401:
    case 403:
      return '没有访问权限（B 端仅限内网访问）';
    case 404:
      return '请求的资源不存在';
    case 413:
      return '文件太大，请压缩后重试';
    case 415:
      return '不支持的文件格式';
    case 500:
      return '服务器开小差了，请稍后重试';
    default:
      return `请求失败（HTTP ${status}）`;
  }
}

/**
 * 创建 axios 实例。
 *
 * baseURL 默认 '/'：开发期靠 Vite proxy 转发到 8080，生产由 nginx 同域反代，
 * 两种情况都是同源请求，所以不需要配 CORS，也不需要写死域名（方案 §6.3、§8.1）。
 */
export function createHttpClient(baseURL = '/'): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 60_000 });

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiResult<unknown>>) => {
      const status = error.response?.status;
      const body = error.response?.data;
      // 后端给了 message 就用后端的（那是可直接展示的中文），否则按状态码兜底
      const message = body && typeof body.message === 'string' && body.message
        ? body.message
        : fallbackMessage(status, error);
      const code = body && typeof body.code === 'string' ? body.code : 'NETWORK_ERROR';
      return Promise.reject(new ApiError(code, message, status));
    },
  );

  return client;
}

/** 全局单例。admin 与 h5 各自 import，互不干扰。 */
export const http = createHttpClient();

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

/**
 * 把对象里的数组/空值整理成 axios 的 query 参数。
 *
 * 数组参数用重复 key 形式（?a=1&a=2）：这是 Spring 绑定 List 查询参数的默认口径，
 * 所以这里对数组逐项 append（URLSearchParams 本身就是 repeat 语义）。
 *
 * 参数用泛型而不是 `Record<string, unknown>`：TS 里 interface（如 VaultAccountQuery）
 * 不能赋给带索引签名的类型，写成 Record 会让每个调用点都被迫 `{ ...q } as Record<...>`。
 */
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

export type { ApiResult, PageResult, PageRequest } from './types';
