import { useEffect, useRef, useState } from 'react';
import { compressImage, extractExif, toLocalDateTimeString } from '@family-home/shared/image';
import { getCurrentUserId } from '@family-home/shared/auth';
import { uploadAlbumImage } from '../api/file';
import {
  bindImagesToGroup,
  listAlbumCities,
  listAlbumGroupOptions,
  type AlbumCityOption,
  type AlbumGroupOption,
  type AlbumImageBindItem,
  type AlbumScope,
} from '../api/album';
import './AlbumUploadSheet.css';

/** 一张待上传的照片：原文件 + 本地预览地址（关掉时要 revoke，不然内存里留着整张图） */
interface PendingPhoto {
  file: File;
  preview: string;
}

interface AlbumUploadSheetProps {
  scope?: AlbumScope;
  /**
   * 详情页进来时分组已经定了：只填城市，不显示分组选择。
   * 相册页进来时不传，让用户多选现有的分组。
   */
  fixedGroupId?: number;
  onClose: () => void;
  /** 上传成功后回调，参数是给页面 toast 的一句话（组件自己会关掉，所以 toast 由页面渲染） */
  onUploaded: (summary: string) => void;
}

/**
 * C 端相册上传浮层（相册页 / 相册详情页共用一个组件）。
 *
 * 一条流水：选图 → 每张 exifr 提 EXIF → canvas 转 JPEG → 上传拿 fileId → 按分组各调一次绑定。
 * 三处口径是用户定的：
 * - 相册页传上来的图可以选**多个**现有分组；详情页那个入口只填城市、绑当前分组；
 * - 一次可以选**多张**；
 * - 城市单选，但可以直接输入一个没有过的城市。
 *
 * <p>**C 端不能新增分组**，所以分组那排只有已有分组的 chip，没有"+ 新增"入口。
 * 相册页那个入口<b>必须至少选一个分组</b>才能提交：绑定这一步整个跳过时 {@code album_image} 一行都不写，
 * 图只躺在文件库里，B 端列表和 C 端相册（连"其他"卡片）都查不到它。
 */
