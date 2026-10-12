import { useEffect, useRef, useState } from 'react';
import { formatFileSize } from '@family-home/shared/format';
import { getCurrentUserId } from '@family-home/shared/auth';
import { listVideoGroups, uploadVideo, type VideoGroup, type VideoScope } from '../api/video';
import './VideoUploadSheet.css';

interface VideoUploadSheetProps {
  scope?: VideoScope;
  /**
   * 二级页（具体分组）进来时分组已经定了：不显示分组选择，只传到这一组。
   * 一级页（分组卡片页）进来不传，让用户可选多个现有分组——也可以一个都不选（=未分组）。
   */
  fixedGroupId?: number;
  onClose: () => void;
  /** 上传成功后回调，参数是给页面 toast 的一句话（组件自己会关掉，所以 toast 由页面渲染） */
  onUploaded: (summary: string) => void;
}

/**
 * C 端视频上传浮层（一级分组页 / 二级具体分组页共用一个组件，仿相册的 AlbumUploadSheet）。
 *
 * 与相册上传的三处差异，都是照着"视频"这件事本身的口径来的：
 * - **一次一支**：视频几百 MB，不像照片那样成批选；要再传一支就重新打开浮层。
 * - **原样上传、不做任何前端处理**：视频不转码、不压缩（后端流式落盘、按扩展名校验，非视频 415），
 *   所以这里没有相册那套 exifr 提 EXIF + canvas 转 JPEG，选中即传。
 * - **分组可选、留空=未分组**：与 B 端视频上传一致（相册 C 端上传则要求必选至少一个分组）。
 *   未分组的视频只在一级页那张恒定的「全部视频」卡里能看见。
 *
 * <p>**C 端不能新增分组**（同相册），所以分组那排只有已有分组的 chip，没有"+ 新增"入口。
 * 上传成功后不回滚已传文件；停在浮层里让用户看到是哪一步挂的（家庭场景重试代价低）。
 */
export function VideoUploadSheet({
  scope = 'PUBLIC',
  fixedGroupId,
  onClose,
  onUploaded,
}: VideoUploadSheetProps) {
  const [file, setFile] = useState<File | null>(null);
  const [groups, setGroups] = useState<VideoGroup[]>([]);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const active = useRef(false);
  const userId = useRef(getCurrentUserId());

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const ensureActive = () => {
    if (!active.current || getCurrentUserId() !== userId.current) {
      throw new Error('上传已取消');
    }
  };

  // 候选分组每次打开都重取（别人可能刚在 B 端加了组），失败只留一句提示、不挡上传。
  // 二级页进来分组已定，不查候选。
  useEffect(() => {
    if (fixedGroupId != null) return;
    let cancelled = false;
    listVideoGroups(scope)
      .then((list) => {
        if (!cancelled) setGroups(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setHint(e instanceof Error ? e.message : '分组列表加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, [fixedGroupId, scope]);

  const pickFile = () => inputRef.current?.click();

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = ''; // 同一支视频第二次也要能再选上
    if (!picked) return;
    setFile(picked);
    setError('');
  };

  const toggleGroup = (id: number) => {
    setGroupIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  // 二级页入口的分组本来就是定的；一级页入口用用户勾选的（可以为空=未分组）
  const targetGroupIds = fixedGroupId != null ? [fixedGroupId] : groupIds;

  const submit = async () => {
    if (submitting || !file) return;
    setSubmitting(true);
    setError('');
    try {
      ensureActive();
      setProgress('正在上传…');
      await uploadVideo(file, targetGroupIds, scope);
      ensureActive();
      onUploaded(
        `已上传「${file.name}」${
          targetGroupIds.length > 0 ? `到 ${targetGroupIds.length} 个分组` : '（未分组）'
        }`,
      );
    } catch (e: unknown) {
      if (active.current) setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      if (active.current) {
        setProgress('');
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="fh-video-upload">
      <div className="fh-video-upload__mask" onClick={onClose} />
      <div className="fh-video-upload__panel" role="dialog" aria-label="上传视频">
        <header className="fh-video-upload__header">
          <span className="fh-video-upload__title">上传视频</span>
          <button
            type="button"
            className="fh-video-upload__close"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </header>

        <div className="fh-video-upload__body">
          {/* 不给 capture：加了它系统就只给录像；不给时手机会自己问"拍摄还是从文件/照片图库选" */}
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="fh-video-upload__input"
            onChange={handleFile}
          />
          <button type="button" className="fh-video-upload__pick" onClick={pickFile}>
            {file ? '重新选择视频' : '选择视频'}
          </button>

          {file && (
            <div className="fh-video-upload__file">
              <span className="fh-video-upload__file-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" focusable="false">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span className="fh-video-upload__file-meta">
                <span className="fh-video-upload__file-name">{file.name}</span>
                <span className="fh-video-upload__file-size">{formatFileSize(file.size)}</span>
              </span>
              <button
                type="button"
                className="fh-video-upload__file-remove"
                onClick={() => setFile(null)}
                aria-label="移除这支视频"
              >
                ×
              </button>
            </div>
          )}

          {fixedGroupId == null && (
            <section className="fh-video-upload__section">
              <h3 className="fh-video-upload__label">加入分组（可多选，可不选）</h3>
              {groups.length === 0 ? (
                <p className="fh-video-upload__tip">{hint || '还没有视频分组'}</p>
              ) : (
                <div className="fh-video-upload__chips">
                  {groups.map((group) => (
                    <button
                      type="button"
                      key={group.groupId}
                      className={`fh-video-upload__chip${
                        groupIds.includes(group.groupId) ? ' fh-video-upload__chip--on' : ''
                      }`}
                      onClick={() => toggleGroup(group.groupId)}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="fh-video-upload__footer">
          {error ? (
            <p className="fh-video-upload__error">{error}</p>
          ) : (
            <p className="fh-video-upload__progress">{progress || hint}</p>
          )}
          <button
            type="button"
            className="fh-video-upload__submit"
            disabled={submitting || !file}
            onClick={() => void submit()}
          >
            {submitting ? progress || '上传中…' : '上传'}
          </button>
        </footer>
      </div>
    </div>
  );
}
