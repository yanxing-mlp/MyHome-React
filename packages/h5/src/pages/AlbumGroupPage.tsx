import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { listAlbumCovers, pageAlbumImages, type AlbumImage, type AlbumScope } from '../api/album';
import { AlbumUploadSheet } from '../components/AlbumUploadSheet';
import { useToast } from '../utils/toast';
import './AlbumGroupPage.css';

/** 路由里的 /album/ungrouped：它不是一个真分组，代表"其他"相册（没关联任何分组的图片） */
const UNGROUPED_KEY = 'ungrouped';

/**
 * C 端相册详情页（方案 §7.3）。
 *
 * 三列九宫格，一页 9 张；顺序由后端排好——置顶图在最前面，其余按最新。
 * 点单张图全屏预览，可以左右翻，点空白或 Esc 关闭，左上角「下载」存这张原图（下载的是 url 原图，
 * 不是九宫格里那张缩略图——预览本身也是优先用原图）。
 *
 * 预览是这里手写的一层浮层，没用 antd-mobile 的 ImageViewer：antd-mobile v5 只声明支持到 React 18，
 * `ImageViewer.Multi.show()` 这种命令式 API 在本项目（React 19）下点了没反应，只在控制台留一句
 * "[Compatible] antd-mobile v5 support React is 16 ~ 18"。C 端剩下的页面壳本来也是手写 fh-* 样式。
 *
 * 口径同相册页：只有架图片出现（status 写死 ON_SHELF），所以一个分组在 C 端要么有图、要么整卡不展示。
 * 标题走封面接口拿：理由是"其他"没有分组 ID 可查，一次接口两种相册都能覆盖到。
 *
 * 同一份封面列表还兼作**深链的门槛**（`gate`）：相册里没这张卡，就代表它在 C 端不存在——
 * 分组下架了、删了，或者一本在架图都没有（下架分组连带它的图一起从 C 端消失，但图不会掉进"其他"卡，
 * 桶是按关联表分的）。这种 URL 多半是收藏或转发来的旧链接，进得去反而会把已经收起来的相册又摊开，
 * 所以不给拉图、也不给上传入口。封面接口自己挂了时 `gate` 放开，别让一次偶发失败锁死整个相册。
 * `gate` 只控制前端入口；服务端也检查分组上下架与 PERSONAL 属主，不依赖前端门槛保障权限。
 */
export function AlbumGroupPage({ scope = 'FAMILY' }: { scope?: AlbumScope }) {
  const { groupId } = useParams();
  // 切相册时销毁上一份图片、预览和门槛状态，避免旧内容闪回。
  return <AlbumGroupContent key={`${scope}-${groupId}`} scope={scope} />;
}

