/**
 * 家庭 Home 前端共享包。
 *
 * 四个入口：
 * - `@family-home/shared`        全量
 * - `@family-home/shared/http`   axios 封装、统一响应类型、分页请求/响应类型
 * - `@family-home/shared/hooks`  通用 hooks
 * - `@family-home/shared/format` 展示层格式化（时间等）
 *
 * 图片转码与 EXIF 提取（方案 §6.5）在 M2 加到 `src/image/`。
 */
export * from './http';
export * from './hooks';
export * from './format';
