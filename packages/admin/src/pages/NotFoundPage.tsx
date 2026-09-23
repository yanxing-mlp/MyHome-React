import { Button, Result } from 'antd';
import { useNavigate } from 'react-router';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="页面不存在"
      subTitle="检查一下地址，或者回到首页。"
      extra={
        // 之前指向 '/album'，那不是一个路由（相册的三个页面各自是 /album/groups、/album/images、
        // /album/distribution），点过去还是 404，等于在死循环里绕。现在有了首页就回首页。
        <Button type="primary" onClick={() => navigate('/home', { replace: true })}>
          回到首页
        </Button>
      }
    />
  );
}
