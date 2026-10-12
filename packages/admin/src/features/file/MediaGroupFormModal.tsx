import { Input } from 'antd';
import { FormModal } from '../../components/FormModal';
import { DuplicateFormItem } from '../../components/DuplicateFormItem';
import { useValidationSession } from '../../hooks/useValidationSession';
import type { FileGroup, FileGroupBizType } from '../../api/fileGroup';
import type { DataScope } from '../../lib/http';
import { useCreateFileGroup, useRenameFileGroup } from './useFileGroups';

interface MediaGroupFormValues {
  name: string;
}

interface MediaGroupFormModalProps {
  open: boolean;
  /** null 表示新建 */
  record: FileGroup | null;
  bizType: FileGroupBizType;
  scope: DataScope;
  onClose: () => void;
}

/**
 * 文件/视频分组的新建 / 重命名弹窗（文档组与视频组共用，靠 bizType 分流）。
 *
 * 与相册分组弹窗同一套外壳：编辑只改名称（排序走拖拽），保存成功才关窗，重名由
 * DuplicateFormItem 实时预检 + 后端唯一索引兜底。分组名词跟着 bizType 走，
 * 免得在视频分组页上写着"文件分组"。
 */
export function MediaGroupFormModal({ open, record, bizType, scope, onClose }: MediaGroupFormModalProps) {
  const createMutation = useCreateFileGroup(bizType, scope, open);
  const renameMutation = useRenameFileGroup(bizType, scope, open);
  const { capture } = useValidationSession(open, `${bizType}:${scope}:${record?.id ?? 'new'}`);

  const noun = bizType === 'video' ? '视频分组' : '文件分组';

  return (
    <FormModal<MediaGroupFormValues>
      key={`${bizType}:${scope}:${record?.id ?? 'new'}`}
      open={open}
      title={record ? `重命名${noun}` : `新建${noun}`}
      initialValues={record ? { name: record.name } : undefined}
      onSubmit={async (values) => {
        const isCurrent = capture();
        const name = values.name.trim();
        try {
          if (record) {
            await renameMutation.mutateAsync({ id: record.id, name });
          } else {
            await createMutation.mutateAsync(name);
          }
          if (isCurrent()) onClose();
        } catch {
          // useFileGroupMutation 已把后端中文提示弹出来了；失败留着窗口便于改完再存
        }
      }}
      confirmLoading={createMutation.isPending || renameMutation.isPending}
      onClose={onClose}
    >
      <DuplicateFormItem
        name="name"
        label="分组名称"
        active={open}
        duplicate={{ kind: 'FILE_GROUP', scope, bizType, excludeId: record?.id }}
        rules={[{ required: true, whitespace: true, message: '请输入分组名称' }, { max: 64, message: '最多 64 个字符' }]}
      >
        <Input placeholder={bizType === 'video' ? '例如：旅行视频 / 宝宝日常' : '例如：合同证件 / 学习资料'} autoFocus />
      </DuplicateFormItem>
    </FormModal>
  );
}
