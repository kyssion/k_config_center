import { useCallback, useMemo, useRef, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import ResizableHeaderCell, { MIN_COLUMN_WIDTH } from '@/components/ResizableHeaderCell';
import type { ColumnResizeProps } from '@/components/ResizableHeaderCell';

/** 单列的持久化设置：是否可见 + 可选宽度覆盖 */
interface ColumnSetting {
  visible: boolean;
  width?: number;
}

/** 列设置集合：key 为列的稳定 key */
type ColumnSettingsMap = Record<string, ColumnSetting>;

/** 供设置面板渲染的列元信息 */
export interface ColumnMeta {
  key: string;
  title: string;
  visible: boolean;
  width?: number;
}

/** 从列定义中取稳定 key：优先显式 key，无 key 用 dataIndex 兜底 */
function resolveColumnKey<T>(column: ColumnsType<T>[number], index: number): string {
  if (column.key != null) {
    return String(column.key);
  }
  const dataIndex = (column as { dataIndex?: unknown }).dataIndex;
  if (dataIndex != null) {
    return Array.isArray(dataIndex) ? dataIndex.join('.') : String(dataIndex);
  }
  return `__col_${index}`;
}

/** 从 localStorage 读取列设置，解析失败视为无配置 */
function loadSettings(storageKey: string): ColumnSettingsMap {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as ColumnSettingsMap) : {};
  } catch {
    return {};
  }
}

/**
 * 表格列配置 Hook：列显隐 + 宽度覆盖（设置面板输入或表头拖拽），按 pageKey 持久化到 localStorage。
 * key 为 'action' 的操作列强制显示，不出现在可配置清单中，也不参与拖拽调宽。
 * 返回的 mergedColumns 与 components 直接交给 Table，columnMetas 等交给 ColumnSettingButton 渲染设置面板。
 */
export function useColumnSettings<T>(pageKey: string, columns: ColumnsType<T>) {
  const storageKey = `column-settings:${pageKey}`;
  const [settings, setSettings] = useState<ColumnSettingsMap>(() => loadSettings(storageKey));
  // 最新设置的镜像：拖拽等高频更新场景下回调不必依赖 settings，避免读到旧值
  const settingsRef = useRef(settings);

  // 写 localStorage（写失败不影响内存态）
  const writeStorage = useCallback(
    (next: ColumnSettingsMap) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // localStorage 不可用时静默降级为仅内存态
      }
    },
    [storageKey],
  );

  // shouldPersist=false 时只更新内存态（拖拽过程中的实时反馈），松手时再整体落盘
  const applySettings = useCallback(
    (next: ColumnSettingsMap, shouldPersist = true) => {
      settingsRef.current = next;
      setSettings(next);
      if (shouldPersist) {
        writeStorage(next);
      }
    },
    [writeStorage],
  );

  const setVisible = useCallback(
    (key: string, visible: boolean) => {
      const prev = settingsRef.current;
      applySettings({ ...prev, [key]: { ...prev[key], visible } });
    },
    [applySettings],
  );

  const setWidth = useCallback(
    (key: string, width?: number) => {
      const prev = settingsRef.current;
      applySettings({ ...prev, [key]: { visible: prev[key]?.visible ?? true, width } });
    },
    [applySettings],
  );

  // 拖拽过程中的宽度更新：只改内存态，不写 localStorage（避免高频写入）
  const setWidthTransient = useCallback(
    (key: string, width: number) => {
      const prev = settingsRef.current;
      applySettings({ ...prev, [key]: { visible: prev[key]?.visible ?? true, width } }, false);
    },
    [applySettings],
  );

  const reset = useCallback(() => {
    settingsRef.current = {};
    setSettings({});
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // 忽略清理失败
    }
  }, [storageKey]);

  // 按设置过滤可见列并套用宽度覆盖；操作列强制显示（先统一算 key，避免 filter 后索引错位）
  // 非操作列额外注入 onHeaderCell，把当前宽度与拖拽回调交给 ResizableHeaderCell
  const mergedColumns = useMemo<ColumnsType<T>>(() => {
    return columns
      .map((column, index) => ({ column, key: resolveColumnKey(column, index) }))
      .filter(({ key }) => key === 'action' || (settings[key]?.visible ?? true))
      .map(({ column, key }) => {
        const width = settings[key]?.width;
        // 仅接受合法宽度（有限数值且 >= 下限），防 localStorage 被改坏出现负数/NaN
        const isValidWidth =
          typeof width === 'number' && Number.isFinite(width) && width >= MIN_COLUMN_WIDTH;
        const sizedColumn = isValidWidth ? { ...column, width } : column;
        if (key === 'action') {
          return sizedColumn;
        }
        // 拖拽起点宽度：优先用户覆盖值，其次列定义的固定宽度，都没有时由表头实际宽度兜底
        const currentWidth = isValidWidth
          ? width
          : typeof column.width === 'number'
            ? column.width
            : undefined;
        const resizeProps: ColumnResizeProps = {
          width: currentWidth,
          onColumnResize: (next) => setWidthTransient(key, next),
          onColumnResizeEnd: (next) => setWidth(key, next),
        };
        return { ...sizedColumn, onHeaderCell: () => resizeProps };
      });
  }, [columns, settings, setWidth, setWidthTransient]);

  // 交给 Table 的 components：表头单元格替换为可拖拽调宽实现
  const components = useMemo(() => ({ header: { cell: ResizableHeaderCell } }), []);

  // 可配置列清单（不含操作列），供设置面板渲染
  const columnMetas = useMemo<ColumnMeta[]>(() => {
    return columns
      .map((column, index) => {
        const key = resolveColumnKey(column, index);
        return {
          key,
          title: typeof column.title === 'string' ? column.title : key,
          visible: settings[key]?.visible ?? true,
          width: settings[key]?.width,
        };
      })
      .filter((meta) => meta.key !== 'action');
  }, [columns, settings]);

  return { mergedColumns, components, settings, columnMetas, setVisible, setWidth, reset };
}
