import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ConfigStatus } from '@/api/types';

/** 状态 → 配色/圆点色/文案映射：与后端状态机（DRAFT/PUBLISHED/OFFLINE）一一对应 */
const statusMeta: Record<ConfigStatus, { badge: string; dot: string; label: string }> = {
  DRAFT: { badge: 'border-transparent bg-amber-50 text-amber-700', dot: 'bg-amber-500', label: '草稿' },
  PUBLISHED: { badge: 'border-transparent bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', label: '已发布' },
  OFFLINE: { badge: 'border-transparent bg-orange-50 text-orange-700', dot: 'bg-orange-500', label: '已下线' },
};

/** 配置状态标签：软色胶囊 + 状态圆点，未知状态中性灰兜底 */
export default function StatusTag({ status }: { status: string }) {
  const meta = statusMeta[status as ConfigStatus];
  if (!meta) {
    return <Badge variant="secondary">{status}</Badge>;
  }
  return (
    <Badge variant="outline" className={cn(meta.badge)}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  );
}
