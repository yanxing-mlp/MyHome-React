import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Space } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { formatFileSize } from '@family-home/shared/format';
import type { VideoItem } from '../../api/video';
import { resolvePlayUrl } from '../../api/video';
import { VideoPlayer } from './VideoPlayer';

interface VideoPlayerModalProps {
  open: boolean;
  /** 当前分区下的全部视频，兼作「选集」播放列表 */
  videos: VideoItem[];
  /** 打开时选中的视频 id */
  initialId?: number;
  onClose: () => void;
}

/**
 * 视频播放弹窗。
 *
 * 「选集」= 把当前分区的视频列表当播放列表：左侧一列可点，右侧上一支/下一支，
 * 切换即把新的 playUrl 交给播放器（VideoPlayer 依赖 src 变化重建）。
 * 播放地址带短时签名票据，票据随列表返回、6 小时过期，过期后重新打开列表即刷新。
 */
export function VideoPlayerModal({ open, videos, initialId, onClose }: VideoPlayerModalProps) {
  const [currentId, setCurrentId] = useState<number | undefined>(initialId);

  // 打开或 initialId 变化时同步选中项。
  useEffect(() => {
    if (open) setCurrentId(initialId ?? videos[0]?.id);
  }, [open, initialId]);

  const index = useMemo(
    () => videos.findIndex((v) => v.id === currentId),
    [videos, currentId],
  );
  const current = index >= 0 ? videos[index] : undefined;

  const go = (delta: number) => {
    if (index < 0) return;
    const next = (index + delta + videos.length) % videos.length;
    setCurrentId(videos[next]?.id);
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      title={current ? current.name : '播放视频'}
      footer={null}
      width={960}
      onCancel={onClose}
      destroyOnHidden
    >
      <Space orientation="horizontal" size={16} align="start" style={{ width: '100%' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {current && (
            <VideoPlayer src={resolvePlayUrl(current.playUrl)} title={current.name} height={420} />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <Button
              icon={<LeftOutlined />}
              disabled={videos.length < 2}
              onClick={() => go(-1)}
            >
              上一支
            </Button>
            <span style={{ alignSelf: 'center', color: 'rgba(0,0,0,0.45)' }}>
              {index >= 0 ? `${index + 1} / ${videos.length}` : ''}
            </span>
            <Button
              icon={<RightOutlined />}
              iconPosition="end"
              disabled={videos.length < 2}
              onClick={() => go(1)}
            >
              下一支
            </Button>
          </div>
        </div>

        {videos.length > 1 && (
          <div style={{ width: 200, maxHeight: 480, overflowY: 'auto', flexShrink: 0 }}>
            {videos.map((v, i) => (
              <div
                key={v.id}
                onClick={() => setCurrentId(v.id)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: v.id === currentId ? 'rgba(22,119,255,0.1)' : 'transparent',
                  color: v.id === currentId ? '#1677ff' : undefined,
                  marginBottom: 4,
                }}
              >
                <div style={{ fontWeight: v.id === currentId ? 600 : 400, fontSize: 13, lineHeight: '18px' }}>
                  {i + 1}. {v.name}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                  {formatFileSize(v.fileSize)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Space>
    </Modal>
  );
}
