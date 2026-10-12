import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { formatFileSize } from '@family-home/shared/format';
import { listVideos, listVideoGroups, type VideoItem, type VideoScope } from '../api/video';
import { VideoUploadSheet } from '../components/VideoUploadSheet';
import { useToast } from '../utils/toast';
import './VideoPage.css';

/**
 * C 端"看视频"第二级：一个分组（或"全部"）下的视频列表（家庭 / 私人按 scope 参数化）。
 *
 * 路由 `/video/:groupId`、`/video/personal/:groupId`；`groupId='all'` 是「全部视频」（含未分组），
 * 数字则是某个分组。返回按钮回到第一级分组卡片页（`VideoGroupPage`）。
 *
 * 一支视频一张卡，卡片左侧是播放角标（视频不落缩略图，所以不假装有图，用一个 ▶ 占位），
 * 右侧是名字 + "类型 · 大小"。点卡片开一层手写全屏浮层播放——用原生 {@code <video controls>}，
 * 不引播放器组件库（h5 一贯"UI 全部手写 fh-* 样式"，口径同相册详情那层手写的图片预览浮层）。
 * 浮层里支持左右切上一支/下一支（"选集"），到头到尾不越界，点空白或 Esc 关闭。
 *
 * <p>**上传入口只给具体分组**（`groupId` 是正整数时）：进某一组里传的固定绑这一组，浮层不再显示分组选择，
 * 与相册详情页同一口径。「全部视频」（`groupId='all'`）不是一真分组、没有分组 id 可绑，这个入口在 all 下不渲染，
 * 想挑分组/传未分组的到一级页那个上传入口去。删除仍只在 B 端"视频管理"，C 端能传能看不能删。
 *
 * 播放地址带 6 小时签名票据，随列表下发；票据过期后回列表页重进即换新（挂载 effect 会重拉列表）。
 * 移动端原生控件本身就带 播放/暂停、进度条拖动、快进、全屏、倍速，够"看视频"用，无需自绘。
 */
export function VideoPage({ scope = 'PUBLIC' }: { scope?: VideoScope }) {
  const navigate = useNavigate();
  const { groupId: groupIdParam } = useParams();
  const isPrivate = scope === 'PRIVATE';
  const basePath = isPrivate ? '/video/personal' : '/video';
  // 'all' 或非数字（手敲坏的 URL）= 全部视频，不加 groupId 过滤；正整数才按分组过滤
  const parsed = Number(groupIdParam);
  const groupId =
    groupIdParam !== 'all' && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [title, setTitle] = useState('全部视频');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const { toast, showToast } = useToast();
  /** 播放下标；null = 浮层没打开。与 videos 数组一一对应 */
  const [playIndex, setPlayIndex] = useState<number | null>(null);

  // 分组名当标题：与相册详情同一手法（去分组列表里按 id 找名字），"全部"不查、直接用固定文案。
  useEffect(() => {
    if (groupId == null) {
      setTitle('全部视频');
      return;
    }
    let cancelled = false;
    listVideoGroups(scope)
      .then((groups) => {
        const matched = groups.find((g) => g.groupId === groupId);
        if (!cancelled && matched) setTitle(matched.name);
      })
      .catch(() => {
        /* 标题拿不到就用默认；列表接口自己会因分组不存在而报错 */
      });
    return () => {
      cancelled = true;
    };
  }, [scope, groupId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    listVideos(scope, groupId)
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
  }, [scope, groupId]);

  /**
   * 上传成功后原地重拉列表（数据已在屏上，不闪回"加载中…"那一屏，故只换 videos、不动 loading）。
   * 与相册详情页 refresh 同一取舍。
   */
  const refresh = useCallback(() => {
    listVideos(scope, groupId)
      .then(setVideos)
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : '加载失败');
      });
  }, [scope, groupId]);


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
          onClick={() => navigate(basePath)}
        >
          ‹
        </button>
        <h1 className="fh-video__title">{title}</h1>
        {/* 上传入口只给具体分组：往"当前这一组"里加，浮层不再显示分组选择（同相册详情页）。
            "全部视频"不是一真分组、没有分组 id 可绑，这个入口在 all 下不渲染 */}
        {groupId != null && (
          <button
            type="button"
            className="fh-video__upload"
            onClick={() => setUploading(true)}
          >
            上传
          </button>
        )}
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
          {groupId != null
            ? '这个分组还没有视频，点右上角「上传」加一支'
            : isPrivate
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

      {uploading && groupId != null && (
        <VideoUploadSheet
          scope={scope}
          fixedGroupId={groupId}
          onClose={() => setUploading(false)}
          onUploaded={(summary) => {
            setUploading(false);
            showToast(summary);
            refresh();
          }}
        />
      )}

      {toast && <div className="fh-video__toast">{toast}</div>}
    </div>
  );
}
