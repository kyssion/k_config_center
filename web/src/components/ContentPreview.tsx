import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { copyToClipboard } from '@/utils/clipboard';
import { getFormatter } from '@/utils/formatters';

/** Tooltip 内最多展示的字符数，超出截断并提示进编辑器查看完整内容 */
const MAX_PREVIEW_LENGTH = 5000;

/**
 * 配置内容预览：列表单元格内单行省略展示，hover 弹出 Tooltip 展示格式化后的完整内容。
 * 空内容展示占位符「-」；超长内容仅预览前 5000 字符，避免浮层渲染卡顿。
 */
export default function ContentPreview({ content, format }: { content: string | null; format: string }) {
  if (!content) {
    return <span className="text-muted-foreground">-</span>;
  }

  // 注册表按格式美化，失败自动回退原文
  const formatted = getFormatter(format).format(content);
  const truncated = formatted.length > MAX_PREVIEW_LENGTH;
  const previewText = truncated ? formatted.slice(0, MAX_PREVIEW_LENGTH) : formatted;

  const handleCopy = async () => {
    const ok = await copyToClipboard(formatted);
    if (ok) {
      toast.success('已复制');
    } else {
      toast.error('复制失败，请手动复制');
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block max-w-60 truncate font-mono text-xs">{content}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[520px] p-0" side="top">
        <div className="p-3">
          <pre className="max-h-80 max-w-[480px] overflow-auto font-mono text-xs">{previewText}</pre>
          {truncated && <p className="mt-2 text-xs text-muted-foreground">内容过长，仅展示前 5000 字符，完整内容请进编辑器查看</p>}
          <div className="mt-2 text-right">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy />
              复制全部
            </Button>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
