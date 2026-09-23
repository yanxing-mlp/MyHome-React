import { useState, useEffect } from 'react';
import { Button, Card, Checkbox, Empty, Image, Popconfirm, Select, Space, Tag, Typography, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';

import { PageShell } from '../../components/PageShell';
import { CreatorText } from '../../components/CreatorText';
import { TimeText } from '../../components/TimeText';
import { useAlbumImages } from '../../features/album/useAlbumImages';
import { useToggleAlbumImagePin, useDeleteAlbumImage, useBatchDeleteAlbumImages } from '../../features/album/useAlbumImageActions';
import { AlbumImageStatusSwitch } from '../../features/album/AlbumImageStatusSwitch';
import { ImageUploadModal } from '../../features/album/ImageUploadModal';
import { ImageEditModal } from '../../features/album/ImageEditModal';
import { getStorageInfo, type AlbumGroupScope } from '../../api/album';
import { useAlbumGroups, useAlbumCities } from '../../features/album/useAlbumGroups';

const PAGE_SIZE = 20;

export function AllImagesPage({ scope }: { scope: AlbumGroupScope }) {
  const [pageNo, setPageNo] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingImageId, setEditingImageId] = useState<number | null>(null);
  const [editingCity, setEditingCity] = useState<string | undefined>(undefined);
  const [filterGroupId, setFilterGroupId] = useState<number | undefined>(undefined);
  const [filterCity, setFilterCity] = useState<string | undefined>(undefined);

  const { data: storageInfo } = useQuery({
    queryKey: ['storage-info'],
    queryFn: getStorageInfo,
  });

  const { data: groups } = useAlbumGroups(undefined, scope);
  const { data: cities } = useAlbumCities(scope);

  const { data, isFetching } = useAlbumImages({
    scope,
    groupId: filterGroupId,
    city: filterCity,
    pageNo,
    pageSize: PAGE_SIZE,
  });

  // 切换筛选时重置页码和勾选，避免对已隐藏的图片执行批量操作。
  useEffect(() => {
    setPageNo(1);
    setSelectedIds([]);
  }, [filterGroupId, filterCity]);

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

  const getGroupName = (groupId: number) => {
    const group = groups?.find((g) => g.id === groupId);
    return group?.name ?? `分组${groupId}`;
  };

  return (
    <PageShell
      title={`${scope === 'PERSONAL' ? '个人相册' : '家庭相册'} · 图片管理`}
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
          <Button type="primary" onClick={() => setUploadOpen(true)}>
            上传图片
          </Button>
        </Space>
      }
      toolbar={
        <Space wrap>
          <Tag>{`共 ${data?.total ?? 0} 张图片`}</Tag>
          <Select
            allowClear
            placeholder="按分组筛选"
            style={{ width: 180 }}
            value={filterGroupId}
            onChange={setFilterGroupId}
            options={groups?.map((g) => ({ label: g.name, value: g.id }))}
          />
          <Select
            allowClear
            placeholder="按城市筛选"
            showSearch
            style={{ width: 180 }}
            value={filterCity}
            onChange={setFilterCity}
            options={cities?.map((c) => ({ label: c.city, value: c.city }))}
          />
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
                </Space>
              }
            >
              <QuestionCircleOutlined style={{ cursor: 'pointer', fontSize: 16 }} />
            </Tooltip>
          )}
        </Space>
      }
    >
      {!isFetching && (!data || !data.list || data.list.length === 0) && (
        <Empty description="还没有图片，点右上角「上传图片」" />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        {data?.list && data.list.map((image) => (
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
                {image.groupIds.map((groupId) => (
                  <Tag key={groupId} color="purple">{getGroupName(groupId)}</Tag>
                ))}
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
            第 {pageNo} / {Math.ceil((data.total || 0) / PAGE_SIZE)} 页
          </Typography.Text>
          <Button
            disabled={pageNo <= 1}
            onClick={() => setPageNo((p) => p - 1)}
          >
            上一页
          </Button>
          <Button
            disabled={pageNo >= Math.ceil((data.total || 0) / PAGE_SIZE)}
            onClick={() => setPageNo((p) => p + 1)}
          >
            下一页
          </Button>
        </Space>
      )}

      {/* 图片上传弹窗 */}
      <ImageUploadModal
        key={`upload-${uploadOpen}`}
        scope={scope}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
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
