import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Form, Modal } from 'antd';
import type { FormProps } from 'antd';
import { useValidationSession } from '../hooks/useValidationSession';

interface FormModalProps<TValues> {
  open: boolean;
  title: string;
  /** 编辑时传入初值；新建传 undefined */
  initialValues?: TValues;
  /** 校验通过后的提交回调；返回 Promise 时弹窗按钮自动进 loading 并保持打开 */
  onSubmit: (values: TValues) => void | Promise<void>;
  onClose: () => void;
  children: ReactNode;
  /** 提交中；由调用方的 mutation 状态驱动 */
  confirmLoading?: boolean;
  okText?: string;
  width?: number;
  formProps?: Partial<FormProps<TValues>>;
}

/**
 * 弹窗表单外壳。
 *
 * 一期有 3 个同构的小表单弹窗：密码本新增/编辑、相册分组新建/改名、做法分组新建
 * （做法的编辑已改成表格里行内改）。它们的差异只有字段和提交函数，
 * 外壳（打开时重置初值、校验、loading、关闭即销毁）必须完全一致。
 *
 * 两个关键约定：
 * 1. `destroyOnHidden`（antd v6 用它取代了 v5 的 destroyOnClose）—— 关闭即销毁表单实例，
 *    避免上一个账号的字段残留到下一个的编辑弹窗里；
 * 2. 打开时仍显式 `resetFields + setFieldsValue` 兜一层，因为 `initialValues` 只在 Form
 *    挂载那一刻生效；而这里用 ref 读初值、effect 只依赖 `open` —— 如果直接把
 *    `initialValues` 放进依赖，调用方每次渲染都传新对象，会导致输入到一半被清空。
 */
export function FormModal<TValues extends object>({
  open,
  title,
  initialValues,
  onSubmit,
  onClose,
  children,
  confirmLoading,
  okText = '保存',
  width = 480,
  formProps,
}: FormModalProps<TValues>) {
  const [form] = Form.useForm<TValues>();
  const initialRef = useRef(initialValues);
  initialRef.current = initialValues;
  const { key, capture } = useValidationSession(open);
  const pending = useRef<object | null>(null);
  const revision = useRef(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    pending.current = null;
    setSubmitting(false);
    if (open) {
      form.resetFields();
      if (initialRef.current) {
        form.setFieldsValue(initialRef.current);
      }
    }
  }, [open, form, key]);

  const submit = async () => {
    if (pending.current || confirmLoading) return;
    const ticket = {};
    pending.current = ticket;
    const isCurrent = capture();
    const version = revision.current;
    try {
      const values = await form.validateFields();
      if (!isCurrent() || version !== revision.current) return;
      setSubmitting(true);
      await onSubmit(values);
    } catch {
      // 校验错误内联展示；写入失败由业务 mutation 展示中文提示。
    } finally {
      if (pending.current === ticket) {
        pending.current = null;
        if (isCurrent()) setSubmitting(false);
      }
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      okText={okText}
      cancelText="取消"
      confirmLoading={confirmLoading || submitting}
      destroyOnHidden
      onCancel={onClose}
      onOk={() => void submit()}
      width={width}
    >
      <Form<TValues>
        key={key}
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={initialValues}
        {...formProps}
        disabled={confirmLoading || submitting}
        onSubmitCapture={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void submit();
        }}
        onValuesChange={(changed, values) => {
          revision.current += 1;
          if (!submitting) pending.current = null;
          formProps?.onValuesChange?.(changed, values);
        }}
      >
        {children}
      </Form>
    </Modal>
  );
}
