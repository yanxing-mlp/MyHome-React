import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Divider, Select } from 'antd';
import { DuplicateNameInput } from '../../components/DuplicateNameInput';
import type { DataScope } from '../../lib/http';
import { useCreateFileCategory, useFileCategories } from './useFileCategories';

interface FileCategorySelectProps {
  scope?: DataScope;
  active?: boolean;
  disabled?: boolean;
  value?: number | null;
  onChange?: (value: number | null) => void;
  placeholder?: string;
  /** 清空后回到"全部"，筛选器用；上传弹窗必选所以不给 */
  allowClear?: boolean;
  /** 下拉底部放「+ 新增分类」内联输入。上传场景要（碰到没预置的分类不用切页面），筛选器不需要 */
  creatable?: boolean;
  style?: CSSProperties;
}

/**
 * 文件分类下拉（单选）。
 *
 * 选项来自 file_category 字典。内联新建沿用菜品分类那一套交互（项目里已有的口径：
 * 蓝色可点击文字 + 确认图标），只是这里换成 antd v6 的 `popupRender`——`dropdownRender` 已废弃。
 */
export function FileCategorySelect({
  scope = 'PUBLIC',
  active = true,
  disabled = false,
  value,
  onChange,
  placeholder = '选择分类',
  allowClear = false,
  creatable = false,
  style,
}: FileCategorySelectProps) {
  const { data: categories } = useFileCategories(scope);
  const [isAdding, setIsAdding] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const createCategory = useCreateFileCategory(scope, active && popupOpen && !disabled);

  return (
    <Select<number>
      style={style}
      disabled={disabled}
      placeholder={placeholder}
      allowClear={allowClear}
      value={value ?? undefined}
      onOpenChange={setPopupOpen}
      onChange={(next) => onChange?.(next ?? null)}
      options={categories?.map((c) => ({ label: c.name, value: c.id })) ?? []}
      popupRender={(menu) =>
        creatable ? (
          <>
            {menu}
            <Divider style={{ margin: '8px 0' }} />
            {isAdding ? (
              <DuplicateNameInput
                autoFocus
                maxLength={32}
                placeholder="输入分类名称，按回车确认"
                duplicate={{ kind: 'FILE_CATEGORY', scope }}
                active={active && popupOpen && !disabled}
                requiredMessage="请输入分类名称"
                saveOnBlur={false}
                showConfirm
                onSave={(name) => createCategory.mutateAsync(name)}
                onSaved={(id) => {
                  onChange?.(id as number);
                  setIsAdding(false);
                }}
                onCancel={() => setIsAdding(false)}
                style={{ padding: '4px 8px' }}
              />
            ) : (
              <div
                style={{ padding: '4px 11px', cursor: 'pointer', color: '#1890ff', fontWeight: 500 }}
                onClick={() => setIsAdding(true)}
              >
                + 新增分类
              </div>
            )}
          </>
        ) : (
          menu
        )
      }
    />
  );
}
