import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { formatFileSize } from '@family-home/shared/format';
import { listVideos, type VideoItem, type VideoScope } from '../api/video';
import './VideoPage.css';

/**
 * C 端"看视频"页（家庭视频 / 私人视频按 scope 参数化，与相册页 AlbumPage 同一手法）。
 *
 * 只读：一支视频一张卡，卡片左侧是播放角标（视频不落缩略图，所以不假装有图，用一个 ▶ 占位），
 * 右侧是名字 + "类型 · 大小"。点卡片开一层手写全屏浮层播放——用原生 {@code <video controls>}，
 * 不引播放器组件库（h5 一贯"UI 全部手写 fh-* 样式"，口径同相册详情那层手写的图片预览浮层）。
 * 浮层里支持左右切上一支/下一支（"选集"），到头到尾不越界，点空白或 Esc 关闭。
 *
 * 播放地址带 6 小时签名票据，随列表下发；票据过期后回列表页重进即换新（挂载 effect 会重拉列表）。
 * 移动端原生控件本身就带 播放/暂停、进度条拖动、快进、全屏、倍速，够"看视频"用，无需自绘。
 */
export function VideoPage({ scope = 'PUBLIC' }: { scope?: VideoScope }) {
  const navigate = useNavigate();
  const isPrivate = scope === 'PRIVATE';
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  /** 播放下标；null = 浮层没打开。与 videos 数组一一对应 */
  const [playIndex, setPlayIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    listVideos(scope)
      .then((list) => {
        if (!cancelled) setVideos(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  /** 翻到上一支 / 下一支；到头到尾都不越界（只有 1 支时不显示切换按钮） */
  const step = (index: number | null, delta: number): number | null => {
    if (index === null) return index;
    const next = index + delta;
    return next < 0 || next >= videos.length ? index : next;
  };

  useEffect(() => {
    if (playIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlayIndex(null);
      if (e.key === 'ArrowLeft') setPlayIndex((i) => step(i, -1));
      if (e.key === 'ArrowRight') setPlayIndex((i) => step(i, 1));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playIndex, videos.length]);

  const current = playIndex !== null ? videos[playIndex] : undefined;

  return (
    <div className="fh-video">
      <header className="fh-video__header">
        <button
          type="button"
          className="fh-video__back"
          onClick={() => navigate('/')}
        >
          ‹
        </button>
        <h1 className="fh-video__title">{isPrivate ? '私人视频' : '家庭视频'}</h1>
      </header>

      {loading ? (
        <div className="fh-video__state">加载中…</div>
      ) : loadError ? (
        <div className="fh-video__state">
          <p>{loadError}</p>
          <button
            type="button"
            className="fh-video__retry"
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </div>
      ) : videos.length === 0 ? (
        <div className="fh-video__state">
          {isPrivate
            ? '还没有私人视频，先在管理后台上传个人视频吧'
            : '还没有视频，先在管理后台上传几支视频吧'}
        </div>
      ) : (
        <main className="fh-video__list">
          {videos.map((video, index) => (
            <button
              type="button"
              key={video.id}
              className="fh-video__card"
              onClick={() => setPlayIndex(index)}
            >
              <span className="fh-video__badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" focusable="false">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span className="fh-video__meta">
                <span className="fh-video__name">{video.name}</span>
                <span className="fh-video__sub">
                  {video.fileType} · {formatFileSize(video.fileSize)}
                </span>
              </span>
            </button>
          ))}
        </main>
      )}

      {current && (
        <div
          className="fh-video__player"
          onClick={() => setPlayIndex(null)}
          role="dialog"
          aria-label="视频播放"
        >
          <button
            type="button"
            className="fh-video__player-close"
            onClick={() => setPlayIndex(null)}
          >
            ×
          </button>
          <div className="fh-video__player-title">{current.name}</div>
          {videos.length > 1 && (
            <button
              type="button"
              className="fh-video__player-nav fh-video__player-nav--prev"
              onClick={(e) => {
                e.stopPropagation();
                setPlayIndex((i) => step(i, -1));
              }}
            >
              ‹
            </button>
          )}
          {/* key=current.id：切集时强制重挂 <video>，干净地换源重新加载（同 admin 播放器依赖 src 变化重建的思路） */}
          <video
            key={current.id}
            className="fh-video__player-video"
            src={current.playUrl}
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
          />
          {videos.length > 1 && (
            <button
              type="button"
              className="fh-video__player-nav fh-video__player-nav--next"
              onClick={(e) => {
                e.stopPropagation();
                setPlayIndex((i) => step(i, 1));
              }}
            >
              ›
            </button>
          )}
          {videos.length > 1 && (
            <div className="fh-video__player-count">
              {(playIndex ?? 0) + 1} / {videos.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
