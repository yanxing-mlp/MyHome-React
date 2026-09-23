import { Modal, Upload, Typography, Select, Space, Input, Divider, App } from 'antd';
import { InboxOutlined, CheckOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createAlbumGroup } from '../../api/album';
import type { AlbumGroupScope } from '../../api/album';
import { useAlbumImageUpload } from './useAlbumImageUpload';
import { useAlbumCities, useAlbumGroups, useAlbumKeys } from './useAlbumGroups';

interface ImageUploadModalProps {
  scope: AlbumGroupScope;
  open: boolean;
  onClose: () => void;
  /**
   * 从分组详情页进来时分组已经定了（就是 URL 上那个）：不渲染分组选择，直接绑这一个。
   * 图片管理页不传，让用户在弹窗里多选分组。与 C 端 `AlbumUploadSheet` 的 `fixedGroupId` 同一个口径。
   */
  fixedGroupId?: number;
}

const { Dragger } = Upload;

/**
 * 图片上传弹窗。
 *
 * 用户选择文件后自动触发上传流程：
 * 1. EXIF 提取（GPS、拍摄时间）
 * 2. Canvas 压缩转 JPEG
 * 3. 逐张上传 + 批量绑定到分组
 *
 * 分组必选：没绑定分组的话 `album_image` 一行都不会写，那张图在相册里谁都看不见，
 * 所以没选分组时"开始上传"是灰的。分组已由 URL 定死时这一整块不渲染——留个改不动的选择器，
 * 只会让人以为还能换成别的分组。
 *
 * 候选分组、城市、绑定及快捷建组都沿用页面传入的 scope。
 */
