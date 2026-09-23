import { useLayoutEffect, useRef, useState } from 'react';
import { Form, Input } from 'antd';
import type { InputProps } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { DuplicateFormItem } from './DuplicateFormItem';
import type { DuplicateFormItemProps } from './DuplicateFormItem';
import { useValidationSession } from '../hooks/useValidationSession';

interface DuplicateNameInputProps extends Omit<InputProps, 'value' | 'onChange' | 'onBlur' | 'onPressEnter'> {
  initialValue?: string;
  duplicate: DuplicateFormItemProps['duplicate'];
  requiredMessage: string;
  onSave: (name: string) => Promise<unknown>;
  onSaved: (result: unknown) => void;
  onCancel?: () => void;
  saveOnBlur?: boolean;
  showConfirm?: boolean;
  active?: boolean;
}

/** 独立的无 DOM Form，不嵌套 HTML form；无效输入失焦后仍保留，并显示行内错误。 */
export function DuplicateNameInput({
  initialValue = '', duplicate, requiredMessage, onSave, onSaved, onCancel,
  saveOnBlur = true, showConfirm = false, active = true, style, ...inputProps
}: DuplicateNameInputProps) {
  const [form] = Form.useForm<{ name: string }>();
  const [saving, setSaving] = useState(false);
  const pending = useRef<object | null>(null);
  const revision = useRef(0);
  const { key, capture } = useValidationSession(active, JSON.stringify(duplicate));
  useLayoutEffect(() => {
    pending.current = null;
    setSaving(false);
  }, [key]);

  const commit = async () => {
    if (pending.current) return;
    const ticket = {};
    pending.current = ticket;
    const isCurrent = capture();
    const version = revision.current;
    try {
      const values = await form.validateFields();
      if (!isCurrent() || version !== revision.current) return;
      setSaving(true);
      try {
        const result = await onSave(values.name.trim());
        if (isCurrent()) onSaved(result);
      } catch (error) {
        if (isCurrent()) form.setFields([{ name: 'name', errors: [error instanceof Error ? error.message : '保存失败，请重试'] }]);
      }
    } catch {
      // Form.Item 展示校验错误，不能关闭编辑或清空输入。
    } finally {
      if (pending.current === ticket) {
        pending.current = null;
        if (isCurrent()) setSaving(false);
      }
    }
  };

  return (
    <Form
      key={key}
      form={form}
      component={false}
      initialValues={{ name: initialValue }}
      onValuesChange={() => {
        revision.current += 1;
        if (!saving) pending.current = null;
      }}
    >
      <div style={{ ...style, display: 'flex', alignItems: 'flex-start', gap: showConfirm ? 8 : 0 }}>
        <DuplicateFormItem
          name="name"
          duplicate={duplicate}
          active={active}
          style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
          rules={[{ required: true, whitespace: true, message: requiredMessage }]}
        >
          <Input
            {...inputProps}
            disabled={saving || inputProps.disabled}
            onPressEnter={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void commit();
            }}
            onBlur={() => { if (saveOnBlur) void commit(); }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !pending.current) {
                event.preventDefault();
                event.stopPropagation();
                onCancel?.();
              }
            }}
          />
        </DuplicateFormItem>
        {showConfirm && (
          <CheckOutlined
            style={{ color: '#1890ff', fontSize: 16, cursor: 'pointer', padding: 4, marginTop: 4 }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void commit()}
          />
        )}
      </div>
    </Form>
  );
}
