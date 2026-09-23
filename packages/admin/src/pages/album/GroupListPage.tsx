import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Card, Input, Space, Tag, Typography } from 'antd';
import { DragHandleDots2Icon } from '@radix-ui/react-icons';
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { PageShell } from '../../components/PageShell';
import { CreatorText } from '../../components/CreatorText';
import { TimeText } from '../../components/TimeText';
import { AlbumGroupFormModal } from '../../features/album/AlbumGroupFormModal';
import { AlbumGroupActions } from '../../features/album/AlbumGroupActions';
import { useAlbumGroups } from '../../features/album/useAlbumGroups';
import { useBatchUpdateGroupSort } from '../../features/album/useAlbumGroupActions';
import type { AlbumGroup, AlbumGroupScope } from '../../api/album';

/** 点卡片进哪本相册的详情页：两档各有一套路径，个人相册那条多一段 /personal */
function detailPath(scope: AlbumGroupScope, groupId: number): string {
  return scope === 'PERSONAL' ? `/album/personal/${groupId}` : `/album/${groupId}`;
}

/** 拖拽排序单项（Sortable 需要） */
function SortableGroupCard({
  group,
  scope,
  onEdit,
}: {
  group: AlbumGroup;
  scope: AlbumGroupScope;
  onEdit: (g: AlbumGroup) => void;
}) {
  const navigate = useNavigate();
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: group.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'default',
    position: 'relative' as const,
  };

  const handleClick = () => {
    if (!isDragging) {
      navigate(detailPath(scope, group.id));
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card size="small" hoverable onClick={handleClick} style={{ position: 'relative', paddingRight: 32 }}>
        {/* 拖拽句柄 - 右侧中间 */}
        <div
          {...attributes}
          {...listeners}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            cursor: 'grab',
            padding: 4,
            zIndex: 1,
            background: 'rgba(0, 0, 0, 0.04)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <DragHandleDots2Icon width={16} height={16} />
        </div>

        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          <Typography.Text strong>{group.name}</Typography.Text>
          <Space separator="·">
            {group.imageCount != null && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {group.imageCount} 张图片
              </Typography.Text>
            )}
            <CreatorText id={group.creatorId} label="添加人" />
            <TimeText value={group.createTime} label="创建" />
            <TimeText value={group.updateTime} label="修改" />
          </Space>
          {/* 阻止事件冒泡，避免触发卡片点击 */}
          <div onClick={(e) => e.stopPropagation()}>
            <AlbumGroupActions record={group} onEdit={onEdit} />
          </div>
        </Space>
      </Card>
    </div>
  );
}

interface GroupListPageProps {
  /**
   * 家庭相册（「相册分组」那一页）还是个人相册（「个人相册」那一页）。
   *
   * 两页共用这一份实现：卡片版式、拖拽排序、搜索、新建/重命名弹窗、级联删除的二次确认全一样，
   * 差别只有三处——查哪一档（服务端按 scope 分流，个人那一档另按当前账号筛）、点卡片进哪条路径、
   * 文案。卡片上的上下架开关按 `record.scope` 决定渲不渲染，见 `AlbumGroupActions`。
   */
  scope: AlbumGroupScope;
}

export function GroupListPage({ scope }: GroupListPageProps) {
  const isPersonal = scope === 'PERSONAL';
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [formState, setFormState] = useState<{ open: boolean; record: AlbumGroup | null }>({
    open: false,
    record: null,
  });

  const { data: groups, isFetching } = useAlbumGroups(keyword || undefined, scope);
  const batchSortMutation = useBatchUpdateGroupSort(scope);

  const sensors = useSensors(
    useSensor(PointerSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (!groups) return;

    const oldIndex = groups.findIndex((g) => g.id === active.id);
    const newIndex = groups.findIndex((g) => g.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newGroups = arrayMove(groups, oldIndex, newIndex);

    // 重新计算 sort：从大到小，最新的排最前
    const maxSort = Math.max(...groups.map((g) => g.sort), 0);
    const items = newGroups.map((g, idx) => ({
      id: g.id,
      sort: maxSort + 1 - idx,
    }));

    void batchSortMutation.mutate(items);
  };

  return (
    <PageShell
      title={`${isPersonal ? '个人相册' : '家庭相册'} · 相册分组`}
      actions={
        <Button type="primary" onClick={() => setFormState({ open: true, record: null })}>
          新建分组
        </Button>
      }
      toolbar={
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="搜索分组名称"
            style={{ width: 260 }}
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onSearch={(value) => {
              setKeyword(value.trim());
            }}
          />
          <Tag>{`共 ${groups?.length ?? 0} 个分组`}</Tag>
        </Space>
      }
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={groups?.map((g) => g.id) ?? []}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {groups?.map((group) => (
              <SortableGroupCard
                key={group.id}
                group={group}
                scope={scope}
                onEdit={(g) => setFormState({ open: true, record: g })}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {(!groups || groups.length === 0) && !isFetching && (
        <Typography.Text type="secondary">
          还没有分组，点右上角「新建分组」
        </Typography.Text>
      )}

      <AlbumGroupFormModal
        open={formState.open}
        record={formState.record}
        scope={scope}
        onClose={() => setFormState({ open: false, record: null })}
      />
    </PageShell>
  );
}
