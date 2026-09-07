import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  required?: boolean;
  /** 字段错误信息（受控表单校验产生），非空时红字展示在控件下方 */
  error?: string;
  /** 控件下方附加内容（如「校验并格式化」入口、说明文字） */
  extra?: ReactNode;
  /** 控件容器类名（如需要加宽度约束） */
  className?: string;
  children: ReactNode;
}

/**
 * 表单字段排版：标签（必填星号）+ 控件 + 错误/附加内容。
 * 受控表单的统一视觉容器，替代 antd Form.Item 的布局职责。
 */
export default function FormField({ label, required, error, extra, className, children }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        extra && <div className="text-xs text-muted-foreground">{extra}</div>
      )}
    </div>
  );
}
