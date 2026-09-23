import { useState } from 'react';
import { App, Button, Card, Form, Input, Select, Typography } from 'antd';
import { setAuthToken, setCurrentUser } from '@family-home/shared/auth';
import { FH_LOGO, FH_LOGO_ALT } from '@family-home/shared/brand';
import { login } from '../api/user';
import { useUserOptions } from '../features/user/useUsers';

const { Title } = Typography;

interface LoginForm {
  userId: number;
  password: string;
}

/**
 * 登录页：下拉选账号 + 填密码，仅此两项。
 *
 * 【为什么不选账号就带出密码、点一下进得去】那等于没有登录。这一版要挡的还是
 * "全家共用一台平板、随手点到别人名字"，只是把确认凭据从手机号换成了密码：
 * 手机号印在每个人自己身上，密码只有本人知道。
 *
 * 【没有"记住我"这个开关】登录一次就写本机缓存、下次自动用这个账号（shared/auth），
 * 家庭设备上默认记住才是省事的口径，开关反而是多余的一件事。
 *
 * 【没登录也能进这一页】后端那一层拦的只有"没身份就写数据"（`requireUserId()` 抛 401），
 * 而 `/options` 与 `/login` 这两条创建行的动作都不涉及，所以它们天然不需要登录令牌。
 * 服务端没有一份"白名单路径"要维护：拦截器只解析 Authorization 头、缺失即当没登录放行。
 */
export function LoginPage() {
  const { message } = App.useApp();
  const { data: options, isPending } = useUserOptions();
  const [form] = Form.useForm<LoginForm>();
  const [submitting, setSubmitting] = useState(false);

  const userId = Form.useWatch('userId', form);
  const password = Form.useWatch('password', form);
  // 两项都齐了才让点：与"未选分组就置灰上传"同一口径
  const canSubmit = userId != null && !!password;

  const handleSubmit = async (values: LoginForm) => {
    setSubmitting(true);
    try {
      const { token, ...display } = await login(values.userId, values.password);
      // 令牌与展示对象分开存：令牌是之后每个请求的 Authorization 凭据，展示对象只喂 UI。
      setAuthToken(token);
      setCurrentUser(display);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f6fa',
        padding: 16,
      }}
    >
      <Card style={{ width: 340 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <img src={FH_LOGO} alt={FH_LOGO_ALT} width={32} height={32} />
          <Title level={4} style={{ margin: 0 }}>
            {FH_LOGO_ALT}
          </Title>
        </div>
        <Form<LoginForm> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item name="userId" label="账号" rules={[{ required: true, message: '请选择账号' }]}>
            <Select
              placeholder="请选择"
              loading={isPending}
              options={(options ?? []).map((user) => ({ value: user.id, label: user.name }))}
            />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            {/* 不做长度校验：登录侧刻意不收最短长度（后端也只判非空），
                否则"改密码时限制 6 位、登录时提示至少 6 位"会把输错的老密码说成格式问题。 */}
            <Input.Password maxLength={64} placeholder="请输入" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block disabled={!canSubmit} loading={submitting}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
