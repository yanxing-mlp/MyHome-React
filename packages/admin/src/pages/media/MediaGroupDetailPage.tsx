import { useParams } from 'react-router';
import { DocumentListPage } from '../file/DocumentListPage';
import { VideoListPage } from '../video/VideoListPage';
import type { FileGroupBizType } from '../../api/fileGroup';
import type { DataScope } from '../../lib/http';

interface MediaGroupDetailPageProps {
  bizType: FileGroupBizType;
  scope: DataScope;
}

/**
 * 分组详情页薄壳：从路由取 :groupId、校验合法后交给对应的列表页（带 groupId 过滤）。
 *
 * 文件/视频列表页本身就是「全部」页与「分组详情」页的共用实现，差别只在有没有 groupId；
 * 这一层只负责把 URL 上的分组号解析出来（非法号当作 undefined，退回不过滤，避免 NaN 打到后端）。
 */
export function MediaGroupDetailPage({ bizType, scope }: MediaGroupDetailPageProps) {
  const { groupId } = useParams<{ groupId: string }>();
  const parsed = groupId ? Number(groupId) : undefined;
  const validGroupId =
    parsed != null && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;

  return bizType === 'video'
    ? <VideoListPage scope={scope} groupId={validGroupId} />
    : <DocumentListPage scope={scope} groupId={validGroupId} />;
}
