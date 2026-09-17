import { Button, ErrorBlock, NavBar } from 'antd-mobile';
import { useNavigate, useSearchParams } from 'react-router';
import { resolveEntryTitle } from '../constants/entries';

/**
 * 占位页。C 端卡片点击后跳到这里（方案 §7.3）。
 *
 * 从 query 的 from 参数拿 code 映射标题，后端不参与路由——
 * 路由是前端的事，所以 home 接口即使二期上线也不会返回 link 字段（方案 §5.5）。
 */
export function ComingSoonPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const title = resolveEntryTitle(searchParams.get('from'));

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <NavBar onBack={() => navigate('/', { replace: true })}>{title}</NavBar>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
        <ErrorBlock
          status="empty"
          title={`${title} · 敬请期待`}
          description="这个功能还在开发中，先在管理后台把内容填起来吧。"
          style={{ padding: 0 }}
        />

        <Button
          block
          color="primary"
          fill="outline"
          style={{ marginTop: 32 }}
          onClick={() => navigate('/', { replace: true })}
        >
          回到首页
        </Button>
      </div>
    </div>
  );
}
