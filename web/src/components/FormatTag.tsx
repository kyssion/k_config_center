import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** 格式 → 配色映射：与 FormatSelect 支持的格式一致，未知格式中性灰兜底 */
const formatColors: Record<string, string> = {
  text: 'border-transparent bg-zinc-100 text-zinc-600',
  json: 'border-transparent bg-orange-50 text-orange-700',
  yaml: 'border-transparent bg-cyan-50 text-cyan-700',
  properties: 'border-transparent bg-amber-50 text-amber-700',
  xml: 'border-transparent bg-violet-50 text-violet-700',
  toml: 'border-transparent bg-emerald-50 text-emerald-700',
};

/** 配置格式标签：软色胶囊按格式着色 */
export default function FormatTag({ format }: { format: string }) {
  return <Badge variant="outline" className={cn(formatColors[format])}>{format}</Badge>;
}
