import { useState } from 'react';
import { Button, Card, Checkbox, Empty, Image, Popconfirm, Space, Tag, Typography, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { PageShell } from '../../components/PageShell';
import { CreatorText } from '../../components/CreatorText';
import { TimeText } from '../../components/TimeText';
import { useAlbumGroups } from '../../features/album/useAlbumGroups';
import { useAlbumImages } from '../../features/album/useAlbumImages';
import { useToggleAlbumImagePin, useDeleteAlbumImage, useBatchDeleteAlbumImages } from '../../features/album/useAlbumImageActions';
import { AlbumImageStatusSwitch } from '../../features/album/AlbumImageStatusSwitch';
import { ImageUploadModal } from '../../features/album/ImageUploadModal';
import { ImageEditModal } from '../../features/album/ImageEditModal';
import { getStorageInfo } from '../../api/album';
import type { AlbumGroupScope } from '../../api/album';

const PAGE_SIZE = 20;

interface ImageGridPageProps {
  /** 路由确定范围，分组、图片及上传候选均只查这一域。 */
  scope: AlbumGroupScope;
}

export function ImageGridPage({ scope }: ImageGridPageProps) {
  const { groupId } = useParams<{ groupId: string }>();
  // 非法分组 URL 不发图片请求，也不给上传入口。
  const parsedGroupId = groupId ? Number(groupId) : undefined;
  const fixedGroupId = parsedGroupId != null && Number.isSafeInteger(parsedGroupId) && parsedGroupId > 0 ? parsedGroupId : undefined;
  const [pageNo, setPageNo] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingImageId, setEditingImageId] = useState<number | null>(null);
  const [editingCity, setEditingCity] = useState<string | undefined>(undefined);

  const { data: storageInfo } = useQuery({
    queryKey: ['storage-info'],
    queryFn: getStorageInfo,
  });

  // 标题就是这本相册的名字（与 C 端详情页 h1 同一口径）。复用分组列表查询，不为一个标题新开接口；
  // 下架的相册也查得到（`list()` 只排 DELETED），所以管下架相册时标题同样是它的名字而不是兜底文案。
  // 读的是自己那一档：家庭那一页拿不到私人相册的名字，反之亦然——别人的私人相册本来也不该在这里显名。
  const { data: groups } = useAlbumGroups(undefined, scope);
  const group = groups?.find((g) => g.id === fixedGroupId);

  const { data, isFetching } = useAlbumImages({
    scope,
    groupId: fixedGroupId,
    pageNo,
    pageSize: PAGE_SIZE,
  }, fixedGroupId != null);

  const togglePinMutation = useToggleAlbumImagePin(scope);
  const deleteMutation = useDeleteAlbumImage(scope);
  const batchDeleteMutation = useBatchDeleteAlbumImages(scope);

  const handleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((i) => i !== id)));
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await batchDeleteMutation.mutateAsync(selectedIds);
      setSelectedIds([]);
    } catch {
      // 错误由 mutation 提示，失败时保留勾选便于重试。
    }
  };

  return (
    <PageShell
      title={group?.name ?? (scope === 'PERSONAL' ? '个人相册' : '相册图片')}
      actions={
        <Space wrap>
          {selectedIds.length > 0 && (
            <Popconfirm
              title={`确定要删除选中的 ${selectedIds.length} 张图片吗？`}
              description="删除后，这些图片及其物理文件都会被永久删除，无法恢复。"
              okText="确定删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => void handleBatchDelete()}
            >
              <Button danger loading={batchDeleteMutation.isPending}>
                批量删除 ({selectedIds.length})
              </Button>
            </Popconfirm>
          )}
          <Button type="primary" disabled={!group} onClick={() => setUploadOpen(true)}>
            上传图片
          </Button>
        </Space>
      }
      toolbar={
        <Space wrap>
          <Tag>{`共 ${data?.total ?? 0} 张图片`}</Tag>
          {storageInfo && (
            <Tooltip
              title={
                <Space orientation="vertical" size={4}>
                  <Typography.Text style={{ color: '#fff' }}>
                    <Typography.Text strong style={{ color: '#fff' }}>相册根目录：</Typography.Text>
                    {storageInfo.rootDirectory}
                  </Typography.Text>
                  <Typography.Text style={{ color: '#fff' }}>
                    <Typography.Text strong style={{ color: '#fff' }}>访问前缀：</Typography.Text>
                    {storageInfo.urlPrefix}
                  </Typography.Text>
                  <Typography.Text style={{ color: '#fff' }}>
                    <Typography.Text strong style={{ color: '#fff' }}>目录结构：</Typography.Text>
                    {storageInfo.structure}
                  </Typography.Text>
                  {groupId && (
                    <Typography.Text type="secondary" style={{ color: 'rgba(255,255,255,0.65)' }}>
                      当前分组 ID：{groupId}，图片存储在 {storageInfo.rootDirectory}/yyyy/MM/dd/ 下
                    </Typography.Text>
                  )}
                </Space>
              }
            >
              <QuestionCircleOutlined style={{ cursor: 'pointer', fontSize: 16 }} />
            </Tooltip>
          )}
        </Space>
      }
    >
      {!isFetching && !data?.list?.length && (
        <Empty description={group ? '还没有图片，点右上角「上传图片」' : '相册不存在或不可访问'} />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        {data?.list?.map((image) => (
          <Card
            key={image.id}
            size="small"
            cover={<Image src={image.thumbUrl || image.url} alt="" style={{ width: '100%', height: 200, objectFit: 'cover' }} />}
            extra={
              <Checkbox
                checked={selectedIds.includes(image.id)}
                onChange={(e) => handleSelect(image.id, e.target.checked)}
              />
            }
          >
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <Space wrap>
                <AlbumImageStatusSwitch imageId={image.id} status={image.status} scope={scope} />
                {image.city && <Tag color="blue">{image.city}</Tag>}
                {image.pinned === 1 && <Tag color="gold">置顶</Tag>}
              </Space>
              {image.createTime && (
                <Space separator="·">
                  <CreatorText id={image.creatorId} label="添加人" />
                  <TimeText value={image.createTime} label="上传" />
                </Space>
              )}
              <Space wrap>
                <Button
                  size="small"
                  onClick={() => {
                    setEditingImageId(image.id);
                    setEditingCity(image.city);
                    setEditOpen(true);
                  }}
                >
                  编辑
                </Button>
                <Button
                  size="small"
                  onClick={() => void togglePinMutation.mutate({ id: image.id, pinned: image.pinned === 0 })}
                >
                  {image.pinned === 1 ? '取消置顶' : '置顶'}
                </Button>
                <Popconfirm
                  title="确定要删除这张图片吗？"
                  description="删除后，该图片及其物理文件都会被永久删除，无法恢复。"
                  okText="确定删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => void deleteMutation.mutate(image.id)}
                >
                  <Button size="small" danger loading={deleteMutation.isPending}>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            </Space>
          </Card>
        ))}
      </div>

      {data?.list && data.list.length > 0 && (
        <Space style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <Typography.Text type="secondary">
            第 {pageNo} / {Math.ceil(data.total / PAGE_SIZE)} 页
          </Typography.Text>
          <Button
            disabled={pageNo <= 1}
            onClick={() => setPageNo((p) => p - 1)}
          >
            上一页
          </Button>
          <Button
            disabled={pageNo >= Math.ceil(data.total / PAGE_SIZE)}
            onClick={() => setPageNo((p) => p + 1)}
          >
            下一页
          </Button>
        </Space>
      )}

      <ImageUploadModal
        key={`upload-${uploadOpen}`}
        scope={scope}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        fixedGroupId={fixedGroupId}
      />

      {/* 图片编辑弹窗 */}
      <ImageEditModal
        key={`edit-${editingImageId}-${editOpen}`}
        scope={scope}
        open={editOpen}
        imageId={editingImageId}
        currentCity={editingCity}
        onClose={() => {
          setEditOpen(false);
          setEditingImageId(null);
          setEditingCity(undefined);
        }}
        onSuccess={() => {
          // React Query 会自动刷新
        }}
      />
    </PageShell>
  );
}
