import { Tag } from 'antd';

/** 格式 → Tag 配色映射：与 FormatSelect 支持的格式一致，未知格式 default 兜底 */
const formatColors: Record<string, string> = {
  text: 'default',
  json: 'orange',
  yaml: 'cyan',
  properties: 'gold',
  xml: 'purple',
  toml: 'green',
};

/** 配置格式标签：按格式着色展示 */
export default function FormatTag({ format }: { format: string }) {
  return (
    <Tag bordered={false} color={formatColors[format] ?? 'default'}>
      {format}
    </Tag>
  );
}
