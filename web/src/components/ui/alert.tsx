import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative flex w-full gap-3 rounded-lg border px-4 py-3 text-sm [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:translate-y-0.5',
  {
    variants: {
      variant: {
        info: 'border-blue-200 bg-blue-50 text-blue-900 [&>svg]:text-blue-500',
        warning: 'border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-500',
        error: 'border-red-200 bg-red-50 text-red-900 [&>svg]:text-red-500',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

/** 信息提示条：带图标位与可选右侧操作区（antd Alert 的等价替代） */
function Alert({
  className,
  variant,
  children,
  action,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants> & { action?: React.ReactNode }) {
  return (
    <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {children}
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  );
}

export { Alert };
