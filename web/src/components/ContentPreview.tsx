import { Button, Popover, Typography, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { copyToClipboard } from '@/utils/clipboard';
import { getFormatter } from '@/utils/formatters';

/** Popover 内最多展示的字符数，超出截断并提示进编辑器查看完整内容 */
const MAX_PREVIEW_LENGTH = 5000;

/**
 * 配置内容预览：列表单元格内单行省略展示，hover 弹出 Popover 展示格式化后的完整内容。
 * 空内容展示占位符「-」；超长内容仅预览前 5000 字符，避免 Popover 渲染卡顿。
 */
export default function ContentPreview({ content, format }: { content: string | null; format: string }) {
  if (!content) {
    return <Typography.Text type="secondary">-</Typography.Text>;
  }

  // 注册表按格式美化，失败自动回退原文
  const formatted = getFormatter(format).format(content);
  const truncated = formatted.length > MAX_PREVIEW_LENGTH;
  const previewText = truncated ? formatted.slice(0, MAX_PREVIEW_LENGTH) : formatted;

  return (
    <Popover
      trigger="hover"
      content={
        <div>
          <pre style={{ maxWidth: 480, maxHeight: 320, overflow: 'auto', margin: 0, fontSize: 12 }}>
            {previewText}
            {truncated && (
              <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                内容过长，仅展示前 5000 字符，完整内容请进编辑器查看
              </Typography.Text>
            )}
          </pre>
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={async () => {
                const ok = await copyToClipboard(formatted);
                if (ok) {
                  message.success('已复制');
                } else {
                  message.error('复制失败，请手动复制');
                }
              }}
            >
              复制全部
            </Button>
          </div>
        </div>
      }
    >
      <Typography.Text
        ellipsis
        style={{ maxWidth: 240, fontFamily: 'monospace', fontSize: 12 }}
      >
        {content}
      </Typography.Text>
    </Popover>
  );
}
