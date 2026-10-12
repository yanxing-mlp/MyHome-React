import { useRef, useState } from 'react';
import { Button, Modal, Space, Upload } from 'antd';
import type { UploadFile } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { DataScope } from '../../lib/http';
import { useValidationSession } from '../../hooks/useValidationSession';
import { FileCategorySelect } from './FileCategorySelect';
import { MediaGroupSelect } from './MediaGroupSelect';
import { useUploadDocument } from './useDocuments';

interface UploadDocumentModalProps {
  open: boolean;
  scope?: DataScope;
  onClose: () => void;
  /**
   * 从分组详情页进来时分组已定死（URL 上那个）：不渲染分组选择器，上传即绑这一个。
   * 「全部文件」页不传，让用户在弹窗里自选（可留空为未分组）。与相册 ImageUploadModal 同口径。
   */
  fixedGroupId?: number;
}

/**
 * 文件上传弹窗：选一个文件 + 选一个分类（必选）+ 选分组（可选，可多选）。
 *
 * 一次只传一份（maxCount 1）：多条批量上传要处理"部分成功"，家庭场景里没人需要，一期不做。
 * 2026-09-21 起**不限文件格式**：`Upload` 上原先那个 `accept=".csv,.md,.doc,.docx"` 删了，
 * 系统文件选择框不再把其他类型灰掉。类型（扩展名）仍由服务端按文件名解析，这里不给选——
 * 浏览器给的 Content-Type 不可信，而且让用户手填一遍类型只会填错。
 *
 * 分类是类型标签（必选，一份文件一个分类）；分组是归类维度（可选，可多个）——两者并存。
 * 分组留空即"未分组"，只出现在「全部文件」里，所以不因未选分组而置灰提交。
 */
export function UploadDocumentModal({ open, onClose, scope = 'PUBLIC', fixedGroupId }: UploadDocumentModalProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const uploadDocument = useUploadDocument(scope, open);
  const pending = useRef(false);
  const { capture } = useValidationSession(open, scope);

  const file = fileList[0]?.originFileObj as File | undefined;
  const canSubmit = !!file && !!categoryId;
  // 分组已由 URL 定死时就用它一个，多选 state 在这一路没有输入口
  const effectiveGroupIds = fixedGroupId == null ? groupIds : [fixedGroupId];

  const reset = () => {
    setFileList([]);
    setCategoryId(null);
    setGroupIds([]);
  };

  const handleOk = async () => {
    const isCurrent = capture();
    if (!isCurrent() || pending.current || !canSubmit || !file || !categoryId) return;
    pending.current = true;
    try {
      await uploadDocument.mutateAsync({ file, categoryId, groupIds: effectiveGroupIds });
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
        {fixedGroupId == null && (
          <MediaGroupSelect
            bizType="document"
            scope={scope}
            active={open}
            disabled={uploadDocument.isPending}
            value={groupIds}
            onChange={setGroupIds}
            style={{ width: '100%' }}
          />
        )}
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
