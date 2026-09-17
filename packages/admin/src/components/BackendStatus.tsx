import { useQuery } from '@tanstack/react-query';
import { Tag, Tooltip, Typography } from 'antd';
import { ApiError } from '@family-home/shared/http';
import { fetchHealth } from '../api/system';

/**
 * 后端连通状态指示器。
 *
 * M1 用它验证 Vite proxy 是否把 /api 正确转发到 8080 —— 这是前后端联调的第一个可见信号。
 * 挂在 Layout 底部，不占左侧菜单（菜单必须严格保持"相册 / 菜谱"两项，方案 §7.3）。
 */
export function BackendStatus() {
  const { data, isError, error, isPending } = useQuery({
    queryKey: ['system', 'health'],
    queryFn: fetchHealth,
    // 健康检查失败时不要疯狂重试
    retry: false,
    refetchInterval: 60_000,
  });

  if (isPending) {
    return <Tag color="default">后端检测中…</Tag>;
  }

  if (isError) {
    const message = error instanceof ApiError ? error.message : '未知错误';
    return (
      <Tooltip title={message}>
        <Tag color="error">后端未连接</Tag>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      title={
        <Typography.Text style={{ color: '#fff', fontSize: 12 }}>
          数据库：{data.db}
          <br />
          JDK：{data.java}
          <br />
          存储根目录：{data.storageRoot}
          <br />
          服务器时间：{data.time}
        </Typography.Text>
      }
    >
      <Tag color="success">后端已连接</Tag>
    </Tooltip>
  );
}
