import { Select } from 'antd';
import type { SelectProps } from 'antd';
import type { ConfigFormat } from '@/api/types';

/** 支持的配置内容格式（与后端 format 字段取值一致） */
const formatOptions: { value: ConfigFormat; label: string }[] = [
  { value: 'text', label: 'text' },
  { value: 'json', label: 'json' },
  { value: 'yaml', label: 'yaml' },
  { value: 'properties', label: 'properties' },
  { value: 'xml', label: 'xml' },
  { value: 'toml', label: 'toml' },
];

type FormatSelectProps = Omit<SelectProps<ConfigFormat>, 'options'>;

/** 配置格式选择器：固定选项，透传其余 Select 属性（value/onChange 等） */
export default function FormatSelect(props: FormatSelectProps) {
  return <Select<ConfigFormat> options={formatOptions} style={{ width: 140 }} {...props} />;
}
