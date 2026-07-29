import { Card, Typography } from 'antd';
import type { ReactNode } from 'react';

interface PageContainerProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** banner 主题色：圆形图标底色 + 渐变起点衍生浅色，缺省主蓝 #2f54eb */
  accentColor?: string;
  extra?: ReactNode;
  children: ReactNode;
}

/**
 * 页面容器：统一的标题区（标题 + 可选说明 + 右侧操作区）+ 白底圆角卡片内容区。
 * 传入 icon 时标题区升级为浅色 banner 卡片（圆形主色图标 + 标题/副标题 + 操作区）。
 * 纯布局组件，零业务逻辑；页面白底由此卡片承担，Content 背景为全局 colorBgLayout。
 */
export default function PageContainer({ title, description, icon, accentColor, extra, children }: PageContainerProps) {
  if (icon) {
    // 渐变起点：传入 accentColor 时用十六进制透明度叠白底衍生浅色，缺省保持现状 #f0f5ff
    const gradientFrom = accentColor ? `${accentColor}14` : '#f0f5ff';
    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: `linear-gradient(90deg, ${gradientFrom} 0%, #ffffff 100%)`,
            borderRadius: 8,
            padding: '16px 20px',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: accentColor ?? '#2f54eb',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {title}
            </Typography.Title>
            {description && (
              <Typography.Text type="secondary" style={{ display: 'block', marginTop: 2 }}>
                {description}
              </Typography.Text>
            )}
          </div>
          {extra && <div style={{ flexShrink: 0 }}>{extra}</div>}
        </div>
        <Card bordered={false}>{children}</Card>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {description && (
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
              {description}
            </Typography.Text>
          )}
        </div>
        {extra && <div style={{ flexShrink: 0 }}>{extra}</div>}
      </div>
      <Card bordered={false}>{children}</Card>
    </div>
  );
}
