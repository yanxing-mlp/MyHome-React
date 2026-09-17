import { Form, Input } from 'antd';
import { createVaultAccount, updateVaultAccount } from '../../api/vault';
import type { VaultAccount } from '../../api/vault';
import { FormModal } from '../../components/FormModal';
import { useApiMutation } from '../../hooks/useApiMutation';
import { VAULT_ACCOUNTS_KEY } from './useVaultAccounts';

interface VaultAccountFormValues {
  name: string;
  account: string;
  password?: string;
}

interface VaultAccountFormModalProps {
  open: boolean;
  /** null 表示新建 */
  record: VaultAccount | null;
  onClose: () => void;
}

/**
 * 账号本的新增 / 编辑弹窗。
 *
 * 编辑时**不回填口令**（列表接口根本不返回它，方案 §5.3），口令字段留空即"不改"。
 * 这不是妥协而是刻意的：如果编辑要求重填口令，用户改个平台名就得重新抄一遍密码，
 * 而"改个名字把口令弄丢了"是这类工具最难看的事故。
 */
export function VaultAccountFormModal({ open, record, onClose }: VaultAccountFormModalProps) {
  const mutation = useApiMutation<VaultAccountFormValues>(
    async (values) => {
      const name = values.name.trim();
      const account = values.account.trim();
      const password = values.password?.trim();
      if (record) {
        await updateVaultAccount(record.id, { name, account, password: password || undefined });
        return;
      }
      await createVaultAccount({ name, account, password });
    },
    {
      invalidate: [VAULT_ACCOUNTS_KEY],
      successMessage: '已保存',
      onSettledSuccess: onClose,
    },
  );

  return (
    <FormModal<VaultAccountFormValues>
      open={open}
      title={record ? '编辑账号' : '新增账号'}
      initialValues={record ? { name: record.name, account: record.account } : undefined}
      onSubmit={(values) => void mutation.mutate(values)}
      confirmLoading={mutation.isPending}
      onClose={onClose}
    >
      <Form.Item
        name="name"
        label="平台名称"
        rules={[{ required: true, message: '请输入平台名称' }, { max: 64, message: '最多 64 个字符' }]}
      >
        <Input placeholder="微信 / steam / QQ" autoFocus />
      </Form.Item>

      <Form.Item
        name="account"
        label="账号"
        rules={[{ required: true, message: '请输入账号' }, { max: 128, message: '最多 128 个字符' }]}
      >
        <Input placeholder="手机号 / 邮箱 / 登录名" />
      </Form.Item>

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
