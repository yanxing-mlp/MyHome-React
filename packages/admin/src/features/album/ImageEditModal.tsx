import { Modal, Select, Space, App, Input, Divider } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckOutlined } from '@ant-design/icons';
import {
  getImageGroups,
  setImageGroups,
  listAlbumGroups,
  listAlbumCities,
  updateAlbumImage,
} from '../../api/album';
import type { AlbumGroup, AlbumGroupScope } from '../../api/album';
import { useAlbumKeys } from './useAlbumGroups';

interface ImageEditModalProps {
  scope: AlbumGroupScope;
  open: boolean;
  imageId: number | null;
  currentCity?: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * 图片编辑弹窗。
 * 
 * 支持：
 * - 修改城市（单选）
 * - 修改分组关联（多选）
 */
export function ImageEditModal({
  scope,
  open,
  imageId,
  currentCity,
  onClose,
  onSuccess,
}: ImageEditModalProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const keys = useAlbumKeys(scope);
  const requestVersion = useRef(0);
  const [ready, setReady] = useState(false);
  const [groups, setGroups] = useState<AlbumGroup[]>([]);
  const [cities, setCities] = useState<{ city: string; count: number }[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | undefined>(currentCity);
  const [loading, setLoading] = useState(false);
  const [isAddingCity, setIsAddingCity] = useState(false);
  const [newCityName, setNewCityName] = useState('');

  // 关闭、切图或切账号/范围时取消旧请求，避免旧响应覆盖新的候选与关联。
  useEffect(() => {
    const version = ++requestVersion.current;
    const controller = new AbortController();
    setReady(false);
    setGroups([]);
    setCities([]);
    setSelectedGroups([]);
    setSelectedCity(currentCity);
    setIsAddingCity(false);
    setNewCityName('');
    if (open && imageId != null) {
      Promise.all([
        listAlbumGroups(undefined, scope, controller.signal),
        listAlbumCities(scope, controller.signal),
        getImageGroups(imageId, scope, controller.signal),
      ]).then(([groupList, cityList, groupIds]) => {
        if (controller.signal.aborted || version !== requestVersion.current) return;
        setGroups(groupList);
        setCities(cityList);
        setSelectedGroups(groupIds);
        setReady(true);
      }).catch((error: unknown) => {
        if (!controller.signal.aborted && version === requestVersion.current) {
          message.error(error instanceof Error ? error.message : '加载失败，请重新打开');
        }
      });
    }
    return () => {
      controller.abort();
      ++requestVersion.current;
    };
  }, [open, imageId, currentCity, scope, keys, message]);

  const handleSave = async () => {
    if (imageId == null || !ready || loading) return;
    const version = requestVersion.current;
    setLoading(true);
    try {
      // 等所有写请求结束再失效缓存，某一项失败也刷新已成功的部分。
      const results = await Promise.allSettled([
        setImageGroups(imageId, selectedGroups, scope),
        ...(selectedCity !== currentCity ? [
          updateAlbumImage(imageId, { city: selectedCity ?? '' }, scope),
        ] : []),
      ]);
      const failed = results.find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
      if (version !== requestVersion.current) return;
      message.success('保存成功');
      onSuccess();
      onClose();
    } catch (error) {
      if (version === requestVersion.current) {
        message.error(error instanceof Error ? error.message : '保存失败，请重试');
      }
    } finally {
      void queryClient.invalidateQueries({ queryKey: keys.root });
      if (version === requestVersion.current) setLoading(false);
    }
  };

  return (
    <Modal
      title="编辑图片信息"
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={loading}
      okButtonProps={{ disabled: !ready }}
      width={480}
    >
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        {/* 城市选择 */}
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>城市</div>
          <Select
            style={{ width: '100%' }}
            placeholder="选择或输入城市（如：北京、上海）"
            allowClear
            showSearch
            value={selectedCity}
            onChange={(value) => {
              setSelectedCity(value);
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
                          const trimmedCity = newCityName.trim();
                          const exists = cities.some((c) => c.city === trimmedCity);
                          if (!exists) {
                            setCities([{ city: trimmedCity, count: 0 }, ...cities]);
                          }
                          setSelectedCity(trimmedCity);
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
                          const trimmedCity = newCityName.trim();
                          const exists = cities.some((c) => c.city === trimmedCity);
                          if (!exists) {
                            setCities([{ city: trimmedCity, count: 0 }, ...cities]);
                          }
                          setSelectedCity(trimmedCity);
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
            options={cities.map((c) => ({
              label: c.city,
              value: c.city,
            }))}
          />
        </div>

        {/* 分组选择（多选） */}
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>相册分组</div>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="选择分组（可多选）"
            value={selectedGroups}
            onChange={setSelectedGroups}
            options={groups.map((g) => ({
              label: g.name,
              value: g.id,
            }))}
            maxTagCount="responsive"
          />
        </div>
      </Space>
    </Modal>
  );
}
