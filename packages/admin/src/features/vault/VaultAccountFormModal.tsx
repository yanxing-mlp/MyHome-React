import { App, Form, Input } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { createVaultAccount, updateVaultAccount } from '../../api/vault';
import type { VaultAccount } from '../../api/vault';
import type { DataScope } from '../../lib/http';
import { FormModal } from '../../components/FormModal';
import { DuplicateFormItem } from '../../components/DuplicateFormItem';
import { useValidationSession } from '../../hooks/useValidationSession';
import { VAULT_ACCOUNTS_KEY } from './useVaultAccounts';

interface VaultAccountFormValues {
  name: string;
  account: string;
  password?: string;
}

interface VaultAccountFormModalProps {
  open: boolean;
  scope?: DataScope;
  /** null 表示新建 */
  record: VaultAccount | null;
  onClose: () => void;
}

/**
 * 密码本的新增 / 编辑弹窗。
 *
 * 编辑时**不回填口令**（列表接口根本不返回它，方案 §5.3），口令字段留空即"不改"。
 * 这不是妥协而是刻意的：如果编辑要求重填口令，用户改个平台名就得重新抄一遍密码，
 * 而"改个名字把口令弄丢了"是这类工具最难看的事故。
 */
export function VaultAccountFormModal({ open, record, onClose, scope = 'PUBLIC' }: VaultAccountFormModalProps) {
  const { capture } = useValidationSession(open, `${scope}:${record?.id ?? 'new'}`);
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return (
    <FormModal<VaultAccountFormValues>
      key={`${scope}:${record?.id ?? 'new'}`}
      open={open}
      title={record ? '编辑账号' : '新增账号'}
      initialValues={record ? { name: record.name, account: record.account } : undefined}
      onSubmit={async (values) => {
        const isCurrent = capture();
        if (!isCurrent()) return;
        // 明文仅留在表单和此次异步调用中，不作为 mutation variables 缓存。
        const name = values.name.trim();
        const account = values.account.trim();
        const password = values.password;
        try {
          if (record) {
            await updateVaultAccount(record.id, { name, account, password: password || undefined }, scope);
          } else {
            await createVaultAccount({ name, account, password }, scope);
          }
          void queryClient.invalidateQueries({ queryKey: VAULT_ACCOUNTS_KEY });
          if (isCurrent()) {
            message.success('已保存');
            onClose();
          }
        } catch (error) {
          if (isCurrent()) message.error(error instanceof Error ? error.message : '保存失败，请重试');
        }
      }}
      onClose={onClose}
    >
      <DuplicateFormItem
        name="name"
        label="平台名称"
        active={open}
        pairedField="account"
        duplicate={{ kind: 'VAULT_ACCOUNT', scope, excludeId: record?.id }}
        rules={[{ required: true, whitespace: true, message: '请输入平台名称' }, { max: 64, message: '最多 64 个字符' }]}
      >
        <Input placeholder="微信 / steam / QQ" autoFocus />
      </DuplicateFormItem>

      <DuplicateFormItem
        name="account"
        label="账号"
        active={open}
        pairedField="name"
        duplicate={{ kind: 'VAULT_ACCOUNT', scope, excludeId: record?.id }}
        rules={[{ required: true, whitespace: true, message: '请输入账号' }, { max: 128, message: '最多 128 个字符' }]}
      >
        <Input placeholder="手机号 / 邮箱 / 登录名" />
      </DuplicateFormItem>

      <Form.Item
        name="password"
        label="密码"
        rules={[
          ...(record ? [] : [{ required: true, message: '请输入密码' }]),
          { max: 256, message: '最长 256 个字符' },
        ]}
      >
        <Input.Password placeholder={record ? '留空表示不修改' : ''} autoComplete="new-password" />
      </Form.Item>
    </FormModal>
  );
}