export function AlbumUploadSheet({ scope = 'FAMILY', fixedGroupId, onClose, onUploaded }: AlbumUploadSheetProps) {
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [groups, setGroups] = useState<AlbumGroupOption[]>([]);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [cities, setCities] = useState<AlbumCityOption[]>([]);
  const [city, setCity] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = useRef(false);
  const userId = useRef(getCurrentUserId());
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const ensureActive = () => {
    if (!active.current || getCurrentUserId() !== userId.current) {
      throw new Error('上传已取消');
    }
  };
  // 提交中给的那句进度文案，用 ref 之外还得留个 state 才看得见
  const [progress, setProgress] = useState('');

  // 预览地址的生命周期跟着组件：卸载时全部 revoke
  useEffect(() => {
    return () => {
      setPhotos((current) => {
        current.forEach((photo) => URL.revokeObjectURL(photo.preview));
        return current;
      });
    };
  }, []);

  // 候选项每次打开都要重取（别人可能刚在 B 端加了分组/城市），失败只留一句话，不挡上传
  useEffect(() => {
    let cancelled = false;
    setGroups([]);
    setGroupIds([]);
    setCities([]);
    setCity('');
    setHint('');
    if (fixedGroupId == null) {
      listAlbumGroupOptions(scope)
        .then((list) => {
          if (!cancelled) setGroups(list);
        })
        .catch((e: unknown) => {
          if (!cancelled) setHint(e instanceof Error ? e.message : '分组列表加载失败');
        });
    }
    listAlbumCities(scope)
      .then((list) => {
        if (!cancelled) setCities(list);
      })
      .catch(() => {
        // 城市候选拿不到就当没有候选，输入框照样能填
      });
    return () => {
      cancelled = true;
    };
  }, [fixedGroupId, scope]);

  const pickFiles = () => inputRef.current?.click();

  /** 追加选中：多次点"选择照片"会累加，而不是一批盖掉另一批 */
  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = ''; // 同一张照片第二次也要能再选上
    if (picked.length === 0) return;
    setPhotos((current) => [
      ...current,
      ...picked.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
    setError('');
  };

  const removePhoto = (index: number) => {
    setPhotos((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((_, i) => i !== index);
    });
  };

  const toggleGroup = (id: number) => {
    setGroupIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  // 详情页入口的分组本来就是定的；相册页入口没选中分组前不给提交
  const targetGroupIds = fixedGroupId != null ? [fixedGroupId] : groupIds;

  const submit = async () => {
    if (submitting || photos.length === 0 || targetGroupIds.length === 0) return;
    setSubmitting(true);
    setError('');
    const trimmedCity = city.trim();

    try {
      const items: AlbumImageBindItem[] = [];
      for (let i = 0; i < photos.length; i += 1) {
        ensureActive();
        setProgress(`正在上传第 ${i + 1}/${photos.length} 张…`);
        const { file } = photos[i];
        // EXIF 必须在转码之前提：canvas 出来的 JPEG 不带任何 EXIF（方案 §6.6）
        const exif = await extractExif(file);
        const compressed = await compressImage(file);
        const jpeg = new File([compressed.blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
          type: 'image/jpeg',
        });
        ensureActive();
        const uploaded = await uploadAlbumImage(jpeg);
        ensureActive();
        items.push({
          fileId: uploaded.id,
          city: trimmedCity || undefined,
          lng: exif.longitude,
          lat: exif.latitude,
          shootTime: toLocalDateTimeString(exif.shootTime),
        });
      }

      let skipped = 0;
      setProgress('正在加入相册…');
      for (const groupId of targetGroupIds) {
        ensureActive();
        const result = await bindImagesToGroup(groupId, items, scope);
        skipped += result.skippedDuplicates.length;
      }

      ensureActive();
      onUploaded(
        `已上传 ${items.length} 张到 ${targetGroupIds.length} 个相册${
          skipped > 0 ? `，${skipped} 张重复跳过` : ''
        }`,
      );
    } catch (e: unknown) {
      // 停在浮层里，让用户能看到是哪一步挂的；已经传上去的文件不做回滚（家庭场景重试代价更低）
      if (active.current) setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      if (active.current) {
        setProgress('');
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="fh-album-upload">
      <div className="fh-album-upload__mask" onClick={onClose} />
      <div className="fh-album-upload__panel" role="dialog" aria-label="上传照片">
        <header className="fh-album-upload__header">
          <span className="fh-album-upload__title">上传照片</span>
          <button
            type="button"
            className="fh-album-upload__close"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </header>

        <div className="fh-album-upload__body">
          {/* 不给 capture：加了它系统就只给相机；不给 capture 时手机会自己问"拍照还是照片图库" */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="fh-album-upload__input"
            onChange={handleFiles}
          />
          <button type="button" className="fh-album-upload__pick" onClick={pickFiles}>
            选择照片（可多选 / 拍照）
          </button>

          {photos.length > 0 && (
            <div className="fh-album-upload__thumbs">
              {photos.map((photo, index) => (
                <div className="fh-album-upload__thumb" key={photo.preview}>
                  <img src={photo.preview} alt="" />
                  <button
                    type="button"
                    className="fh-album-upload__thumb-close"
                    onClick={() => removePhoto(index)}
                    aria-label="移除这张"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {fixedGroupId == null && (
            <section className="fh-album-upload__section">
              <h3 className="fh-album-upload__label">加入相册（可多选）</h3>
              {groups.length === 0 ? (
                <p className="fh-album-upload__tip">{hint || '还没有相册分组'}</p>
              ) : (
                <div className="fh-album-upload__chips">
                  {groups.map((group) => (
                    <button
                      type="button"
                      key={group.id}
                      className={`fh-album-upload__chip${
                        groupIds.includes(group.id) ? ' fh-album-upload__chip--on' : ''
                      }`}
                      onClick={() => toggleGroup(group.id)}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="fh-album-upload__section">
            <h3 className="fh-album-upload__label">拍摄城市（选一个或自己填）</h3>
            {cities.length > 0 && (
              <div className="fh-album-upload__chips">
                {cities.map((option) => (
                  <button
                    type="button"
                    key={option.city}
                    className={`fh-album-upload__chip${
                      city === option.city ? ' fh-album-upload__chip--on' : ''
                    }`}
                    onClick={() => setCity(option.city)}
                  >
                    {option.city}
                  </button>
                ))}
              </div>
            )}
            <input
              className="fh-album-upload__input-city"
              type="text"
              value={city}
              placeholder="城市名，没见过的也可以直接写"
              onChange={(event) => setCity(event.target.value)}
            />
          </section>
        </div>

        <footer className="fh-album-upload__footer">
          {error ? (
            <p className="fh-album-upload__error">{error}</p>
          ) : (
            <p className="fh-album-upload__progress">{progress || hint}</p>
          )}
          <button
            type="button"
            className="fh-album-upload__submit"
            disabled={submitting || photos.length === 0 || targetGroupIds.length === 0}
            onClick={() => void submit()}
          >
            {submitting ? progress || '上传中…' : `上传${photos.length > 0 ? ` ${photos.length} 张` : ''}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
