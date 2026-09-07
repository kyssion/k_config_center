import { useState, type ReactNode } from 'react';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface FormDrawerProps {
  title: string;
  open: boolean;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  loading?: boolean;
  /** 表单是否有未保存修改（由受控表单方维护），有修改时关闭需二次确认 */
  dirty?: boolean;
  width?: number;
  okText?: string;
  children: ReactNode;
}

/**
 * 通用表单抽屉：右侧滑出，footer 固定为「取消 + 主按钮（loading）」。
 * 防误触约定：点遮罩不关闭；X / 取消 / Esc 统一走 handleRequestClose——
 * 表单已被修改（dirty）时弹二次确认，避免误关丢失未保存内容；未修改则直接关闭。
 */
export default function FormDrawer({
  title,
  open,
  onClose,
  onSubmit,
  loading,
  dirty,
  width = 480,
  okText = '确定',
  children,
}: FormDrawerProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 关闭请求（X / 取消 / Esc）：有未保存修改时二次确认，否则直接关闭
  const handleRequestClose = () => {
    if (dirty) {
      setConfirmOpen(true);
      return;
    }
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // 仅处理关闭动作（打开由父组件控制）；点遮罩不关闭，对齐原 maskClosable=false
        if (!next) handleRequestClose();
      }}
    >
      <SheetContent
        style={{ maxWidth: width }}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          handleRequestClose();
        }}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">{children}</div>
        <SheetFooter>
          <Button variant="outline" onClick={handleRequestClose}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={loading}>
            {okText}
          </Button>
        </SheetFooter>
      </SheetContent>

      {/* 关闭二次确认：叠在抽屉之上 */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认关闭？</AlertDialogTitle>
            <AlertDialogDescription>表单内容尚未保存，关闭后将丢失</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>关闭</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