export function ImageUploadModal({ open, onClose, fixedGroupId, scope }: ImageUploadModalProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const keys = useAlbumKeys(scope);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [city, setCity] = useState<string | undefined>(undefined);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [isAddingCity, setIsAddingCity] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // 要绑的那几个分组：URL 已定分组时就是它一个，多选 state 在这一路里没有输入口
  const groupIds = fixedGroupId == null ? selectedGroupIds : [fixedGroupId];
  const { uploadFiles, uploading } = useAlbumImageUpload(groupIds, scope);

  const { data: cities } = useAlbumCities(scope, open);
  const { data: groups } = useAlbumGroups(undefined, scope, open && fixedGroupId == null);

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择图片');
      return;
    }
    
    const files = fileList.map((f) => f.originFileObj as File).filter(Boolean);
    if (files.length === 0) {
      message.warning('请先选择图片');
      return;
    }

    try {
      await uploadFiles(files, city);
      setFileList([]);
      setCity(undefined);
      setSelectedGroupIds([]);
      onClose();
    } catch {
      // 错误已在 hook 内处理
    }
  };

  const handleCancel = () => {
    setFileList([]);
    setCity(undefined);
    setSelectedGroupIds([]);
    onClose();
  };

  const uploadProps: UploadProps = {
    onRemove: (file) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    },
    beforeUpload: (file) => {
      setFileList((prev) => [...prev, {
        uid: file.uid,
        name: file.name,
        status: 'done',
        originFileObj: file,
        thumbUrl: URL.createObjectURL(file), // 生成缩略图 URL
      }]);
      return false; // 阻止默认上传行为
    },
    fileList,
    multiple: true,
    accept: 'image/*',
    capture: 'environment', // 优先使用后置摄像头（移动端）
    listType: 'picture-card', // 图片卡片列表样式
    onPreview: (file) => {
      // 点击预览时打开原图
      if (file.thumbUrl) {
        window.open(file.thumbUrl, '_blank');
      }
    },
  };

  const groupsList = groups ?? [];

  return (
    <Modal
      open={open}
      title="上传图片"
      okText="开始上传"
      cancelText="取消"
      confirmLoading={uploading}
      okButtonProps={{ disabled: groupIds.length === 0 }}
      onOk={handleUpload}
      onCancel={handleCancel}
      destroyOnHidden
      width={600}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {/* 分组选择：分组未定时（图片管理页）才要选 */}
        {fixedGroupId == null && (
          <div>
            <Typography.Text strong>相册分组（必选，可多选）：</Typography.Text>
            <Select<number[]>
              mode="multiple"
              placeholder="选择一个或多个分组"
              style={{ width: '100%', marginTop: 8 }}
              value={selectedGroupIds}
              onChange={(value: any) => {
                if (value.includes('__ADD_NEW__')) {
                  setIsAddingGroup(true);
                } else {
                  setSelectedGroupIds(value);
                }
              }}
              allowClear
              maxTagCount={3}
              popupRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  {isAddingGroup ? (
                    <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Input
                        placeholder="输入分组名称，按回车确认"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        onPressEnter={async () => {
                          if (newGroupName.trim()) {
                            try {
                              const newGroupId = await createAlbumGroup({ name: newGroupName.trim(), scope });
                              setSelectedGroupIds([...selectedGroupIds, newGroupId]);
                              setIsAddingGroup(false);
                              setNewGroupName('');
                              // 刷新分组列表
                              void queryClient.invalidateQueries({ queryKey: keys.root });
                            } catch (error) {
                              message.error('创建分组失败');
                            }
                          }
                        }}
                        onBlur={() => {
                          if (!newGroupName.trim()) {
                            setIsAddingGroup(false);
                          }
                        }}
                        autoFocus
                        style={{ flex: 1 }}
                      />
                      <CheckOutlined
                        style={{
                          color: '#1890ff',
                          fontSize: 16,
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                        onClick={async () => {
                          if (newGroupName.trim()) {
                            try {
                              const newGroupId = await createAlbumGroup({ name: newGroupName.trim(), scope });
                              setSelectedGroupIds([...selectedGroupIds, newGroupId]);
                              setIsAddingGroup(false);
                              setNewGroupName('');
                              // 刷新分组列表
                              void queryClient.invalidateQueries({ queryKey: keys.root });
                            } catch (error) {
                              message.error('创建分组失败');
                            }
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '4px 11px',
                        cursor: 'pointer',
                        color: '#1890ff',
                        fontWeight: 500,
                      }}
                      onClick={() => setIsAddingGroup(true)}
                    >
                      + 新增分组
                    </div>
                  )}
                </>
              )}
              options={groupsList.map((g) => ({ label: g.name, value: g.id }))}
            />
          </div>
        )}

        {/* 城市选择 */}
        <div>
          <Typography.Text strong>城市（可选）：</Typography.Text>
          <Select
            allowClear
            showSearch
            placeholder="选择或输入城市名称"
            style={{ width: '100%', marginTop: 8 }}
            value={city}
            onChange={(value) => {
              if (value === '__ADD_NEW__') {
                setIsAddingCity(true);
              } else {
                setCity(value);
              }
            }}
            popupRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                {isAddingCity ? (
                  <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Input
                      placeholder="输入城市名称，按回车确认"
                      value={newCityName}
                      onChange={(e) => setNewCityName(e.target.value)}
                      onPressEnter={() => {
                        if (newCityName.trim()) {
                          setCity(newCityName.trim());
                          setIsAddingCity(false);
                          setNewCityName('');
                        }
                      }}
                      onBlur={() => {
                        if (!newCityName.trim()) {
                          setIsAddingCity(false);
                        }
                      }}
                      autoFocus
                      style={{ flex: 1 }}
                    />
                    <CheckOutlined
                      style={{
                        color: '#1890ff',
                        fontSize: 16,
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      onClick={() => {
                        if (newCityName.trim()) {
                          setCity(newCityName.trim());
                          setIsAddingCity(false);
                          setNewCityName('');
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '4px 11px',
                      cursor: 'pointer',
                      color: '#1890ff',
                      fontWeight: 500,
                    }}
                    onClick={() => setIsAddingCity(true)}
                  >
                    + 新增城市
                  </div>
                )}
              </>
            )}
            options={cities?.map((c) => ({ label: c.city, value: c.city }))}
          />
          {cities && cities.length === 0 && !isAddingCity && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
              暂无历史城市，可直接输入
            </div>
          )}
        </div>

        <div>
          <Typography.Text strong>选择图片：</Typography.Text>
          <Dragger 
            {...uploadProps} 
            style={{ 
              marginTop: 8,
              minHeight: 200,
              background: '#fafafa',
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ fontSize: 48, color: '#1677ff' }} />
            </p>
            <p className="ant-upload-text">点击或拖拽图片到此区域上传，或在移动设备上拍照</p>
            <p className="ant-upload-hint">
              支持 JPG、PNG、HEIC 等格式，可多选或直接拍照<br />
              上传时会自动提取 GPS 和拍摄时间，并压缩为 JPEG（长边 ≤2560px）
            </p>
          </Dragger>
        </div>
      </Space>
    </Modal>
  );
}