function AlbumGroupContent({ scope }: { scope: AlbumScope }) {
  const navigate = useNavigate();
  const { groupId: groupIdParam } = useParams();
  const basePath = scope === 'PERSONAL' ? '/album/personal' : '/album';

  const ungrouped = scope === 'FAMILY' && groupIdParam === UNGROUPED_KEY;
  const parsed = ungrouped ? undefined : Number(groupIdParam);
  const groupId = parsed != null && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  // 既不是"其他"也不是合法分组 ID（手敲坏了的 URL）就不发请求
  const routeOk = ungrouped || groupId != null;

  /** 深链门槛：pending=封面列表还没回来；allow=有这张卡（或封面接口挂了）；deny=C 端没有这个相册 */
  const [gate, setGate] = useState<'pending' | 'allow' | 'deny'>('pending');
  const [title, setTitle] = useState('');
  const [images, setImages] = useState<AlbumImage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [pageNo, setPageNo] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const { toast, showToast } = useToast();

  useEffect(() => {
    if (!routeOk) return;
    let cancelled = false;
    listAlbumCovers(scope)
      .then((covers) => {
        const card = covers.find((cover) =>
          ungrouped ? cover.groupId === null : cover.groupId === groupId,
        );
        if (cancelled) return;
        if (card) setTitle(card.name);
        setGate(card ? 'allow' : 'deny');
      })
      .catch(() => {
        // 标题按 scope 回退；门槛放开后仍由服务端检查分组上下架与 PERSONAL 属主
        if (!cancelled) setGate('allow');
      });
    return () => {
      cancelled = true;
    };
  }, [routeOk, groupId, ungrouped, scope]);

  useEffect(() => {
    if (!routeOk || gate !== 'allow') return;
    let cancelled = false;
    setLoading(true);
    pageAlbumImages({ scope, groupId, ungrouped, pageNo: 1 })
      .then((page) => {
        if (cancelled) return;
        setImages(page.list);
        setHasMore(page.hasMore);
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
  }, [routeOk, gate, groupId, ungrouped, scope]);

  /**
   * 上传成功后原地重回第一页。
   *
   * <p>没有复用上面那个挂载 effect：那个要管"加载中…"那一屏（首次进来没数据），
   * 这里数据已经在屏上，重读时不该闪回加载态，所以只换图片列表、不动 loading。
   */
  const refresh = useCallback(() => {
    if (!routeOk) return;
    pageAlbumImages({ scope, groupId, ungrouped, pageNo: 1 })
      .then((page) => {
        setImages(page.list);
        setHasMore(page.hasMore);
        setPageNo(1);
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : '加载失败');
      });
  }, [routeOk, groupId, ungrouped, scope]);

  const loadNextPage = useCallback(() => {
    if (!routeOk || loadingMore) return;
    setLoadingMore(true);
    const next = pageNo + 1;
    pageAlbumImages({ scope, groupId, ungrouped, pageNo: next })
      .then((page) => {
        setImages((prev) => [...prev, ...page.list]);
        setHasMore(page.hasMore);
        setPageNo(next);
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => setLoadingMore(false));
  }, [routeOk, groupId, ungrouped, pageNo, loadingMore, scope]);

  /** 预览下标；null = 浮层没打开。跟 images 数组一一对应，所以不额外过滤空 URL */
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewUrls = images.map((image) => image.url || image.thumbUrl || '');

  /**
   * 下载当前预览这张图。
   *
   * 走 fetch → blob → `a[download]`，而不是直接给 `<a href={原图} download>`：`download` 这个属性
   * 在 iOS Safari 上对普通 http 链接基本被忽略（点了就在当前页打开图），blob: 是同源的，
   * 存到相册 / 存到"文件"都能走。代价是要先把整张原图读进内存——家庭场景的图长边压到 2560，够用了。
   *
   * 文件名取 URL 最后一段（后端给的就是 `{uuid}.jpg`，重名浏览器会自己补 `(1)`）。
   */
  const [downloading, setDownloading] = useState(false);

  const downloadCurrent = async () => {
    if (previewIndex === null || downloading) return;
    const url = previewUrls[previewIndex];
    if (!url) return;
    setDownloading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = url.split('/').pop() || 'image';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      showToast(e instanceof Error ? `下载失败：${e.message}` : '下载失败');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (previewIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewIndex(null);
      if (e.key === 'ArrowLeft') setPreviewIndex((i) => step(i, -1));
      if (e.key === 'ArrowRight') setPreviewIndex((i) => step(i, 1));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewIndex, previewUrls.length]);

  /** 翻到下一张 / 上一张；到头到尾都不越界（只有 1 张时不显示翻页按钮） */
  const step = (index: number | null, delta: number): number | null => {
    if (index === null) return index;
    const next = index + delta;
    return next < 0 || next >= previewUrls.length ? index : next;
  };

  /** 上传入口：只给真分组，而且门槛放行后才给（下架的相册连图都不给看，更不能往里传） */
  const canUpload = groupId != null && gate === 'allow';

  return (
    <div className="fh-album-detail">
      <header className="fh-album-detail__header">
        <button
          type="button"
          className="fh-album-detail__back"
          onClick={() => navigate(basePath)}
        >
          ‹
        </button>
        <h1 className="fh-album-detail__title">{title || (scope === 'PERSONAL' ? '私人相册' : '相册')}</h1>
        {/* 详情页的上传入口只往"当前这个相册"里加，所以只填城市、不给选分组；
            "其他"不是一真分组（没有分组 ID 可绑），这个入口在 ungrouped 下不渲染 */}
        {canUpload && (
          <button
            type="button"
            className="fh-album-detail__upload"
            onClick={() => setUploading(true)}
          >
            上传
          </button>
        )}
      </header>

      {!routeOk || gate === 'deny' ? (
        <div className="fh-album-detail__state">相册不存在</div>
      ) : gate === 'pending' || loading ? (
        <div className="fh-album-detail__state">加载中…</div>
      ) : images.length === 0 ? (
        <div className="fh-album-detail__state">
          {loadError && <p>{loadError}</p>}
          {loadError ? (
            <button
              type="button"
              className="fh-album-detail__retry"
              onClick={() => window.location.reload()}
            >
              重新加载
            </button>
          ) : (
            '这个相册还没有图片'
          )}
        </div>
      ) : (
        <main className="fh-album-detail__body">
          {loadError && <div className="fh-album-detail__tip">{loadError}</div>}
          <div className="fh-album-detail__grid">
            {images.map((image, index) => (
              <button
                type="button"
                key={image.id}
                className="fh-album-detail__cell"
                onClick={() => setPreviewIndex(index)}
              >
                <img
                  className="fh-album-detail__img"
                  src={image.thumbUrl || image.url}
                  alt=""
                  loading="lazy"
                />
              </button>
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              className="fh-album-detail__more"
              disabled={loadingMore}
              onClick={loadNextPage}
            >
              {loadingMore ? '加载中…' : '加载更多'}
            </button>
          )}
        </main>
      )}

      {previewIndex !== null && (
        <div
          className="fh-album-detail__viewer"
          onClick={() => setPreviewIndex(null)}
          role="dialog"
          aria-label="图片预览"
        >
          <button
            type="button"
            className="fh-album-detail__viewer-close"
            onClick={() => setPreviewIndex(null)}
          >
            ×
          </button>
          {/* 下载压在左上角，与右上角的关闭对称；点它不能顺手把浮层关掉 */}
          <button
            type="button"
            className="fh-album-detail__viewer-download"
            disabled={downloading}
            onClick={(e) => {
              e.stopPropagation();
              void downloadCurrent();
            }}
          >
            下载
          </button>
          {previewUrls.length > 1 && (
            <button
              type="button"
              className="fh-album-detail__viewer-nav fh-album-detail__viewer-nav--prev"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewIndex((i) => step(i, -1));
              }}
            >
              ‹
            </button>
          )}
          <img
            className="fh-album-detail__viewer-img"
            src={previewUrls[previewIndex]}
            alt=""
            onClick={(e) => e.stopPropagation()}
          />
          {previewUrls.length > 1 && (
            <button
              type="button"
              className="fh-album-detail__viewer-nav fh-album-detail__viewer-nav--next"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewIndex((i) => step(i, 1));
              }}
            >
              ›
            </button>
          )}
        </div>
      )}

      {uploading && canUpload && (
        <AlbumUploadSheet
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

      {toast && <div className="fh-album-detail__toast">{toast}</div>}
    </div>
  );
}
