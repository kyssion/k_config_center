import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Settings2 } from 'lucide-react';
import type { ColumnMeta } from '@/hooks/useColumnSettings';

interface ColumnSettingButtonProps {
  columnMetas: ColumnMeta[];
  setVisible: (key: string, visible: boolean) => void;
  setWidth: (key: string, width?: number) => void;
  reset: () => void;
}

/**
 * 列配置按钮：设置图标 + Popover 面板，控制表格列显隐与宽度覆盖。
 * Props 直接接收 useColumnSettings 的返回值，与其配套使用。
 */
export default function ColumnSettingButton({ columnMetas, setVisible, setWidth, reset }: ColumnSettingButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label="列配置">
          <Settings2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="mb-3 text-sm font-medium">列配置</p>
        <div className="flex flex-col gap-2.5">
          {columnMetas.map((meta) => (
            <label key={meta.key} className="flex cursor-pointer items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={meta.visible}
                  onCheckedChange={(checked) => setVisible(meta.key, checked === true)}
                />
                {meta.title}
              </span>
              <Input
                type="number"
                min={60}
                placeholder="自动"
                value={meta.width ?? ''}
                onChange={(e) => setWidth(meta.key, e.target.value ? Number(e.target.value) : undefined)}
                className="h-8 w-20 text-xs"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 text-right">
          <Button variant="link" size="sm" className="h-6 px-1" onClick={reset}>
            恢复默认
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
