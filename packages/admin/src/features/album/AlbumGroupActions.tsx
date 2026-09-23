import { Button, Popconfirm, Space } from 'antd';
import type { AlbumGroup } from '../../api/album';
import { useDeleteAlbumGroup } from './useAlbumGroupActions';
import { AlbumGroupStatusSwitch } from './AlbumGroupStatusSwitch';

interface AlbumGroupActionsProps {
  record: AlbumGroup;
  onEdit: (record: AlbumGroup) => void;
}

/**
 * 分组卡片的状态位与操作按钮组：上下架开关排第一枚，然后重命名、删除。
 *
 * 与图片卡片那一排同一口径（可切换的状态就放在状态那一排的第一枚）。
 *
 * 删除会级联删除其下全部图片（含物理删文件），必须强二次确认并显示图片数；下架只是让相册在 C 端消失。
 *
 * 个人分组沿用既有的无上下架开关交互。
 *
 * 确认文案跟着两档各自的措辞走：这一份组件被「相册分组」和「个人相册」两页共用，
 * 在个人相册那一页上问"确定要删除这个分组吗"会让人怀疑自己删的是不是家庭相册。
 */
export function AlbumGroupActions({ record, onEdit }: AlbumGroupActionsProps) {
  const deleteMutation = useDeleteAlbumGroup(record.scope);
  const isPersonal = record.scope === 'PERSONAL';
  const noun = isPersonal ? '个人相册' : '分组';

  return (
    <Space wrap>
      {record.scope !== 'PERSONAL' && <AlbumGroupStatusSwitch groupId={record.id} status={record.status} scope={record.scope} />}
      <Button size="small" onClick={() => onEdit(record)}>
        重命名
      </Button>
      <Popconfirm
        title={`确定要删除这个${noun}吗？`}
        description={`删除后，${isPersonal ? '这本相册里的' : '该分组下的'}所有图片及其物理文件都会被永久删除，无法恢复。`}
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
