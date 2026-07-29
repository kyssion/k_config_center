import { Tag, Tooltip, Typography, message } from 'antd';
import { copyToClipboard } from '@/utils/clipboard';

interface DimensionCellProps {
  /** 维度名称（缺失时只显次行 key） */
  name: string | null | undefined;
  /** 业务 key（缺失时兜底显 #id，且不可复制） */
  dimensionKey: string | null | undefined;
  /** 维度记录 id，仅作 key 缺失时的兜底展示 */
  id: number;
  /** 名称 Tag 颜色 */
  color: string;
}

/**
 * 维度单元格：首行名称 Tag、次行 code 框展示业务 key（带 key: 前缀标识，点击复制 key 本身）。
 * 配置列表页与配置详情抽屉共用，保证两处展示一致。
 */
export default function DimensionCell({ name, dimensionKey, id, color }: DimensionCellProps) {
  /** 点击复制：只复制 key 值本身，不含 key: 前缀 */
  const handleCopy = async () => {
    if (!dimensionKey) return;
    const ok = await copyToClipboard(dimensionKey);
    if (ok) {
      message.success('已复制');
    } else {
      message.error('复制失败，请手动复制');
    }
  };

  return (
    <div>
      {name && (
        <div>
          <Tag color={color}>{name}</Tag>
        </div>
      )}
      {dimensionKey ? (
        <Tooltip title="点击复制">
          <Typography.Text
            code
            type="secondary"
            style={{ fontSize: 12, cursor: 'pointer' }}
            onClick={handleCopy}
          >
            {`key: ${dimensionKey}`}
          </Typography.Text>
        </Tooltip>
      ) : (
        <Typography.Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
          {`#${id}`}
        </Typography.Text>
      )}
    </div>
  );
}
