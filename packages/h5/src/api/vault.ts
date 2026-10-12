/**
 * C 端"看密码本"用的接口（后端 VaultCController，`/api/c/vault/accounts`）。
 *
 * **纯只读**：看列表 + 显式取回口令，但不新增、不编辑、不删除（增删改仍只在 B 端"密码本"，
 * 与相册/视频 C 端"能看不能删"、且 C 端从不做管理动作同一口径）。
 * 与视频 C 端同一手法：路径与返回形状按 C 端裁剪，查询/分区/口令加解密仍与 B 端共用同一套 service。
 * scope 默认 PUBLIC（家庭密码本，全家共享）；PRIVATE 只返回当前账号自己的私人密码本。
 * 请求封装见 utils/request.ts；口令的传输层加解密借 @family-home/shared/crypto（与 B 端同一份实现）。
 */

import { decryptPassword } from '@family-home/shared/crypto';
import { getJson, requestJson } from '../utils/request';

export type VaultScope = 'PUBLIC' | 'PRIVATE';

/**
 * 对应 VaultAccountClientVO：C 端只下发 id / 平台名 / 账号三列，
 * **没有口令字段**（分区/属主/添加人/时间也都不给）——口令只能走 revealVaultPassword 单独取。
 */
export interface VaultAccount {
  id: number;
  /** 平台名，如 微信 / steam / QQ */
  name: string;
  /** 账号，明文可展示 */
  account: string;
}

/**
 * 列一个分区的密码本条目，最近改动在前，整表返回不分页（家庭量级几十条）。
 * PRIVATE 的属主由服务端按登录令牌判定，前端不传、也不能传别人的 id；
 * 跨属主的私人条目在这一条上根本查不出来（与相册/视频 PERSONAL 同一口径）。
 */
export function listVaultAccounts(scope: VaultScope = 'PUBLIC'): Promise<VaultAccount[]> {
  return getJson<VaultAccount[]>(`/api/c/vault/accounts?scope=${scope}`);
}

/**
 * 取回某一条的口令，**返回的就是解密后的明文**（对页面来说接口形状与 B 端一致）。
 *
 * 用 POST 而不是 GET：GET 的 URL（含 id）会进 nginx access log 和浏览器历史，口令类动作不留这种痕迹。
 * 响应体里那一格是传输层密文，这里用 shared/crypto 解开；解出来的明文**只**进组件 state，
 * 不写 localStorage、不打日志、不缓存到别处。只在用户点"显示口令"时调，不做自动预取。
 */
export async function revealVaultPassword(
  id: number,
  scope: VaultScope = 'PUBLIC',
): Promise<{ id: number; password: string }> {
  const data = await requestJson<{ id: number; password: string }>(
    'POST',
    `/api/c/vault/accounts/${id}/password/reveal?scope=${scope}`,
  );
  return { id: data.id, password: await decryptPassword(data.password) };
}
