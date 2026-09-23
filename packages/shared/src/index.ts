/**
 * 家庭 Home 前端共享包。
 *
 * 入口清单：
 * - `@family-home/shared`        全量（只聚合 http / hooks / format 三个纯工具域）
 * - `@family-home/shared/http`   axios 封装、统一响应类型、分页请求/响应类型
 * - `@family-home/shared/hooks`  通用 hooks
 * - `@family-home/shared/format` 展示层格式化（时间等）
 * - `@family-home/shared/image`  图片转码、EXIF 提取、默认封面/默认头像
 * - `@family-home/shared/brand`  跨端 logo
 * - `@family-home/shared/auth`   当前登录账号（登录令牌 + Authorization 请求头 + 本机缓存 + useCurrentUser）
 * - `@family-home/shared/crypto` 口令的传输段加解密（与服务端 TransportCipher 对齐）
 *
 * 图片转码与 EXIF 提取（方案 §6.5）在 M2 加到 `src/image/`；
 * 跨端品牌标识（logo）在 `src/brand/`，与默认封面同一套"SVG 写成 data URI"的做法。
 * 后四个入口刻意不进上面的全量出口：两端按需取，别为了 import 一个常量把 antd 无关的东西拖进来。
 */
export * from './http';
export * from './hooks';
export * from './format';
