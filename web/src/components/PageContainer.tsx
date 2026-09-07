import type { ReactNode } from 'react';

interface PageContainerProps {
  title: string;
  description?: string;
  /** 页面图标：以小方块 chip 形式展示在标题左侧（现代页头，不再做渐变横幅） */
  icon?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}

/**
 * 页面容器：清爽页头（图标 chip + 标题/副标题 + 右侧操作区）+ 内容区。
 * 内容不再包卡片——表格类内容由 DataTable 自带的圆角卡片容器承担，
 * 形成「灰底画布 + 白色圆角卡片」层次；纯布局组件，零业务逻辑。
 */
export default function PageContainer({ title, description, icon, extra, children }: PageContainerProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-card text-muted-foreground shadow-xs [&_svg]:size-5">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {extra && <div className="shrink-0">{extra}</div>}
      </div>
      {children}
    </div>
  );
}
