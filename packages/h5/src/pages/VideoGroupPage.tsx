import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { listVideoGroups, type VideoGroup, type VideoScope } from '../api/video';
import { VideoUploadSheet } from '../components/VideoUploadSheet';
import { useToast } from '../utils/toast';
import './VideoPage.css';

/**
 * C 端"看视频"第一级：视频分组卡片（家庭 / 私人按 scope 参数化，与相册页 AlbumPage 同一手法）。
 *
 * 第一张固定是「全部视频」——未分组的视频只在"全部"里能看见（上传时分组可留空），
 * 所以这一张必须在，否则那些视频在 C 端就再也点不到了；其余一张卡一个分组，点进去看这一组的视频。
 * 视频没有缩略图，卡片沿用视频卡那套：左侧一块 ▶ 角标，右侧分组名 + "共 N 支"，不假装有封面。
 *
 * 右上角「上传」是这一页的写入口（与相册页同一口径）：一次传一支，分组可选多个现有分组、也可不选（=未分组）；
 * C 端不能新增分组。上传成功后重拉分组卡片（各分组的"共 N 支"随之更新）。
 *
 * 卡片样式直接复用 VideoPage.css 的 fh-video__*，不再单开一份（两级长得一样，只是点进去的内容不同）。
 */
export function VideoGroupPage({ scope = 'PUBLIC' }: { scope?: VideoScope }) {
  const navigate = useNavigate();
  const isPrivate = scope === 'PRIVATE';
  const basePath = isPrivate ? '/video/personal' : '/video';
  const [groups, setGroups] = useState<VideoGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const { toast, showToast } = useToast();

  const loadGroups = useCallback(() => {
    listVideoGroups(scope)
      .then(setGroups)
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : '加载失败');
      });
  }, [scope]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    listVideoGroups(scope)
      .then((list) => {
        if (!cancelled) setGroups(list);
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

  const badge = (
    <span className="fh-video__badge" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" focusable="false">
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );

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
        <button
          type="button"
          className="fh-video__upload"
          onClick={() => setUploading(true)}
        >
          上传
        </button>
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
      ) : (
        <main className="fh-video__list">
          {/* 全部视频：未分组的也只在这里能看见，所以恒定排在第一张 */}
          <button
            type="button"
            className="fh-video__card"
            onClick={() => navigate(`${basePath}/all`)}
          >
            {badge}
            <span className="fh-video__meta">
              <span className="fh-video__name">全部视频</span>
              <span className="fh-video__sub">含未分组</span>
            </span>
          </button>
          {groups.map((group) => (
            <button
              type="button"
              key={group.groupId}
              className="fh-video__card"
              onClick={() => navigate(`${basePath}/${group.groupId}`)}
            >
              {badge}
              <span className="fh-video__meta">
                <span className="fh-video__name">{group.name}</span>
                <span className="fh-video__sub">共 {group.videoCount} 支</span>
              </span>
            </button>
          ))}
        </main>
      )}

      {uploading && (
        <VideoUploadSheet
          scope={scope}
          onClose={() => setUploading(false)}
          onUploaded={(summary) => {
            setUploading(false);
            showToast(summary);
            loadGroups();
          }}
        />
      )}

      {toast && <div className="fh-video__toast">{toast}</div>}
    </div>
  );
}
