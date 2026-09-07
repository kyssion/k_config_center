import { useCallback, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { listOperationLogs } from '@/api/operationLog';
import type { OperationLogQuery, OperationLogResponse } from '@/api/types';
import { useTableRequest } from '@/hooks/useTableRequest';
import { useColumnSettings } from '@/hooks/useColumnSettings';
import PageContainer from '@/components/PageContainer';
import ColumnSettingButton from '@/components/ColumnSettingButton';
import DimensionCell from '@/components/DimensionCell';
import type { DataTableColumn } from '@/components/DataTable';
import { DataTable } from '@/components/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** 操作类型 → 中文文案/着色（与后端 OperationType 枚举对齐） */
const operationMeta: Record<string, { label: string; badge: string }> = {
  CREATE: { label: '创建', badge: 'border-transparent bg-sky-50 text-sky-700' },
  UPDATE: { label: '更新', badge: 'border-transparent bg-amber-50 text-amber-700' },
  DELETE: { label: '删除', badge: 'border-transparent bg-red-50 text-red-700' },
  PUBLISH: { label: '发布', badge: 'border-transparent bg-emerald-50 text-emerald-700' },
  ROLLBACK: { label: '回滚', badge: 'border-transparent bg-violet-50 text-violet-700' },
  OFFLINE: { label: '下线', badge: '' },
};

/** ISO 时间字符串 → 本地可读格式 */
const formatTime = (iso: string) => new Date(iso).toLocaleString('zh-CN', { hour12: false });

/** detail 字段格式化：合法 JSON 缩进展示，否则原样输出 */
const formatDetail = (detail: string) => {
  try {
    return JSON.stringify(JSON.parse(detail), null, 2);
  } catch {
    return detail;
  }
};

/** datetime-local 输入值（YYYY-MM-DDTHH:mm）→ ISO 字符串，空串返回 undefined */
const toIso = (value: string) => (value ? new Date(value).toISOString() : undefined);

/** 操作审计页：操作人/时间范围检索 + 分页日志表格 + detail JSON 展开查看 */
export default function OperationLogList() {
  // 检索草稿：操作人与时间范围（datetime-local 原生输入，值为本地时间字符串）
  const [operatorInput, setOperatorInput] = useState('');
  const [startTimeInput, setStartTimeInput] = useState('');
  const [endTimeInput, setEndTimeInput] = useState('');

  // 生效中的查询参数：点「查询」或分页切换时更新（初值为空 = 全部）
  const [query, setQuery] = useState<OperationLogQuery>(() => ({
    pageIndex: 1,
    pageSize: 10,
  }));

  const fetcher = useCallback(() => listOperationLogs(query), [query]);
  const { data, loading } = useTableRequest(fetcher);

  // 点「查询」：以草稿值重建查询参数并回到第一页；时间区间转 ISO 字符串（[startTime, endTime)）
  const handleSearch = () => {
    setQuery({
      operator: operatorInput.trim() || undefined,
      startTime: toIso(startTimeInput),
      endTime: toIso(endTimeInput),
      pageIndex: 1,
      pageSize: query.pageSize,
    });
  };

  const handleReset = () => {
    setOperatorInput('');
    setStartTimeInput('');
    setEndTimeInput('');
    setQuery({ pageIndex: 1, pageSize: query.pageSize });
  };

  /** 维度列统一展示：名称 Badge + key 两行（与各管理页一致）；未关联该维度（id 为空）显示「-」 */
  const renderDimension = (
    name: string | null | undefined,
    key: string | null | undefined,
    id: number | null,
    tone: 'blue' | 'cyan' | 'sky' | 'purple',
  ) => (id == null ? '-' : <DimensionCell name={name} dimensionKey={key} id={id} tone={tone} />);

  const columns: DataTableColumn<OperationLogResponse>[] = [
    {
      key: 'id',
      title: 'ID',
      width: 80,
      render: (record) => <span className="font-mono text-xs text-muted-foreground">{record.id}</span>,
    },
    {
      key: 'operation',
      title: '操作',
      width: 100,
      render: (record) => {
        const meta = operationMeta[record.operation];
        return meta ? (
          meta.badge ? (
            <Badge variant="outline" className={meta.badge}>
              {meta.label}
            </Badge>
          ) : (
            <Badge variant="secondary">{meta.label}</Badge>
          )
        ) : (
          <Badge variant="outline">{record.operation}</Badge>
        );
      },
    },
    {
      key: 'namespaceId',
      title: '命名空间',
      width: 150,
      render: (record) => renderDimension(record.namespaceName, record.namespaceKey, record.namespaceId, 'blue'),
    },
    {
      key: 'environmentId',
      title: '环境',
      width: 130,
      render: (record) => renderDimension(record.environmentName, record.environmentKey, record.environmentId, 'cyan'),
    },
    {
      key: 'groupId',
      title: '配置组',
      width: 150,
      render: (record) => renderDimension(record.groupName, record.groupKey, record.groupId, 'sky'),
    },
    {
      key: 'configurationId',
      title: '配置项',
      width: 170,
      // 配置项无显示名称，只展示 key 行（关联不到时回退展示 #id）
      render: (record) => renderDimension(null, record.configurationKey, record.configurationId, 'purple'),
    },
    {
      key: 'operator',
      title: '操作人',
      width: 120,
      render: (record) => record.operator || '-',
    },
    {
      key: 'clientIpAddress',
      title: 'IP',
      width: 140,
      render: (record) => record.clientIpAddress || '-',
    },
    {
      key: 'createdAt',
      title: '时间',
      width: 170,
      render: (record) => formatTime(record.createdAt),
    },
  ];

  // 列配置：显隐/宽度按页面持久化；表头拖拽调宽由 useColumnSettings 注入
  const { mergedColumns, columnMetas, setVisible, setWidth, reset } = useColumnSettings('operation-log-list', columns);

  return (
    <PageContainer
      title="操作审计"
      icon={<ClipboardList className="size-5" />}
      description="多维度检索配置变更与发布操作记录"
    >
      {/* 筛选区：卡片内顶部一行，右侧列配置按钮 */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-40"
            placeholder="操作人（模糊匹配）"
            value={operatorInput}
            onChange={(e) => setOperatorInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Input
            type="datetime-local"
            className="w-56"
            aria-label="开始时间"
            value={startTimeInput}
            onChange={(e) => setStartTimeInput(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">至</span>
          <Input
            type="datetime-local"
            className="w-56"
            aria-label="结束时间"
            value={endTimeInput}
            onChange={(e) => setEndTimeInput(e.target.value)}
          />
          <Button onClick={handleSearch}>查询</Button>
          <Button variant="outline" onClick={handleReset}>
            重置
          </Button>
        </div>
        <ColumnSettingButton columnMetas={columnMetas} setVisible={setVisible} setWidth={setWidth} reset={reset} />
      </div>
      <DataTable
        rowKey={(record) => record.id}
        columns={mergedColumns}
        data={data?.items ?? []}
        loading={loading}
        pagination={{
          pageIndex: query.pageIndex,
          pageSize: query.pageSize ?? 10,
          total: data?.total ?? 0,
          onChange: (pageIndex, pageSize) => setQuery((prev) => ({ ...prev, pageIndex, pageSize })),
        }}
        expandable={{
          rowExpandable: (record) => !!record.detail,
          // detail 变更详情：JSON 格式化后展示，非 JSON 内容原样兜底
          expandedRender: (record) => (
            <pre className="m-0 max-h-80 overflow-auto font-mono text-xs">{formatDetail(record.detail ?? '')}</pre>
          ),
        }}
      />
    </PageContainer>
  );
}
