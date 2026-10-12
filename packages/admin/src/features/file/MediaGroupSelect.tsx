import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Divider, Input, Select } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import type { FileGroupBizType } from '../../api/fileGroup';
import type { DataScope } from '../../lib/http';
import { useCreateFileGroup, useFileGroups } from './useFileGroups';

interface MediaGroupSelectProps {
  bizType: FileGroupBizType;
  scope: DataScope;
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
  placeholder?: string;
  /** 弹窗是否处于打开态：控制内联新建的校验会话与请求开关 */
  active?: boolean;
  style?: CSSProperties;
}

/**
 * 文件/视频分组多选器（可内联新建分组）。
 *
 * 分组是**可选**维度：留空即"未分组"，只出现在「全部」列表里，不进任何分组详情页。
 * 这与相册不同——相册图片必须至少属于一个分组，否则谁都看不见；文件/视频不选也能在
 * 「全部」里正常管理。所以上传弹窗用它时不置灰提交按钮。
 *
 * 内联新建沿用项目既有口径（蓝色可点文字 + 确认图标 + antd v6 popupRender）：碰到没预置的
 * 分组不用切页面去建，建完自动选中。
 */
export function MediaGroupSelect({
  bizType,
  scope,
  value,
  onChange,
  disabled = false,
  placeholder = '选择分组（可多选，留空为未分组）',
  active = true,
  style,
}: MediaGroupSelectProps) {
  const { data: groups } = useFileGroups(bizType, scope, undefined, active && !disabled);
  const createGroup = useCreateFileGroup(bizType, scope, active && !disabled);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const commitNew = async () => {
    const name = newName.trim();
    if (!name) return;
    const id = await createGroup.mutateAsync(name);
    onChange([...value, id]);
    setIsAdding(false);
    setNewName('');
  };

  return (
    <Select<number[]>
      mode="multiple"
      style={style}
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      allowClear
      maxTagCount="responsive"
      onChange={(next) => onChange(next ?? [])}
      options={groups?.map((g) => ({ label: g.name, value: g.id })) ?? []}
      popupRender={(menu) => (
        <>
          {menu}
          <Divider style={{ margin: '8px 0' }} />
          {isAdding ? (
            <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Input
                autoFocus
                maxLength={64}
                placeholder="输入分组名称，按回车确认"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onPressEnter={() => void commitNew()}
                onBlur={() => {
                  if (!newName.trim()) setIsAdding(false);
                }}
                style={{ flex: 1 }}
              />
              <CheckOutlined
                style={{ color: '#1890ff', fontSize: 16, cursor: 'pointer', padding: '4px' }}
                onClick={() => void commitNew()}
              />
            </div>
          ) : (
            <div
              style={{ padding: '4px 11px', cursor: 'pointer', color: '#1890ff', fontWeight: 500 }}
              onClick={() => setIsAdding(true)}
            >
              + 新增分组
            </div>
          )}
        </>
      )}
    />
  );
}
