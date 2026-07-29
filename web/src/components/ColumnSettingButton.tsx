import { Button, Checkbox, InputNumber, Popover, Space } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
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
  const content = (
    <div style={{ width: 240 }}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {columnMetas.map((meta) => (
          <div key={meta.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Checkbox checked={meta.visible} onChange={(e) => setVisible(meta.key, e.target.checked)}>
              {meta.title}
            </Checkbox>
            <InputNumber
              size="small"
              placeholder="自动"
              min={60}
              value={meta.width}
              onChange={(value) => setWidth(meta.key, value ?? undefined)}
              style={{ width: 90 }}
            />
          </div>
        ))}
      </Space>
      <div style={{ textAlign: 'right', marginTop: 8 }}>
        <Button type="link" size="small" onClick={reset}>
          恢复默认
        </Button>
      </div>
    </div>
  );

  return (
    <Popover trigger="click" title="列配置" content={content} placement="bottomRight">
      <Button icon={<SettingOutlined />} />
    </Popover>
  );
}
