import { useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@family-home/shared/auth';
import { App } from 'antd';
import { deleteDocument, downloadDocument, listDocuments, uploadDocument } from '../../api/file';
import type { DocumentFile } from '../../api/file';
import { useValidationSession } from '../../hooks/useValidationSession';
import { withIdentity } from '../../lib/http';
import type { DataScope } from '../../lib/http';

/** 写操作按域前缀刷新；查询按分区、账号及分类分别缓存。 */
export const FILE_KEY = ['file'] as const;
export const DOCUMENTS_KEY = [...FILE_KEY, 'documents'] as const;

export function useDocuments(categoryId?: number, scope: DataScope = 'PUBLIC') {
  const user = useCurrentUser();
  return useQuery({
    queryKey: [...DOCUMENTS_KEY, scope, user?.id ?? null, categoryId ?? 'all'],
    queryFn: ({ signal }) => listDocuments(categoryId, scope, {
      ...withIdentity(user ? String(user.id) : null), signal,
    }),
    enabled: !!user,
  });
}

/** 单文件上传固定发起身份；关闭/切页后的结果只刷新数据，不回填新会话。 */
export function useUploadDocument(scope: DataScope = 'PUBLIC', active = true) {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { capture } = useValidationSession(active, scope);

  return useMutation({
    onMutate: () => ({ isCurrent: capture() }),
    mutationFn: ({ file, categoryId }: { file: File; categoryId: number }) => {
      if (!capture()()) throw new Error('上传已取消，请重新操作');
      return uploadDocument(file, categoryId, scope, withIdentity(user ? String(user.id) : null));
    },
    onSuccess: (_, __, session) => {
      void queryClient.invalidateQueries({ queryKey: FILE_KEY });
      if (session?.isCurrent()) message.success('上传成功');
    },
    onError: (error, _, session) => {
      if (session?.isCurrent()) message.error(error.message || '上传失败');
    },
  });
}

/** 私人文件不暴露静态地址；下载响应与临时 URL 均不进入缓存或持久化。 */
export function useDownloadDocument(scope: DataScope = 'PUBLIC') {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const { capture } = useValidationSession(true, scope);
  const request = useRef<AbortController | null>(null);
  const resource = useRef<{ url: string; timer: number } | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const releaseURL = () => {
    if (!resource.current) return;
    window.clearTimeout(resource.current.timer);
    URL.revokeObjectURL(resource.current.url);
    resource.current = null;
  };

  useLayoutEffect(() => () => {
    request.current?.abort();
    releaseURL();
  }, [scope, user?.id]);

  const download = async (file: DocumentFile) => {
    const isCurrent = capture();
    if (!isCurrent()) return;
    request.current?.abort();
    releaseURL();
    const controller = new AbortController();
    request.current = controller;
    const canApply = () => isCurrent() && request.current === controller && !controller.signal.aborted;
    setDownloadingId(file.id);
    try {
      const blob = await downloadDocument(file.id, scope, {
        ...withIdentity(user ? String(user.id) : null), signal: controller.signal,
      });
      if (!canApply()) return;
      const url = URL.createObjectURL(blob);
      // 给浏览器一个接管下载的时间窗；切页/切号/下一次下载时立即释放。
      resource.current = { url, timer: window.setTimeout(releaseURL, 1000) };
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); }
    } catch (error) {
      if (canApply()) {
        releaseURL();
        message.error(error instanceof Error ? error.message : '下载失败，请重试');
      }
    } finally {
      if (canApply()) setDownloadingId(null);
    }
  };

  return { download, downloadingId };
}

/** 删除仅调用当前分区；后端仍负责 PRIVATE 所有权校验（包括 ADMIN）。 */
export function useDeleteDocument(scope: DataScope = 'PUBLIC') {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { capture } = useValidationSession(true, scope);

  return useMutation({
    onMutate: () => ({ isCurrent: capture() }),
    mutationFn: (id: number) => {
      if (!capture()()) throw new Error('页面已切换，请重新操作');
      return deleteDocument(id, scope, withIdentity(user ? String(user.id) : null));
    },
    onSuccess: (_, __, session) => {
      void queryClient.invalidateQueries({ queryKey: FILE_KEY });
      if (session?.isCurrent()) message.success('删除成功');
    },
    onError: (error, _, session) => {
      if (session?.isCurrent()) message.error(error.message || '删除失败');
    },
  });
}
