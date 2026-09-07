import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface FilterSelectProps<T extends string | number> {
  /** 当前选中值，undefined 表示全部 */
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  options: { value: T; label: string }[];
  /** 未选中时的占位文案，同时作为「全部」选项的文字（如「全部命名空间」「全部状态」） */
  placeholder: string;
  className?: string;
  /** 下拉展开回调（open=true 时调用，用于刷新选项数据源） */
  onOpenChange?: (open: boolean) => void;
}

/** 「全部」哨兵值：Radix Select 不允许空串，选中它即代表清空筛选 */
const ALL = '__all__';

/**
 * 筛选区可清空下拉：头部固定「全部」选项替代 antd Select 的 allowClear，
 * 支持number / string 值（回选时按字符串匹配还原原类型）。
 */
export default function FilterSelect<T extends string | number>({
  value,
  onChange,
  options,
  placeholder,
  className,
  onOpenChange,
}: FilterSelectProps<T>) {
  return (
    <Select
      value={value !== undefined ? String(value) : ALL}
      onValueChange={(v) => {
        if (v === ALL) {
          onChange(undefined);
          return;
        }
        const matched = options.find((option) => String(option.value) === v);
        if (matched) onChange(matched.value);
      }}
      onOpenChange={onOpenChange}
    >
      <SelectTrigger className={cn('w-[180px]', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((option) => (
          <SelectItem key={String(option.value)} value={String(option.value)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
