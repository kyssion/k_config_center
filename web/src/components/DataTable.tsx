import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ResizableHeaderCell from '@/components/ResizableHeaderCell';
import type { ColumnResizeProps } from '@/components/ResizableHeaderCell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** 单列定义：key 必填（列配置持久化的稳定标识），render 缺省时直接展示 record[key] */
export interface DataTableColumn<T> {
  key: string;
  title: ReactNode;
  width?: number;
  align?: 'left' | 'center' | 'right';
  render?: (record: T) => ReactNode;
  /** useColumnSettings 注入的表头拖拽调宽属性，页面代码不传 */
  headerResize?: ColumnResizeProps;
}

/** 分页配置：不传 total（服务端总数）时为客户端本地分页，传了则受控翻页 */
export interface DataTablePagination {
  pageSize: number;
  pageIndex?: number;
  total?: number;
  onChange?: (pageIndex: number, pageSize: number) => void;
}

/** 行选择配置：maxSelected 限制最多可选行数（如版本对比选 2 个） */
interface DataTableRowSelection<T> {
  selectedKeys: (number | string)[];
  maxSelected?: number;
  onSelect: (record: T, selected: boolean) => void;
}

/** 行展开配置：detail JSON 展示等场景 */
interface DataTableExpandable<T> {
  rowExpandable: (record: T) => boolean;
  expandedRender: (record: T) => ReactNode;
}

interface DataTableProps<T> {
  rowKey: (record: T) => number | string;
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  pagination?: DataTablePagination;
  rowSelection?: DataTableRowSelection<T>;
  expandable?: DataTableExpandable<T>;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** 生成页码序列：首尾恒显，中间窗口，超出以 '…' 占位 */
function buildPageItems(current: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: (number | '…')[] = [1];
  const windowStart = Math.max(2, current - 1);
  const windowEnd = Math.min(totalPages - 1, current + 1);
  if (windowStart > 2) items.push('…');
  for (let i = windowStart; i <= windowEnd; i++) items.push(i);
  if (windowEnd < totalPages - 1) items.push('…');
  items.push(totalPages);
  return items;
}

const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

/**
 * 通用数据表格（antd Table 的替代）：列定义 + loading 遮罩 + 分页（客户端/服务端）+
 * 行选择（可限选数）+ 行展开 + 表头拖拽调宽（由 useColumnSettings 注入 headerResize）。
 * 窄窗口横向滚动（table min-w-max），不换行挤压内容。
 */
export function DataTable<T>({
  rowKey,
  columns,
  data,
  loading,
  pagination,
  rowSelection,
  expandable,
}: DataTableProps<T>) {
  const serverSide = pagination?.total !== undefined;
  // 客户端分页的本地页码/页容量；服务端分页取受控值
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(pagination?.pageSize ?? 10);
  const pageIndex = serverSide ? pagination!.pageIndex ?? 1 : clientPage;
  const pageSize = serverSide ? pagination!.pageSize : clientPageSize;

  const total = serverSide ? pagination!.total! : data.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageData = serverSide ? data : data.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);

  // 客户端分页：数据刷新后总页数变少时修正越界的当前页
  useEffect(() => {
    if (!serverSide && clientPage > totalPages) {
      setClientPage(totalPages);
    }
  }, [serverSide, clientPage, totalPages]);

  // 展开行：已展开的 key 集合（可同时展开多行）
  const [expandedKeys, setExpandedKeys] = useState<(number | string)[]>([]);

  const changePage = (nextPage: number, nextSize: number) => {
    if (serverSide) {
      pagination!.onChange?.(nextPage, nextSize);
    } else {
      setClientPageSize(nextSize);
      setClientPage(nextSize === pageSize ? nextPage : 1);
    }
  };

  const columnCount = columns.length + (rowSelection ? 1 : 0) + (expandable ? 1 : 0);
  const pageItems = useMemo(() => buildPageItems(pageIndex, totalPages), [pageIndex, totalPages]);

