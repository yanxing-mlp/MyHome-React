import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { listAlbumCovers, type AlbumGroupCover, type AlbumScope } from '../api/album';
import { AlbumUploadSheet } from '../components/AlbumUploadSheet';
import { useToast } from '../utils/toast';
import './AlbumPage.css';

/**
 * C 端相册页（方案 §7.3）。
 *
 * 一张卡片一个分组，卡片左侧是三张叠加的封面图（置顶图优先、其余按最新，后端算好顺序），
 * 右侧是分组名和"共 x 张"；仅家庭相册将没有关联任何分组的图片归成最后一张"其他"卡片。
 * 家庭与私人相册按 scope 分别加载卡片和上传候选分组，两种 scope 不混用。
 *
 * 三条口径：
 * - 点卡片进该相册的详情页；"其他"不是真分组，没有分组 ID，详情路由用 ungrouped 这个固定段；
 * - 只展示在架图片，下架图后端就不返回（口径同 C 端点餐页只列在架菜品），所以卡片上的张数也只是
 *   在架图的张数；分组下没有在架图时后端直接不出这张卡；
 * - 右上角"上传"是这个页的写入口：一次可以传多张，必须选**至少一个现有分组**，支持多选
 *   （C 端不能新增分组）；城市选一个或自己填。
 */
export function AlbumPage({ scope = 'FAMILY' }: { scope?: AlbumScope }) {
  const navigate = useNavigate();
  const isPersonal = scope === 'PERSONAL';
  const basePath = isPersonal ? '/album/personal' : '/album';
  const [groups, setGroups] = useState<AlbumGroupCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const { toast, showToast } = useToast();

  const loadGroups = useCallback(() => {
    listAlbumCovers(scope)
      .then(setGroups)
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : '加载失败');
      });
  }, [scope]);

  useEffect(() => {
    let cancelled = false;
    listAlbumCovers(scope)
      .then((list) => {
        if (!cancelled) setGroups(list);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  return (
    <div className="fh-album">
      <header className="fh-album__header">
        <button
          type="button"
          className="fh-album__back"
          onClick={() => navigate('/')}
        >
          ‹
        </button>
        <h1 className="fh-album__title">{isPersonal ? '私人相册' : '家庭相册'}</h1>
        <button
          type="button"
          className="fh-album__upload"
          onClick={() => setUploading(true)}
        >
          上传
        </button>
      </header>

      {loading ? (
        <div className="fh-album__state">加载中…</div>
      ) : loadError ? (
        <div className="fh-album__state">
          <p>{loadError}</p>
          <button
            type="button"
            className="fh-album__retry"
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="fh-album__state">
          {isPersonal
            ? '还没有私人相册，先在管理后台创建个人相册并上传照片吧'
            : '还没有相册，先在管理后台上传几张照片吧'}
        </div>
      ) : (
        <main className="fh-album__grid">
          {groups.map((group) => (
            <button
              type="button"
              key={group.groupId ?? 'ungrouped'}
              className="fh-album__card"
              onClick={() =>
                navigate(`${basePath}/${group.groupId ?? 'ungrouped'}`)
              }
            >
              <div className="fh-album__stack">
                {group.coverThumbUrls.map((url, index) => (
                  <img
                    key={url}
                    className={`fh-album__photo fh-album__photo--${index + 1}`}
                    src={url}
                    alt=""
                  />
                ))}
              </div>
              <div className="fh-album__info">
                <span className="fh-album__group-name">{group.name}</span>
                <span className="fh-album__count">共 {group.imageCount} 张</span>
              </div>
            </button>
          ))}
        </main>
      )}

      {uploading && (
        <AlbumUploadSheet
          scope={scope}
          onClose={() => setUploading(false)}
          onUploaded={(summary) => {
            setUploading(false);
            showToast(summary);
            loadGroups();
          }}
        />
      )}

      {toast && <div className="fh-album__toast">{toast}</div>}
    </div>
  );
}
