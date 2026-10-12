import { useEffect, useState } from 'react';
import { Modal, Space, Typography } from 'antd';
import type { FileGroupBizType } from '../../api/fileGroup';
import type { DataScope } from '../../lib/http';
import { MediaGroupSelect } from './MediaGroupSelect';
import { useSetFileGroups } from './useFileGroups';

interface EditFileGroupsModalProps {
  open: boolean;
  fileId: number | null;
  /** 打开时该文件已属的分组（来自列表行，不再单独拉一次） */
  initialGroupIds: number[];
  bizType: FileGroupBizType;
  scope: DataScope;
  fileName?: string;
  onClose: () => void;
}

/**
 * 编辑一份文件/视频的所属分组（整组覆盖）。
 *
 * 「全部」列表与分组详情页每行的「编辑所属分组」都走这里：多选分组、留空即移出所有分组变未分组。
 * 与相册 ImageEditModal 的分组那一段同一口径，只是文件/视频没有城市字段，弹窗更简单。
 */
export function EditFileGroupsModal({
  open,
  fileId,
  initialGroupIds,
  bizType,
  scope,
  fileName,
  onClose,
}: EditFileGroupsModalProps) {
  const [groupIds, setGroupIds] = useState<number[]>(initialGroupIds);
  const saveMutation = useSetFileGroups(bizType, scope, open);

  // 每次打开（或换行）时用该行的当前归属重置，避免上一份文件的选择残留。
  useEffect(() => {
    if (open) setGroupIds(initialGroupIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fileId]);

  const handleOk = async () => {
    if (fileId == null) return;
    try {
      await saveMutation.mutateAsync({ fileId, groupIds });
      onClose();
    } catch {
      // 失败原因后端已给中文，hook 里弹过了；留着窗口便于重试
    }
  };

  return (
    <Modal
      open={open}
      title="编辑所属分组"
      okText="保存"
      cancelText="取消"
      confirmLoading={saveMutation.isPending}
      onOk={() => void handleOk()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {fileName && (
          <Typography.Text type="secondary" ellipsis style={{ maxWidth: '100%' }}>
            {fileName}
          </Typography.Text>
        )}
        <MediaGroupSelect
          bizType={bizType}
          scope={scope}
          active={open}
          disabled={saveMutation.isPending}
          value={groupIds}
          onChange={setGroupIds}
          style={{ width: '100%' }}
        />
      </Space>
    </Modal>
  );
}
