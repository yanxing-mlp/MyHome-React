import { Form } from 'antd';
import type { FormItemProps } from 'antd';
import { ApiError } from '@family-home/shared/http';
import { checkDuplicate, duplicateMessages } from '../api/validation';
import type { DuplicateRequest } from '../api/validation';
import { useValidationSession } from '../hooks/useValidationSession';

export interface DuplicateFormItemProps extends Omit<FormItemProps, 'name'> {
  name: string;
  duplicate: Omit<DuplicateRequest, 'name' | 'account'>;
  active?: boolean;
  /** 密码本仅联动平台名称与账号，绝不读取密码。 */
  pairedField?: 'name' | 'account';
}

export function DuplicateFormItem({
  name, duplicate, active = true, pairedField, rules = [], children, ...props
}: DuplicateFormItemProps) {
  const form = Form.useFormInstance();
  const { key, capture } = useValidationSession(active, JSON.stringify(duplicate));

  return (
    <Form.Item
      {...props}
      key={key}
      name={name}
      dependencies={pairedField ? [pairedField] : undefined}
      validateFirst
      validateDebounce={250}
      validateTrigger={['onChange', 'onBlur']}
      rules={[
        ...rules,
        {
          async validator(_, value: string | undefined) {
            const isCurrent = capture();
            if (!isCurrent()) throw new Error('信息已变更，请重新校验');
            const trimmed = value?.trim();
            if (!trimmed) return; // 空白由 required + whitespace 处理
            const peer = pairedField ? String(form.getFieldValue(pairedField) ?? '').trim() : undefined;
            if (pairedField && !peer) return; // 联合键不完整时，另一字段的 required 会阻止提交
            const request: DuplicateRequest = { ...duplicate, name: trimmed };
            if (pairedField) {
              request.name = name === 'name' ? trimmed : peer;
              request.account = name === 'account' ? trimmed : peer;
            }
            try {
              const exists = await checkDuplicate(request);
              if (!isCurrent()) throw new Error('信息已变更，请重新校验');
              if (exists) throw new Error(duplicateMessages[duplicate.kind]);
            } catch (error) {
              if (!isCurrent()) throw new Error('信息已变更，请重新校验');
              if (error instanceof ApiError) throw new Error(error.message || '校验失败，请重试');
              if (error instanceof Error && error.message === duplicateMessages[duplicate.kind]) throw error;
              throw new Error('校验失败，请重试');
            }
          },
        },
      ]}
    >
      {children}
    </Form.Item>
  );
}
