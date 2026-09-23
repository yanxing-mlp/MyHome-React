import { Input } from 'antd';
import { FormModal } from '../../components/FormModal';
import { DuplicateFormItem } from '../../components/DuplicateFormItem';
import { useValidationSession } from '../../hooks/useValidationSession';
import type { AlbumGroup, AlbumGroupScope } from '../../api/album';
import { useCreateAlbumGroup, useRenameAlbumGroup } from './useAlbumGroupActions';

interface AlbumGroupFormValues {
  name: string;
}

interface AlbumGroupFormModalProps {
  open: boolean;
  /** null 表示新建 */
  record: AlbumGroup | null;
  onClose: () => void;
  /** 新建和重命名均使用页面所属范围，不能跨域操作。 */
  scope: AlbumGroupScope;
}

/**
 * 相册分组的新增 / 重命名弹窗。
 *
 * 编辑时只改名称，不涉及排序（方案 §5.3）。
 */
export function AlbumGroupFormModal({ open, record, onClose, scope }: AlbumGroupFormModalProps) {
  const createMutation = useCreateAlbumGroup(scope);
  const renameMutation = useRenameAlbumGroup(scope);
  const { capture } = useValidationSession(open, `${scope}:${record?.id ?? 'new'}`);

  const noun = '分组';

  return (
    <FormModal<AlbumGroupFormValues>
      key={`${scope}:${record?.id ?? 'new'}`}
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
            await createMutation.mutateAsync({ name });
          }
          // 成功才关窗：失败时留着窗口，用户改完直接再点保存（文案 hook 里弹过了）。
          // 不关窗的代价不只是多点一次取消 —— 外壳的重置只在 open 由 false 翻成 true 时跑，
          // 窗口一直开着再点另一张卡片的「重命名」，输入框里还是上一个名字。
          if (isCurrent()) onClose();
        } catch {
          // useApiMutation 已把后端的中文 message 弹出来了
        }
      }}
      confirmLoading={createMutation.isPending || renameMutation.isPending}
      onClose={onClose}
    >
      <DuplicateFormItem
        name="name"
        label="分组名称"
        active={open}
        duplicate={{ kind: 'ALBUM_GROUP', scope, excludeId: record?.id }}
        rules={[{ required: true, whitespace: true, message: `请输入${noun}名称` }, { max: 64, message: '最多 64 个字符' }]}
      >
        <Input placeholder="例如：春节旅行 / 宝宝成长" autoFocus />
      </DuplicateFormItem>
    </FormModal>
  );
}
