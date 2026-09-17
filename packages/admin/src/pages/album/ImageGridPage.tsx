import { useParams } from 'react-router';
import { PagePlaceholder } from '../../components/PagePlaceholder';

export function ImageGridPage() {
  const { groupId } = useParams();

  return (
    <PagePlaceholder
      title={`分组内图片（groupId=${groupId ?? '-'}）`}
      milestone="M3（相册域）"
      planned={[
        '图片网格，展示缩略图（thumbUrl），分页加载',
        '批量上传：前端 exifr 提取 GPS/拍摄时间 → canvas 转 JPEG → 逐张上传 → 批量绑定到分组',
        '多选删除（宽屏 hover 出 checkbox，窄屏长按进入多选模式 + 底部固定操作栏）',
        '改城市（datalist 候选来自 GET /api/b/album/cities）',
        '上架/下架单张图片',
        '图片置顶：PUT /api/b/album/images/{id}/pin，置顶图排在分组最前',
        '按城市筛选',
      ]}
      notes={[
        '排序口径固定为 pinned DESC, create_time DESC, id DESC——置顶只在组内生效，不做跨分组置顶（方案 §5.3）',
        'HEIC 必须在前端 canvas 转成 JPEG，浏览器不支持渲染 HEIC（方案 §6.6 坑 1）',
        'EXIF 必须在转码之前读——canvas 输出不带任何 EXIF，后端解析不到（方案 §6.6 坑 2）',
        '同分组内 md5 已存在的图会被跳过，响应里的 skippedDuplicates 要提示用户（方案 §6.9）',
        '删除是软删记录 + 物理删文件，不可恢复，确认文案必须写明（方案 §6.7）',
        '图片是三态 status，每个查询都要带 status <> DELETED，漏一处就是裂图（方案 §10 风险 5）',
      ]}
    />
  );
}
