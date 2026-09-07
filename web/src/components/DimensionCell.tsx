import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/utils/clipboard';

/** 维度配色：key → Badge 配色（软色胶囊，bg/text 同色系） */
const toneClasses = {
  blue: 'border-transparent bg-blue-50 text-blue-700',
  cyan: 'border-transparent bg-cyan-50 text-cyan-700',
  sky: 'border-transparent bg-sky-50 text-sky-700',
  purple: 'border-transparent bg-violet-50 text-violet-700',
} as const;

export type DimensionTone = keyof typeof toneClasses;

interface DimensionCellProps {
  /** 维度名称（缺失时只显次行 key） */
  name: string | null | undefined;
  /** 业务 key（缺失时兜底显 #id，且不可复制） */
  dimensionKey: string | null | undefined;
  /** 维度记录 id，仅作 key 缺失时的兜底展示 */
  id: number | null;
  /** 维度名称 Badge 配色 */
  tone: DimensionTone;
}

/**
 * 维度单元格：首行名称 Badge、次行 code 框展示业务 key（带 key: 前缀标识，点击复制 key 本身）。
 * 配置列表页与配置详情抽屉共用，保证两处展示一致。
 */
export default function DimensionCell({ name, dimensionKey, id, tone }: DimensionCellProps) {
  /** 点击复制：只复制 key 值本身，不含 key: 前缀 */
  const handleCopy = async () => {
    if (!dimensionKey) return;
    const ok = await copyToClipboard(dimensionKey);
    if (ok) {
      toast.success('已复制');
    } else {
      toast.error('复制失败，请手动复制');
    }
  };

  return (
    <div>
      {name && (
        <div>
          <Badge variant="outline" className={cn(toneClasses[tone])}>
            {name}
          </Badge>
        </div>
      )}
      {dimensionKey ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-0.5 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {`key: ${dimensionKey}`}
            </button>
          </TooltipTrigger>
          <TooltipContent>点击复制</TooltipContent>
        </Tooltip>
      ) : (
        <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{`#${id}`}</span>
      )}
    </div>
  );
}
