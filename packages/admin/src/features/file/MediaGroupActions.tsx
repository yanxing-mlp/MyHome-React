import { Button, Popconfirm, Space } from 'antd';
import type { FileGroup, FileGroupBizType } from '../../api/fileGroup';
import type { DataScope } from '../../lib/http';
import { useDeleteFileGroup } from './useFileGroups';

interface MediaGroupActionsProps {
  record: FileGroup;
  bizType: FileGroupBizType;
  scope: DataScope;
  onEdit: (record: FileGroup) => void;
}

/**
 * 分组卡片的操作按钮组：重命名 + 删除。
 *
 * 与相册分组卡片不同——文件/视频分组没有上下架三态，删除即物理删（连带解绑组内文件）。
 * 所以确认文案说清"文件本身不会被删，只是变成未分组"，避免用户误以为会连文件一起删掉。
 */
export function MediaGroupActions({ record, bizType, scope, onEdit }: MediaGroupActionsProps) {
  const deleteMutation = useDeleteFileGroup(bizType, scope);
  const noun = bizType === 'video' ? '视频' : '文件';

  return (
    <Space wrap>
      <Button size="small" onClick={() => onEdit(record)}>
        重命名
      </Button>
      <Popconfirm
        title="确定要删除这个分组吗？"
        description={`删除后，该分组下的${noun}会变为未分组（${noun}本身不会被删除）。`}
        okText="确定删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        onConfirm={() => void deleteMutation.mutate(record.id)}
      >
        <Button size="small" danger loading={deleteMutation.isPending}>
          删除
        </Button>
      </Popconfirm>
    </Space>
  );
}
