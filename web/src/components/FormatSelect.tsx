import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ConfigFormat } from '@/api/types';

/** 支持的配置内容格式（与后端 format 字段取值一致） */
const formatOptions: ConfigFormat[] = ['text', 'json', 'yaml', 'properties', 'xml', 'toml'];

interface FormatSelectProps {
  value: ConfigFormat;
  onChange: (value: ConfigFormat) => void;
  disabled?: boolean;
  id?: string;
}

/** 配置格式选择器：固定选项的受控下拉 */
export default function FormatSelect({ value, onChange, disabled, id }: FormatSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ConfigFormat)} disabled={disabled}>
      <SelectTrigger id={id} className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {formatOptions.map((format) => (
          <SelectItem key={format} value={format}>
            {format}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
