import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** 全局轻提示（toast）：成功/失败反馈统一走 sonner（antd message 的等价替代） */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      richColors
      toastOptions={{
        classNames: {
          toast: 'group-[.toaster]:rounded-md group-[.toaster]:border-border group-[.toaster]:shadow-md',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
