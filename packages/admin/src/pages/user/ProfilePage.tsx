import { useState } from 'react';
import { App, Avatar, Button, Card, Form, Input, Space, Upload } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import { compressImage, resolveUserAvatar } from '@family-home/shared/image';
import { PageShell } from '../../components/PageShell';
import { DuplicateFormItem } from '../../components/DuplicateFormItem';
import { useValidationSession } from '../../hooks/useValidationSession';
import { uploadAvatar } from '../../api/user';
import { useProfile, useUpdatePassword, useUpdateProfile } from '../../features/user/useUsers';
import type { UserProfile } from '../../api/user';

interface ProfileFormValues {
  name: string;
  phone: string;
}

interface PasswordFormValues {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * 个人中心（B 端独有的一页）。
 *
 * 【和账号管理页的分工】这一页改的是"我自己"，普通成员也进得来；账号管理那三条接口
 * （列表/新建/删除）改的是"别人"，每个接口服务端都要再判一次 ADMIN，而且**没有"改别人"这一条**——
 * 昵称、手机号、口令三项在整个系统里只有这一页一个入口。两条 PUT 长得像，但授权不同：
 * 这一页只看"有没有身份"，账号管理那边才看角色。
 *
 * 【头像在这里自己换】建号时管理员先定一张，之后本人就在这一页换——和昵称/手机号同属"改的就是我自己"，
 * 走的是同一条 `PUT /profile`（只要身份不要 ADMIN）。上传是两步：选完文件立刻传到
 * `/api/b/file/upload`（bizType=USER_AVATAR）拿 id，点保存才把 id 写进账号。
 * 头像放组件 state 而不是 Form values——FormModal 那套外壳只认文本字段，混进 values 会让
 * "取消后残留上一次上传的 id"这种坑很难查（与新增账号弹窗同一条经验）。
 * 后端 updateById 对 null 列跳过，所以这条**只能换头像、清不掉**：没传新的就保持原样，
 * 想恢复成默认剪影目前没有入口（管理员那边同样只能建号时定，不能替别人清）。
 *
 * 【两张卡各自一个"保存"】昵称/手机号/头像一次提交，密码一次提交，两者不需要一起保存；
 * 合成一个按钮的话，改昵称就得连带把原密码也填上，那是把两件不相干的事绑在一起。
 */
export function ProfilePage() {
  const { data: profile, isPending } = useProfile();

  return (
    <PageShell title="个人中心">
      <Space orientation="vertical" size={16} style={{ width: '100%', maxWidth: 480 }}>
        {/* 资料要回填（昵称/手机号进 Form、头像进 state），回填不了就别让表单先建出来（initialValues 只在挂载时取一次） */}
        {isPending || !profile ? <Card /> : <ProfileForm key={profile.id} profile={profile} />}
        <PasswordForm />
      </Space>
    </PageShell>
  );
}

function ProfileForm({ profile }: { profile: UserProfile }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ProfileFormValues>();
  const { capture } = useValidationSession(true, String(profile.id));
  const saveMutation = useUpdateProfile();
  // 头像放组件 state（不进 Form values）：初值取自 profile，上传后换成新文件的 id 与预览地址。
  // 保存时把 state 里的 fileId 原样提交——没动过就是原来那个，后端 NOT_NULL 策略下等于不变。
  const [avatar, setAvatar] = useState<{ fileId: number | null; url: string | null }>({
    fileId: profile.avatarFileId,
    url: profile.avatarUrl,
  });
  const [uploading, setUploading] = useState(false);

  const handlePick = async (file: File) => {
    setUploading(true);
    try {
      // 与新增账号/相册/菜谱封面同一条路：canvas 转 JPEG 再传，HEIC 才不会撞 415
      const compressed = await compressImage(file);
      const jpeg = new File([compressed.blob], 'avatar.jpg', { type: 'image/jpeg' });
      const uploaded = await uploadAvatar(jpeg);
      setAvatar({ fileId: uploaded.id, url: uploaded.thumbUrl || uploaded.url || null });
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setUploading(false);
    }
    return false; // 拦住 antd 自己的上传，走上面这条
  };

  return (
    <Card title="账号信息">
      <Form<ProfileFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: profile.name, phone: profile.phone }}
        disabled={saveMutation.isPending}
        onSubmitCapture={async (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (saveMutation.isPending) return;
          const isCurrent = capture();
          try {
            const values = await form.validateFields();
            if (isCurrent()) {
              saveMutation.mutate({
                name: values.name.trim(),
                phone: values.phone.trim(),
                avatarFileId: avatar.fileId,
              });
            }
          } catch {
            // 校验错误由字段展示，身份变化或页面卸载后不提交。
          }
        }}
      >
        <Form.Item label="头像">
          <Space align="center">
            {/* 没设过头像时用默认剪影，不留空圈（与新增账号弹窗、菜品默认封面同一口径） */}
            <Avatar size={56} src={resolveUserAvatar(avatar.url)} />
            <Upload beforeUpload={handlePick} showUploadList={false} accept="image/*">
              <Button icon={<CameraOutlined />} loading={uploading} disabled={saveMutation.isPending}>
                更换头像
              </Button>
            </Upload>
          </Space>
        </Form.Item>

        <DuplicateFormItem
          name="name"
          label="昵称"
          duplicate={{ kind: 'USER_NAME', excludeId: profile.id }}
          rules={[{ required: true, whitespace: true, message: '请输入昵称' }, { max: 32, message: '最多 32 个字符' }]}
        >
          <Input placeholder="大宝" maxLength={32} />
        </DuplicateFormItem>
        <DuplicateFormItem
          name="phone"
          label="手机号"
          duplicate={{ kind: 'USER_PHONE', excludeId: profile.id }}
          rules={[{ required: true, whitespace: true, message: '请输入手机号' }, { max: 32, message: '最多 32 个字符' }]}
        >
          {/* 不校验格式：它只是全家内部互相记的一个号，后端也只限长度 */}
          <Input type="tel" maxLength={20} placeholder="请输入" autoComplete="off" />
        </DuplicateFormItem>
        <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
          保存
        </Button>
      </Form>
    </Card>
  );
}

function PasswordForm() {
  const [form] = Form.useForm<PasswordFormValues>();
  // 成功后清空：三个框留着的话，下一次进来还会把刚用过的原密码再提交一遍
  const saveMutation = useUpdatePassword(() => form.resetFields());

  return (
    <Card title="修改密码">
      <Form<PasswordFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        autoComplete="off"
        onFinish={(values) =>
          saveMutation.mutate({ oldPassword: values.oldPassword, newPassword: values.newPassword })
        }
      >
        <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
          <Input.Password maxLength={64} placeholder="请输入" autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, max: 64, message: '至少 6 位、最多 64 位' },
          ]}
        >
          <Input.Password maxLength={64} placeholder="请输入" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="确认新密码"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                !value || value === getFieldValue('newPassword')
                  ? Promise.resolve()
                  : Promise.reject(new Error('两次输入的密码不一致')),
            }),
          ]}
        >
          <Input.Password maxLength={64} placeholder="请输入" autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
          保存
        </Button>
      </Form>
    </Card>
  );
}
