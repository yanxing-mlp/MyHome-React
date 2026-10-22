import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Card, Input, Space, Tag, Typography } from 'antd';
import { DragHandleDots2Icon } from '@radix-ui/react-icons';
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { can, PERMISSION, useCurrentUser } from '@family-home/shared/auth';

import { PageShell } from '../../components/PageShell';
import { CreatorText } from '../../components/CreatorText';
import { TimeText } from '../../components/TimeText';
import { MediaGroupFormModal } from '../../features/file/MediaGroupFormModal';
import { MediaGroupActions } from '../../features/file/MediaGroupActions';
import { useFileGroups, useBatchUpdateFileGroupSort } from '../../features/file/useFileGroups';
import type { FileGroup, FileGroupBizType } from '../../api/fileGroup';
import type { DataScope } from '../../lib/http';

/** 点卡片进哪个分组详情页：文件/视频各一套路径，私人那一档路径段是 private */
function detailPath(bizType: FileGroupBizType, scope: DataScope, groupId: number): string {
  const base = bizType === 'video' ? '/video' : '/file';
  const seg = scope === 'PRIVATE' ? 'private' : 'public';
  return `${base}/${seg}/group/${groupId}`;
}

function SortableGroupCard({
  group,
  bizType,
  scope,
  canManage,
  onEdit,
}: {
  group: FileGroup;
  bizType: FileGroupBizType;
  scope: DataScope;
  canManage: boolean;
  onEdit: (g: FileGroup) => void;
}) {
  const navigate = useNavigate();
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
  };

  const noun = bizType === 'video' ? '支视频' : '个文件';

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        size="small"
        hoverable
        onClick={() => { if (!isDragging) navigate(detailPath(bizType, scope, group.id)); }}
        style={{ position: 'relative', paddingRight: canManage ? 32 : undefined }}
      >
        {canManage && (
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
        )}

        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          <Typography.Text strong>{group.name}</Typography.Text>
          <Space separator="·">
            {group.fileCount != null && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {group.fileCount} {noun}
              </Typography.Text>
            )}
            <CreatorText id={group.creatorId} label="添加人" />
            <TimeText value={group.createTime} label="创建" />
          </Space>
          <div onClick={(e) => e.stopPropagation()}>
            <MediaGroupActions record={group} bizType={bizType} scope={scope} onEdit={onEdit} />
          </div>
        </Space>
      </Card>
    </div>
  );
}

interface MediaGroupListPageProps {
  /** 文档分组还是视频分组（后端同一张 file_group 表，靠 bizType 分流） */
  bizType: FileGroupBizType;
  /** 公共 / 私人：与文件、视频本身的分区同一口径 */
  scope: DataScope;
}

/**
 * 文件/视频分组列表页（两域四种组合共用一份实现）。
 *
 * 与相册分组页同构：卡片版式、拖拽排序、搜索、新建/重命名弹窗全一样；差别只有两处——
 * 没有上下架开关（文件/视频分组删除即物理删），以及点卡片进的是文件/视频列表而非图片网格。
 */
export function MediaGroupListPage({ bizType, scope }: MediaGroupListPageProps) {
  const navigate = useNavigate();
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [formState, setFormState] = useState<{ open: boolean; record: FileGroup | null }>({ open: false, record: null });

  const user = useCurrentUser();
  // 普通成员只读浏览：没有对应管理权（视频→VIDEO_MANAGE，文件→FILE_MANAGE）就不能新建/重命名/删除/拖拽。
  const canManage = can(user, bizType === 'video' ? PERMISSION.VIDEO_MANAGE : PERMISSION.FILE_MANAGE);

  const { data: groups, isFetching } = useFileGroups(bizType, scope, keyword || undefined);
  const batchSortMutation = useBatchUpdateFileGroupSort(bizType, scope);

  const sensors = useSensors(useSensor(PointerSensor));
  const isVideo = bizType === 'video';
  const title = `${scope === 'PRIVATE' ? '私人' : '公共'}${isVideo ? '视频' : '文件'}分组`;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !groups) return;

    const oldIndex = groups.findIndex((g) => g.id === active.id);
    const newIndex = groups.findIndex((g) => g.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(groups, oldIndex, newIndex);
    const maxSort = Math.max(...groups.map((g) => g.sort), 0);
    const items = reordered.map((g, idx) => ({ id: g.id, sort: maxSort + 1 - idx }));
    void batchSortMutation.mutate(items);
  };

  return (
    <PageShell
      title={title}
      actions={
        <Space wrap>
          <Button onClick={() => navigate(scope === 'PRIVATE'
            ? (isVideo ? '/video/private' : '/file/private')
            : (isVideo ? '/video/public' : '/file/public'))}>
            全部{isVideo ? '视频' : '文件'}
          </Button>
          {canManage && (
            <Button type="primary" onClick={() => setFormState({ open: true, record: null })}>
              新建分组
            </Button>
          )}
        </Space>
      }
      toolbar={
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="搜索分组名称"
            style={{ width: 260 }}
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onSearch={(value) => setKeyword(value.trim())}
          />
          <Tag>{`共 ${groups?.length ?? 0} 个分组`}</Tag>
        </Space>
      }
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={groups?.map((g) => g.id) ?? []}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {groups?.map((group) => (
              <SortableGroupCard
                key={group.id}
                group={group}
                bizType={bizType}
                scope={scope}
                canManage={canManage}
                onEdit={(g) => setFormState({ open: true, record: g })}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {(!groups || groups.length === 0) && !isFetching && (
        <Typography.Text type="secondary">{canManage ? '还没有分组，点右上角「新建分组」' : '还没有分组'}</Typography.Text>
      )}

      <MediaGroupFormModal
        open={formState.open}
        record={formState.record}
        bizType={bizType}
        scope={scope}
        onClose={() => setFormState({ open: false, record: null })}
      />
    </PageShell>
  );
}
