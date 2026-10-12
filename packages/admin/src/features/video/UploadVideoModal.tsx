import { useRef, useState } from 'react';
import { Button, Modal, Progress, Space, Upload } from 'antd';
import type { UploadFile } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { formatFileSize } from '@family-home/shared/format';
import type { DataScope } from '../../lib/http';
import { useValidationSession } from '../../hooks/useValidationSession';
import { MediaGroupSelect } from '../file/MediaGroupSelect';
import { useUploadVideo } from './useVideos';

interface UploadVideoModalProps {
  open: boolean;
  scope?: DataScope;
  onClose: () => void;
  /** 从分组详情页进来时分组已定死：不渲染选择器，上传即绑这一个。「全部视频」页不传。 */
  fixedGroupId?: number;
}

/**
 * 视频上传弹窗：选一支视频 + 选分组（可选，可多选）。
 *
 * 一次只传一支（maxCount 1）。视频动辄几十上百 MB，加了进度条，否则用户会以为卡死。
 * `accept="video/*"` 让系统文件选择框默认过滤到视频——非视频就算硬传，服务端 VideoType 也会 415 挡下。
 * 分组可选，留空即未分组，所以不因未选分组而置灰提交。
 */
export function UploadVideoModal({ open, onClose, scope = 'PUBLIC', fixedGroupId }: UploadVideoModalProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [percent, setPercent] = useState(0);
  const uploadVideo = useUploadVideo(scope, open);
  const pending = useRef(false);
  const { capture } = useValidationSession(open, scope);

  const file = fileList[0]?.originFileObj as File | undefined;
  const uploading = uploadVideo.isPending;
  const canSubmit = !!file && !uploading;
  const effectiveGroupIds = fixedGroupId == null ? groupIds : [fixedGroupId];

  const reset = () => {
    setFileList([]);
    setGroupIds([]);
    setPercent(0);
  };

  const handleOk = async () => {
    const isCurrent = capture();
    if (!isCurrent() || pending.current || !file) return;
    pending.current = true;
    setPercent(0);
    try {
      await uploadVideo.mutateAsync({
        file,
        groupIds: effectiveGroupIds,
        onProgress: (p) => { if (isCurrent()) setPercent(p); },
      });
      if (isCurrent()) {
        reset();
        onClose();
      }
    } catch {
      // 失败原因（非视频 / 超大）后端已给中文，hook 里弹过了
    } finally {
      pending.current = false;
    }
  };

  return (
    <Modal
      open={open}
      title="上传视频"
      okText="上传"
      cancelText="取消"
      confirmLoading={uploading}
      okButtonProps={{ disabled: !canSubmit }}
      onOk={handleOk}
      onCancel={() => {
        if (uploading) return;
        reset();
        onClose();
      }}
      maskClosable={!uploading}
      closable={!uploading}
      destroyOnHidden
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {fixedGroupId == null && (
          <MediaGroupSelect
            bizType="video"
            scope={scope}
            active={open}
            disabled={uploading}
            value={groupIds}
            onChange={setGroupIds}
            style={{ width: '100%' }}
          />
        )}
        <Upload
          accept="video/*"
          disabled={uploading}
          maxCount={1}
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList: next }) => {
            setFileList(next.slice(-1));
            setPercent(0);
          }}
        >
          <Button icon={<UploadOutlined />}>选择视频</Button>
        </Upload>

        {file && (
          <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>
            {file.name} · {formatFileSize(file.size)}
          </div>
        )}

        {uploading && (
          <Progress percent={percent} status={percent >= 100 ? 'success' : 'active'} />
        )}
      </Space>
    </Modal>
  );
}