  const toggleExpanded = (key: number | string) => {
    setExpandedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  return (
    <div className="space-y-3">
      <div className={cn('relative w-full overflow-x-auto rounded-xl border bg-card shadow-xs', loading && 'opacity-60')}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b">
              {expandable && <th className="w-10 px-3 py-2.5" />}
              {rowSelection && <th className="w-10 px-3 py-2.5" />}
              {columns.map((column) =>
                column.headerResize ? (
                  <ResizableHeaderCell
                    key={column.key}
                    className={cn(
                      'h-11 px-3 align-middle text-xs font-medium whitespace-nowrap text-muted-foreground',
                      alignClass[column.align ?? 'left'],
                    )}
                    style={column.width ? { width: column.width } : undefined}
                    {...column.headerResize}
                  >
                    {column.title}
                  </ResizableHeaderCell>
                ) : (
                  <th
                    key={column.key}
                    className={cn(
                      'h-11 px-3 align-middle text-xs font-medium whitespace-nowrap text-muted-foreground',
                      alignClass[column.align ?? 'left'],
                    )}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {column.title}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-3 py-16">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {loading ? (
                      <Loader2 className="size-7 animate-spin opacity-60" />
                    ) : (
                      <Inbox className="size-8 opacity-40" />
                    )}
                    <span className="text-sm">{loading ? '加载中…' : '暂无数据'}</span>
                  </div>
                </td>
              </tr>
            )}
            {pageData.map((record) => {
              const key = rowKey(record);
              const selected = rowSelection?.selectedKeys.includes(key) ?? false;
              const expandableRow = expandable?.rowExpandable(record) ?? false;
              const expanded = expandableRow && expandedKeys.includes(key);
              return (
                <Fragment key={key}>
                  <tr className={cn('border-b transition-colors last:border-b-0 hover:bg-muted/40', selected && 'bg-muted/60')}>
                    {expandable && (
                      <td className="px-3 py-3">
                        {expandableRow ? (
                          <button
                            type="button"
                            aria-label={expanded ? '收起' : '展开'}
                            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent cursor-pointer"
                            onClick={() => toggleExpanded(key)}
                          >
                            <ChevronDown className={cn('size-4 transition-transform', !expanded && '-rotate-90')} />
                          </button>
                        ) : (
                          <span className="inline-block size-6" />
                        )}
                      </td>
                    )}
                    {rowSelection && (
                      <td className="px-3 py-3">
                        <Checkbox
                          aria-label="选择该行"
                          checked={selected}
                          disabled={!selected && (rowSelection.selectedKeys.length >= (rowSelection.maxSelected ?? Infinity))}
                          onCheckedChange={(checked) => rowSelection.onSelect(record, checked === true)}
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn('px-3 py-3 align-middle', alignClass[column.align ?? 'left'])}
                        style={column.width ? { width: column.width } : undefined}
                      >
                        {column.render
                          ? column.render(record)
                          : String((record as Record<string, unknown>)[column.key] ?? '-')}
                      </td>
                    ))}
                  </tr>
                  {expanded && expandable && (
                    <tr className="border-b">
                      <td colSpan={columnCount} className="bg-muted/20 px-6 py-3">
                        {expandable.expandedRender(record)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">共 {total} 条</span>
          <div className="flex items-center gap-1.5">
            <Select
              value={String(pageSize)}
              onValueChange={(value) => changePage(1, Number(value))}
            >
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
                <span className="text-xs text-muted-foreground">条/页</span>
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} 条/页
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={pageIndex <= 1}
              onClick={() => changePage(pageIndex - 1, pageSize)}
              aria-label="上一页"
            >
              <ChevronLeft />
            </Button>
            {pageItems.map((item, index) =>
              item === '…' ? (
                <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  variant={item === pageIndex ? 'default' : 'ghost'}
                  size="icon"
                  className="size-8 text-xs"
                  onClick={() => changePage(item, pageSize)}
                >
                  {item}
                </Button>
              ),
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={pageIndex >= totalPages}
              onClick={() => changePage(pageIndex + 1, pageSize)}
              aria-label="下一页"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
