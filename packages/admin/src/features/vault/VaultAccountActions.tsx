import { App, Button, Popconfirm } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@family-home/shared/auth';
import { deleteVaultAccount } from '../../api/vault';
import type { VaultAccount } from '../../api/vault';
import { withIdentity } from '../../lib/http';
import type { DataScope } from '../../lib/http';
import { useValidationSession } from '../../hooks/useValidationSession';
import { VAULT_ACCOUNTS_KEY } from './useVaultAccounts';

interface VaultAccountActionsProps {
  scope?: DataScope;
  record: VaultAccount;
  onEdit: (record: VaultAccount) => void;
  onReveal: (record: VaultAccount) => void;
}

/**
 * 单条账号的操作：查看口令 / 编辑 / 删除。
 *
 * 抽出来的直接原因是宽屏 Table 的"操作"列和窄屏卡片右下角要放**同一组**按钮，
 * 不抽就得写两遍，将来加"复制账号"改两处。
 * 这也是 reveal 只放在这里、不做"点行即取口令"的原因 —— 取明文必须是显式动作。
 */
export function VaultAccountActions({ record, onEdit, onReveal, scope = 'PUBLIC' }: VaultAccountActionsProps) {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { capture } = useValidationSession(true, scope);
  const deleteMutation = useMutation({
    onMutate: () => ({ isCurrent: capture() }),
    mutationFn: (id: number) => {
      if (!capture()()) throw new Error('页面已切换，请重新操作');
      return deleteVaultAccount(id, scope, withIdentity(user ? String(user.id) : null));
    },
    onSuccess: (_, __, session) => {
      if (session?.isCurrent()) message.success('已删除');
      void queryClient.invalidateQueries({ queryKey: VAULT_ACCOUNTS_KEY });
    },
    onError: (error, _, session) => {
      if (session?.isCurrent()) message.error(error.message || '删除失败，请重试');
    },
  });

  return (
    <>
      <Button size="small" type="link" onClick={() => onReveal(record)}>
        查看口令
      </Button>
      <Button size="small" type="link" onClick={() => onEdit(record)}>
        编辑
      </Button>
      <Popconfirm
        title={`删除「${record.name} / ${record.account}」？`}
        description="删除后这条记录从密码本移除，口令一并不可见"
        okText="删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        onConfirm={() => deleteMutation.mutate(record.id)}
      >
        <Button size="small" type="link" danger loading={deleteMutation.isPending}>
          删除
        </Button>
      </Popconfirm>
    </>
  );
}
