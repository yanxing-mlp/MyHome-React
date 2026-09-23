import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@family-home/shared/auth';
import { App } from 'antd';
import { deleteVideo, listVideos, uploadVideo } from '../../api/video';
import { useValidationSession } from '../../hooks/useValidationSession';
import { withIdentity } from '../../lib/http';
import type { DataScope } from '../../lib/http';

/**
 * 视频域缓存键。写操作按 VIDEO_KEY 前缀整体刷新；查询按分区 + 账号分别缓存。
 *
 * 与文档同口径：私人视频只属当前账号，queryKey 带上 user.id，切号即换缓存。
 */
export const VIDEO_KEY = ['video'] as const;

export function useVideos(scope: DataScope = 'PUBLIC') {
  const user = useCurrentUser();
  return useQuery({
    queryKey: [...VIDEO_KEY, scope, user?.id ?? null],
    queryFn: ({ signal }) => listVideos(scope, {
      ...withIdentity(user ? String(user.id) : null), signal,
    }),
    enabled: !!user,
  });
}

/**
 * 上传一支视频。onProgress 透传给大文件进度条；
 * 关闭/切页后回调只刷新数据、不回填新会话（capture 守护）。
 */
export function useUploadVideo(scope: DataScope = 'PUBLIC', active = true) {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { capture } = useValidationSession(active, scope);

  return useMutation({
    onMutate: () => ({ isCurrent: capture() }),
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (percent: number) => void }) => {
      if (!capture()()) throw new Error('上传已取消，请重新操作');
      return uploadVideo(file, scope, withIdentity(user ? String(user.id) : null), onProgress);
    },
    onSuccess: (_, __, session) => {
      void queryClient.invalidateQueries({ queryKey: VIDEO_KEY });
      if (session?.isCurrent()) message.success('上传成功');
    },
    onError: (error, _, session) => {
      if (session?.isCurrent()) message.error(error.message || '上传失败');
    },
  });
}

/** 删除仅调用当前分区；后端仍负责 PRIVATE 所有权校验（包括 ADMIN）。 */
export function useDeleteVideo(scope: DataScope = 'PUBLIC') {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { capture } = useValidationSession(true, scope);

  return useMutation({
    onMutate: () => ({ isCurrent: capture() }),
    mutationFn: (id: number) => {
      if (!capture()()) throw new Error('页面已切换，请重新操作');
      return deleteVideo(id, scope, withIdentity(user ? String(user.id) : null));
    },
    onSuccess: (_, __, session) => {
      void queryClient.invalidateQueries({ queryKey: VIDEO_KEY });
      if (session?.isCurrent()) message.success('删除成功');
    },
    onError: (error, _, session) => {
      if (session?.isCurrent()) message.error(error.message || '删除失败');
    },
  });
}
