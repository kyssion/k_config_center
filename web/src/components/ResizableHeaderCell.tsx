import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ThHTMLAttributes } from 'react';

/** 列宽下限，与列配置面板 InputNumber 的 min 保持一致 */
export const MIN_COLUMN_WIDTH = 60;

/** 拖拽调宽所需的额外表头属性，由 useColumnSettings 通过 onHeaderCell 注入 */
export interface ColumnResizeProps {
  /** 当前生效列宽，拖拽起点基准；缺省时用 th 实际渲染宽度兜底 */
  width?: number;
  /** 拖拽过程中的实时宽度回调（仅更新内存态，用于即时反馈） */
  onColumnResize?: (width: number) => void;
  /** 松手时的最终宽度回调（由此落盘持久化） */
  onColumnResizeEnd?: (width: number) => void;
}

type ResizableHeaderCellProps = ThHTMLAttributes<HTMLTableCellElement> & ColumnResizeProps;

/** 一次拖拽的上下文：按下时的指针位置与列宽，以及最近一次计算出的宽度 */
interface DragContext {
  startX: number;
  startWidth: number;
  latestWidth: number;
}

/**
 * 可拖拽调宽的表头单元格：右缘渲染 8px 拖拽手柄，指针事件实时计算列宽（不低于 MIN_COLUMN_WIDTH）。
 * 未传 onColumnResize（如操作列不允许调宽）时退化为普通 th。
 * 用法：Table 的 components={{ header: { cell: ResizableHeaderCell } }}，宽度回调由 onHeaderCell 提供。
 */
export default function ResizableHeaderCell({
  width,
  onColumnResize,
  onColumnResizeEnd,
  children,
  style,
  ...restProps
}: ResizableHeaderCellProps) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const dragRef = useRef<DragContext | null>(null);
  // 手柄高亮：hover 或拖拽中
  const [active, setActive] = useState(false);

  // 不可调宽的列（如操作列）保持原生表头行为
  if (!onColumnResize) {
    return (
      <th {...restProps} style={style}>
        {children}
      </th>
    );
  }

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setActive(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag) {
      onColumnResizeEnd?.(drag.latestWidth);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    // 阻断冒泡与默认行为：避免触发列排序、拖动中选中表头文字
    event.preventDefault();
    event.stopPropagation();
    const startWidth =
      typeof width === 'number' && Number.isFinite(width)
        ? width
        : thRef.current?.offsetWidth ?? MIN_COLUMN_WIDTH;
    dragRef.current = { startX: event.clientX, startWidth, latestWidth: startWidth };
    setActive(true);
    // 指针捕获：后续 move/up 事件全部落到手柄上，天然规避移出元素丢事件与文本选中
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = Math.max(MIN_COLUMN_WIDTH, Math.round(drag.startWidth + event.clientX - drag.startX));
    // 宽度未变化时不触发状态更新，减少拖拽期间的重渲染
    if (next === drag.latestWidth) return;
    drag.latestWidth = next;
    onColumnResize(next);
  };

  return (
    <th {...restProps} ref={thRef} style={{ ...style, position: 'relative' }}>
      {children}
      <span
        // 手柄自身吞掉点击，避免落到表头触发排序
        onClick={(event) => event.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => {
          // 拖拽中移出不取消高亮，等松手统一收尾
          if (!dragRef.current) setActive(false);
        }}
        style={{
          position: 'absolute',
          top: 0,
          // 完全落在单元格内侧：不向右溢出，避免末列手柄撑宽横向滚动区
          right: 0,
          bottom: 0,
          width: 8,
          cursor: 'col-resize',
          // 触屏下禁用手势滚动，保证 pointermove 连续
          touchAction: 'none',
          userSelect: 'none',
          zIndex: 1,
          background: active ? 'rgba(47, 84, 235, 0.35)' : 'transparent',
          transition: 'background 0.2s',
        }}
      />
    </th>
  );
}
