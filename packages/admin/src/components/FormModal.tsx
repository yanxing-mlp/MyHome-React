import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Form, Modal } from 'antd';
import type { FormProps } from 'antd';

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
 * 一期至少有 5 个同构的小表单弹窗：账号本新增/编辑（已用）、相册分组新建/改名、
 * 菜谱标签新建/改名、类型新建/改名。它们的差异只有字段和提交函数，
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

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (initialRef.current) {
        form.setFieldsValue(initialRef.current);
      }
    }
  }, [open, form]);

  return (
    <Modal
      open={open}
      title={title}
      okText={okText}
      cancelText="取消"
      confirmLoading={confirmLoading}
      destroyOnHidden
      onCancel={onClose}
      onOk={() => form.submit()}
      width={width}
    >
      <Form<TValues>
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={initialValues}
        onFinish={(values) => void onSubmit(values)}
        {...formProps}
      >
        {children}
      </Form>
    </Modal>
  );
}
