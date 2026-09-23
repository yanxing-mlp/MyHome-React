import { useState } from 'react';
import { Button, Card, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlayCircleOutlined } from '@ant-design/icons';
import { formatFileSize } from '@family-home/shared/format';
import type { VideoItem } from '../../api/video';
import type { DataScope } from '../../lib/http';
import { PageShell } from '../../components/PageShell';
import { CreatorText } from '../../components/CreatorText';
import { TimeText } from '../../components/TimeText';
import { UploadVideoModal } from '../../features/video/UploadVideoModal';
import { VideoPlayerModal } from '../../features/video/VideoPlayerModal';
import { useDeleteVideo, useVideos } from '../../features/video/useVideos';

/**
 * 视频管理：上传的视频列表，可预览播放、可删。**不限具体格式**（mp4/mov/webm/mkv… 服务端校验）。
 *
 * 与文档同一张 file_object 表，靠 biz_type='video' 区分；分区（公共/个人）与文档、密码本一致。
 * 点「播放」打开播放弹窗，整份列表兼作选集播放列表。一期不分页：家庭量级几十支，整表返回。
 */
export function VideoListPage({ scope = 'PUBLIC' }: { scope?: DataScope }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [playId, setPlayId] = useState<number | null>(null);

  const { data, isFetching } = useVideos(scope);
  const deleteVideo = useDeleteVideo(scope);
  const videos = data ?? [];

  const columns: ColumnsType<VideoItem> = [
    {
      title: '视频名称',
      dataIndex: 'name',
      render: (name: string, record) => (
        <Button
          type="link"
          icon={<PlayCircleOutlined />}
          style={{ padding: 0, whiteSpace: 'normal', textAlign: 'left', height: 'auto' }}
          onClick={() => setPlayId(record.id)}
        >
          {name}
        </Button>
      ),
    },
    {
      title: '格式',
      dataIndex: 'fileType',
      width: 100,
      render: (type: string) => (type ? <Tag>{type}</Tag> : null),
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      width: 110,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '添加人',
      dataIndex: 'creatorId',
      width: 110,
      render: (id?: number | null) => <CreatorText id={id} />,
    },
    {
      title: '上传时间',
      dataIndex: 'createTime',
      width: 170,
      render: (time: string) => <TimeText value={time} />,
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => setPlayId(record.id)}>
            播放
          </Button>
          <Popconfirm
            title="删除这个视频？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => deleteVideo.mutate(record.id)}
          >
            <Button type="link" danger size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageShell
      title={scope === 'PRIVATE' ? '个人视频' : '公共视频'}
      actions={
        <Button type="primary" onClick={() => setUploadOpen(true)}>
          上传视频
        </Button>
      }
      toolbar={
        <Typography.Text type="secondary">共 {videos.length} 支视频</Typography.Text>
      }
    >
      <Card variant="borderless">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={videos}
          loading={isFetching}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: '还没有视频，点右上角「上传视频」' }}
        />
      </Card>

      {uploadOpen && <UploadVideoModal scope={scope} open onClose={() => setUploadOpen(false)} />}
      {playId != null && (
        <VideoPlayerModal
          open
          videos={videos}
          initialId={playId}
          onClose={() => setPlayId(null)}
        />
      )}
    </PageShell>
  );
}
