import { Alert, Modal, Typography } from 'antd';

interface VaultPasswordModalProps {
  open: boolean;
  /** 展示用的「平台 / 账号」，让用户确认没点对条目 */
  label: string;
  /** 明文口令；null 表示还在取或取失败 */
  password: string | null;
  loading?: boolean;
  onClose: () => void;
}

/**
 * 明文口令展示弹窗。
 *
 * 三条刻意的约束：
 * 1. `destroyOnHidden` + 关闭时由父级把 password 置 null —— 明文不长期驻留在组件 state 里；
 * 2. 不给"全部导出""批量查看"这类能力，一次只解一条（后端也只提供单条 reveal）；
 * 3. 复制用 antd 自带的 copyable，不自己写 clipboard 代码。
 */
export function VaultPasswordModal({
  open,
  label,
  password,
  loading,
  onClose,
}: VaultPasswordModalProps) {
  return (
    <Modal
      open={open}
      title="查看口令"
      footer={null}
      destroyOnHidden
      onCancel={onClose}
      width={420}
    >
      {loading ? (
        <Typography.Text type="secondary">正在解密…</Typography.Text>
      ) : password === null ? (
        <Alert type="error" showIcon title="没取到口令，请重试" />
      ) : (
        <>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            {label}
          </Typography.Paragraph>
          <Typography.Paragraph copyable={{ text: password }} strong style={{ marginBottom: 0 }}>
            {password}
          </Typography.Paragraph>
        </>
      )}
    </Modal>
  );
}
