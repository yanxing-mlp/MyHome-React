import { useRef, useState } from 'react';
import { Button, Modal, Space, Upload } from 'antd';
import type { UploadFile } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { DataScope } from '../../lib/http';
import { useValidationSession } from '../../hooks/useValidationSession';
import { FileCategorySelect } from './FileCategorySelect';
import { useUploadDocument } from './useDocuments';

interface UploadDocumentModalProps {
  open: boolean;
  scope?: DataScope;
  onClose: () => void;
}

/**
 * 文件上传弹窗：选一个文件 + 选一个分类。
 *
 * 一次只传一份（maxCount 1）：多条批量上传要处理"部分成功"，家庭场景里没人需要，一期不做。
 * 2026-09-21 起**不限文件格式**：`Upload` 上原先那个 `accept=".csv,.md,.doc,.docx"` 删了，
 * 系统文件选择框不再把其他类型灰掉。类型（扩展名）仍由服务端按文件名解析，这里不给选——
 * 浏览器给的 Content-Type 不可信，而且让用户手填一遍类型只会填错。
 */
export function UploadDocumentModal({ open, onClose, scope = 'PUBLIC' }: UploadDocumentModalProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const uploadDocument = useUploadDocument(scope, open);
  const pending = useRef(false);
  const { capture } = useValidationSession(open, scope);

  const file = fileList[0]?.originFileObj as File | undefined;
  const canSubmit = !!file && !!categoryId;

  const reset = () => {
    setFileList([]);
    setCategoryId(null);
  };

  const handleOk = async () => {
    const isCurrent = capture();
    if (!isCurrent() || pending.current || !canSubmit || !file || !categoryId) return;
    pending.current = true;
    try {
      await uploadDocument.mutateAsync({ file, categoryId });
      if (isCurrent()) {
        reset();
        onClose();
      }
    } catch {
      // 失败原因（分类不存在 / 文件超大）后端已给中文，hook 里弹过了
    } finally {
      pending.current = false;
    }
  };

  return (
    <Modal
      open={open}
      title="上传文件"
      okText="上传"
      cancelText="取消"
      confirmLoading={uploadDocument.isPending}
      okButtonProps={{ disabled: !canSubmit }}
      onOk={handleOk}
      onCancel={() => {
        reset();
        onClose();
      }}
      destroyOnHidden
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <FileCategorySelect
          scope={scope}
          active={open}
          disabled={uploadDocument.isPending}
          creatable
          value={categoryId}
          onChange={setCategoryId}
          style={{ width: '100%' }}
        />
        <Upload
          disabled={uploadDocument.isPending}
          maxCount={1}
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList: next }) => setFileList(next.slice(-1))}
        >
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
      </Space>
    </Modal>
  );
}
