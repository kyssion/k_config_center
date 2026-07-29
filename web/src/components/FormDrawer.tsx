import type { ReactNode } from 'react';
import { Button, Drawer, Modal, Space } from 'antd';
import type { FormInstance } from 'antd';

interface FormDrawerProps {
  title: string;
  open: boolean;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  loading?: boolean;
  form: FormInstance;
  width?: number;
  okText?: string;
  children: ReactNode;
}

/**
 * 通用表单抽屉：右侧滑出，footer 固定为「取消 + 主按钮（loading）」。
 * 防误触约定：maskClosable 关闭，X / 取消统一走 handleClose——
 * 表单已被修改（form.isFieldsTouched()）时弹二次确认，避免误关丢失未保存内容；
 * 未修改则直接关闭。destroyOnClose 保证每次打开表单为全新实例。
 */
export default function FormDrawer({
  title,
  open,
  onClose,
  onSubmit,
  loading,
  form,
  width = 480,
  okText = '确定',
  children,
}: FormDrawerProps) {
  // X 与取消共用：有未保存修改时二次确认，否则直接关闭
  const handleClose = () => {
    if (form.isFieldsTouched()) {
      Modal.confirm({
        title: '确认关闭？',
        content: '表单内容尚未保存，关闭后将丢失',
        okText: '关闭',
        cancelText: '继续编辑',
        onOk: onClose,
      });
      return;
    }
    onClose();
  };

  return (
    <Drawer
      title={title}
      open={open}
      onClose={handleClose}
      placement="right"
      width={width}
      maskClosable={false}
      destroyOnClose
      footer={
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleClose}>取消</Button>
          <Button type="primary" loading={loading} onClick={onSubmit}>
            {okText}
          </Button>
        </Space>
      }
    >
      {children}
    </Drawer>
  );
}
