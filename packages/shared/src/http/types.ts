/**
 * 后端统一响应结构（方案 §5.2）。
 *
 * HTTP 状态码表达传输语义（400/404/409/413/415/500），业务错误码在 body 的 code 里，
 * 成功固定为 "0"。
 */
export interface ApiResult<T> {
  code: string;
  message: string;
  data: T | null;
  /** 后端 Result.isSuccess() 被 Jackson 序列化出来的派生字段，等价于 code === '0' */
  success: boolean;
}

/** 统一分页响应。hasMore 是给 H5 无限滚动用的，省掉前端自己算。 */
export interface PageResult<T> {
  records: T[];  // 后端 MyBatis-Plus Page 返回的字段名
  list?: T[];    // 兼容自定义 PageResult
  total: number;
  size?: number;     // 后端字段名
  current?: number;  // 后端字段名  
  pages?: number;    // 后端字段名
  pageNo?: number;   // 自定义 PageResult 字段名
  pageSize?: number; // 自定义 PageResult 字段名
  hasMore?: boolean;
}

/** 内容三态状态，对应后端 ContentStatus 枚举 */
export type ContentStatus = 'ON_SHELF' | 'OFF_SHELF' | 'DELETED';

/**
 * 分页请求参数。后端所有分页接口都用 `pageNo`（从 1 开始）+ `pageSize`（上限 100），
 * 各域列表接口的其余筛选项在自己的类型里 `extends` 它。
 */
export interface PageRequest {
  pageNo: number;
  pageSize: number;
}

export const SUCCESS_CODE = '0';
