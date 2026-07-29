import { Tag } from 'antd';
import type { ConfigStatus } from '@/api/types';

/** 状态 → 颜色/圆点色/文案映射：与后端状态机（DRAFT/PUBLISHED/OFFLINE）一一对应 */
const statusMeta: Record<ConfigStatus, { color: string; dotColor: string; label: string }> = {
  DRAFT: { color: 'gold', dotColor: '#faad14', label: '草稿' },
  PUBLISHED: { color: 'green', dotColor: '#52c41a', label: '已发布' },
  OFFLINE: { color: 'volcano', dotColor: '#fa541c', label: '已下线' },
};

/** 状态圆点：无边框 Tag 内的现代风状态指示点 */
const Dot = ({ color }: { color: string }) => (
  <span
    style={{
      display: 'inline-block',
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: color,
      marginRight: 6,
      verticalAlign: 'middle',
    }}
  />
);

/** 配置状态标签：按状态着色（带状态圆点），未知状态原样展示兜底 */
export default function StatusTag({ status }: { status: string }) {
  const meta = statusMeta[status as ConfigStatus];
  if (!meta) {
    return <Tag bordered={false}>{status}</Tag>;
  }
  return (
    <Tag bordered={false} color={meta.color}>
      <Dot color={meta.dotColor} />
      {meta.label}
    </Tag>
  );
}
