import { Button, Space, Typography, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import type { MouseEvent } from 'react';
import { copyToClipboard } from '@/utils/clipboard';

interface CopyableTextProps {
  value: string;
  code?: boolean;
  maxWidth?: number;
}

/**
 * 可复制文本：省略展示（Tooltip 显示全文）+ 尾随复制小按钮。
 * 图标独立于文本截断之外；复制结果由 message 反馈。
 */
export default function CopyableText({ value, code, maxWidth }: CopyableTextProps) {
  const handleCopy = async (e: MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(value);
    if (ok) {
      message.success('已复制');
    } else {
      message.error('复制失败，请手动复制');
    }
  };

  return (
    <Space size={4}>
      <Typography.Text
        code={code}
        ellipsis={{ tooltip: value }}
        style={maxWidth ? { maxWidth } : undefined}
      >
        {value}
      </Typography.Text>
      <Button type="text" size="small" icon={<CopyOutlined />} onClick={handleCopy} />
    </Space>
  );
}
