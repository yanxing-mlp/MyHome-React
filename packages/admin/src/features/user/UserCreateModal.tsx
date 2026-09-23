import { useState } from 'react';
import { App, Avatar, Button, Form, Input, Space, Upload } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import { compressImage, resolveUserAvatar } from '@family-home/shared/image';
import { FormModal } from '../../components/FormModal';
import { DuplicateFormItem } from '../../components/DuplicateFormItem';
import { useValidationSession } from '../../hooks/useValidationSession';
import { uploadAvatar } from '../../api/user';
import { useCreateUser } from './useUsers';

interface UserCreateValues {
  name: string;
  phone: string;
}

interface UserCreateModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 新增账号弹窗：昵称 + 手机号 + 头像，三样。**没有"编辑"这一种形态**，所以也没有 record 入参。
 *
 * 【这里收不到任何口令】表单上没有密码框，服务端也不从这条路收口令：初始口令是后端
 * 给的一个全家统一的固定值（见 AppUserService#DEFAULT_INITIAL_PASSWORD），管理员既没输入过、
 * 也看不到，之后更没有"重置别人的密码"这个动作。这一条是"超管也不能看到/改别人的密码"
 * 在服务端与前端的共同落地——少了密码框，前端就没有可泄露的地方。
 * 忘了口令的兜底是删号重建（代价：这个人在七处"添加人"里变成"已删除账号"）。
 *
 * 【也没有"角色"这一项】不是"管理员定不了角色"，而是**这个角色只有一个写入口**：表格里的
 * 「设为超管」开关（见 UserManagePage）。弹窗再放一格就是同一件事两条路，而新建时十次里有九次
 * 要的是普通成员——默认 MEMBER，需要提权的人建完当场在表格里点一下即可。
 *
 * 【头像先传后存】选完文件立刻传到 /api/b/file/upload 拿 id，保存时才把 id 写进账号：
 * 头像是一个文件，不是一段表单文本，没法跟着"取消"一起回退——所以没点保存就直接退出的话，
 * 会留下一个没人引用的 file_object。家庭场景一天传不了一张，不值得为它做暂存/清理。
 *
 * 【头像是管理员唯一能替别人定的资料字段，且只在这一刻】建完之后管理员就改不了它了，
 * 但本人可以去个人中心自己换（走 `PUT /profile`，与昵称/手机号同一条）。管理员这边没有
 * "编辑账号"这一形态，所以想替别人换头像没有路径——这是"管理员不替别人改资料"那条规则的结果。
 */
export function UserCreateModal({ open, onClose }: UserCreateModalProps) {
  const { message } = App.useApp();
  const { capture } = useValidationSession(open);
  // 头像放组件 state：FormModal 的外壳只认文本字段，传进来的文件 id 混在 values 里
  // 会让"取消后残留上一次上传的 id"这种坑变得很难查（与点单统计弹窗同一条经验）。
  const [avatar, setAvatar] = useState<{ fileId?: number; url: string | null }>({ url: null });
  const [uploading, setUploading] = useState(false);
  const createMutation = useCreateUser();

  // 每次打开都把上一次传的图片清掉，否则关窗再开时预览还挂着上一个没保存的文件
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setAvatar({ url: null });
  }

  const handlePick = async (file: File) => {
    setUploading(true);
    try {
      // 与相册/菜谱封面同一条路：canvas 转 JPEG 再传，HEIC 才不会撞 415
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

  const handleSubmit = async (values: UserCreateValues) => {
    const isCurrent = capture();
    await createMutation.mutateAsync({
      name: values.name.trim(),
      phone: values.phone.trim(),
      ...(avatar.fileId ? { avatarFileId: avatar.fileId } : {}),
    });
    if (isCurrent()) onClose();
  };

  return (
    <FormModal<UserCreateValues>
      open={open}
      title="新增账号"
      onSubmit={handleSubmit}
      confirmLoading={createMutation.isPending}
      onClose={onClose}
    >
      <Form.Item label="头像">
        <Space align="center">
          {/* 没传过头像时用默认剪影，不留空圈（与菜品默认封面同一口径） */}
          <Avatar size={56} src={resolveUserAvatar(avatar.url)} />
          <Upload beforeUpload={handlePick} showUploadList={false} accept="image/*">
            <Button icon={<CameraOutlined />} loading={uploading}>
              {avatar.fileId != null ? '更换头像' : '上传头像'}
            </Button>
          </Upload>
        </Space>
      </Form.Item>

      <DuplicateFormItem
        name="name"
        label="昵称"
        active={open}
        duplicate={{ kind: 'USER_NAME' }}
        rules={[{ required: true, whitespace: true, message: '请输入昵称' }, { max: 32, message: '最多 32 个字符' }]}
      >
        <Input placeholder="大宝" autoFocus />
      </DuplicateFormItem>

      <DuplicateFormItem
        name="phone"
        label="手机号"
        active={open}
        duplicate={{ kind: 'USER_PHONE' }}
        rules={[{ required: true, whitespace: true, message: '请输入手机号' }, { max: 32, message: '最多 32 个字符' }]}
      >
        {/* 不做格式校验：V502 起它不再是登录核对项，只是资料里的一串号；
            前端拦成 11 位反而挡不住将来想填个内部编号的用法（后端也只限长度）。 */}
        <Input type="tel" maxLength={20} placeholder="请输入" autoComplete="off" />
      </DuplicateFormItem>
    </FormModal>
  );
}
