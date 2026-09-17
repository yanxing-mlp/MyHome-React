import { Button, Popconfirm } from 'antd';
import { deleteVaultAccount } from '../../api/vault';
import type { VaultAccount } from '../../api/vault';
import { useApiMutation } from '../../hooks/useApiMutation';
import { VAULT_ACCOUNTS_KEY } from './useVaultAccounts';

interface VaultAccountActionsProps {
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
export function VaultAccountActions({ record, onEdit, onReveal }: VaultAccountActionsProps) {
  const deleteMutation = useApiMutation(deleteVaultAccount, {
    invalidate: [VAULT_ACCOUNTS_KEY],
    successMessage: '已删除',
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
        description="删除后这条记录从账号本移除，口令一并不可见"
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
