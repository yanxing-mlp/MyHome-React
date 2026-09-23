import { post, withIdentity } from '../lib/http';
import type { DataScope } from '../lib/http';

export type DuplicateKind =
  | 'RECIPE' | 'RECIPE_CATEGORY' | 'PRACTICE_GROUP' | 'PRACTICE_OPTION'
  | 'ALBUM_GROUP' | 'USER_NAME' | 'USER_PHONE' | 'VAULT_ACCOUNT' | 'FILE_CATEGORY';

export interface DuplicateRequest {
  kind: DuplicateKind;
  name?: string;
  account?: string;
  scope?: 'FAMILY' | 'PERSONAL' | DataScope;
  excludeId?: number;
  groupId?: number;
}

export const duplicateMessages: Record<DuplicateKind, string> = {
  RECIPE: '已有同名菜谱',
  RECIPE_CATEGORY: '已有同名分类',
  PRACTICE_GROUP: '已有同名分组',
  PRACTICE_OPTION: '已有同名选项',
  ALBUM_GROUP: '已有同名分组',
  USER_NAME: '该昵称已存在',
  USER_PHONE: '该手机号已存在',
  VAULT_ACCOUNT: '该平台下已存在相同账号',
  FILE_CATEGORY: '已有同名分类',
};

/** 只交给服务端比较（含数据库大小写/重音规则），不使用页面列表或缓存判重。 */
export async function checkDuplicate(request: DuplicateRequest): Promise<boolean> {
  const scoped = request.kind === 'VAULT_ACCOUNT' || request.kind === 'FILE_CATEGORY';
  const result = await post<boolean>('/api/b/validation/duplicate', {
    kind: request.kind,
    name: request.name?.trim(),
    account: request.account?.trim(),
    scope: scoped ? request.scope ?? 'PUBLIC' : request.scope,
    excludeId: request.excludeId,
    groupId: request.groupId,
  }, scoped ? withIdentity() : undefined);
  if (typeof result !== 'boolean') throw new Error('校验失败，请重试');
  return result;
}
