import { Button, Result } from 'antd';
import { useNavigate } from 'react-router';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="页面不存在"
      subTitle="检查一下地址，或者回到相册页。"
      extra={
        <Button type="primary" onClick={() => navigate('/album', { replace: true })}>
          回到相册
        </Button>
      }
    />
  );
}
