import type { MouseEvent } from 'react';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/utils/clipboard';

interface CopyableTextProps {
  value: string;
  /** 是否 code 样式（等宽字体 + 灰底） */
  code?: boolean;
  maxWidth?: number;
}

/**
 * 可复制文本：省略展示（Tooltip 显示全文）+ 尾随复制小按钮。
 * 图标独立于文本截断之外；复制结果由 toast 反馈。
 */
export default function CopyableText({ value, code, maxWidth }: CopyableTextProps) {
  const handleCopy = async (e: MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(value);
    if (ok) {
      toast.success('已复制');
    } else {
      toast.error('复制失败，请手动复制');
    }
  };

  return (
    <span className="inline-flex max-w-full items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn('truncate', code && 'rounded bg-muted px-1.5 py-0.5 font-mono text-xs')}
            style={maxWidth ? { maxWidth } : undefined}
          >
            {value}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-96">
          <span className="block max-w-96 break-all font-mono">{value}</span>
        </TooltipContent>
      </Tooltip>
      <button
        type="button"
        aria-label="复制"
        onClick={handleCopy}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
      >
        <Copy className="size-3.5" />
      </button>
    </span>
  );
}
