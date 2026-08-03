import { useCallback, useState } from 'react';
import { Button, DatePicker, Form, Input, Space, Table, Tag } from 'antd';
import { AuditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { listOperationLogs } from '@/api/operationLog';
import type { OperationLogQuery, OperationLogResponse } from '@/api/types';
import { useTableRequest } from '@/hooks/useTableRequest';
import { useColumnSettings } from '@/hooks/useColumnSettings';
import PageContainer from '@/components/PageContainer';
import ColumnSettingButton from '@/components/ColumnSettingButton';
import DimensionCell from '@/components/DimensionCell';

/** 检索表单字段：仅保留操作人与时间范围，时间范围为 Dayjs 区间，提交时转 ISO 字符串 */
interface LogSearchValues {
  operator?: string;
  timeRange?: [Dayjs | null, Dayjs | null] | null;
}

/** 操作类型 → 中文文案/着色（与后端 OperationType 枚举对齐） */
const operationMeta: Record<string, { label: string; color: string }> = {
  CREATE: { label: '创建', color: 'blue' },
  UPDATE: { label: '更新', color: 'gold' },
  DELETE: { label: '删除', color: 'red' },
  PUBLISH: { label: '发布', color: 'green' },
  ROLLBACK: { label: '回滚', color: 'purple' },
  OFFLINE: { label: '下线', color: 'default' },
};

/** ISO 时间字符串 → 本地可读格式 */
const formatTime = (iso: string) => new Date(iso).toLocaleString('zh-CN', { hour12: false });

/** 维度列统一展示：名称 Tag + key 两行（与各管理页一致）；未关联该维度（id 为空）显示 「-」 */
const renderDimension = (
  name: string | null | undefined,
  key: string | null | undefined,
  id: number | null,
  color: string,
) => (id == null ? '-' : <DimensionCell name={name} dimensionKey={key} id={id} color={color} />);

/** detail 字段格式化：合法 JSON 缩进展示，否则原样输出 */
const formatDetail = (detail: string) => {
  try {
    return JSON.stringify(JSON.parse(detail), null, 2);
  } catch {
    return detail;
  }
};

/** 操作审计页：操作人/时间范围检索表单 + 分页日志表格 + detail JSON 展开查看 */
export default function OperationLogList() {
  const [form] = Form.useForm<LogSearchValues>();

  // 生效中的查询参数：表单点「查询」或分页切换时更新（初值为空 = 全部）
  const [query, setQuery] = useState<OperationLogQuery>(() => ({
    pageIndex: 1,
    pageSize: 10,
  }));

  const fetcher = useCallback(() => listOperationLogs(query), [query]);
  const { data, loading } = useTableRequest(fetcher);

  // 点「查询」：以表单值重建查询参数并回到第一页；时间区间转 ISO 字符串（[startTime, endTime)）
  const handleSearch = (values: LogSearchValues) => {
    const [start, end] = values.timeRange ?? [null, null];
    setQuery({
      operator: values.operator?.trim() || undefined,
      startTime: start ? start.toISOString() : undefined,
      endTime: end ? end.toISOString() : undefined,
      pageIndex: 1,
      pageSize: query.pageSize,
    });
  };

  const handleReset = () => {
    form.resetFields();
    setQuery({ pageIndex: 1, pageSize: query.pageSize });
  };

  const columns: ColumnsType<OperationLogResponse> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (v: number) => <span style={{ color: '#8c8c8c', fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '操作',
      dataIndex: 'operation',
      key: 'operation',
      width: 100,
      render: (v: string) => {
        const meta = operationMeta[v];
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v}</Tag>;
      },
    },
    {
      title: '命名空间',
      dataIndex: 'namespaceId',
      key: 'namespaceId',
      width: 150,
      render: (_: unknown, record) =>
        renderDimension(record.namespaceName, record.namespaceKey, record.namespaceId, 'geekblue'),
    },
    {
      title: '环境',
      dataIndex: 'environmentId',
      key: 'environmentId',
      width: 130,
      render: (_: unknown, record) =>
        renderDimension(record.environmentName, record.environmentKey, record.environmentId, 'cyan'),
    },
    {
      title: '配置组',
      dataIndex: 'groupId',
      key: 'groupId',
      width: 150,
      render: (_: unknown, record) =>
        renderDimension(record.groupName, record.groupKey, record.groupId, 'blue'),
    },
    {
      title: '配置项',
      dataIndex: 'configurationId',
      key: 'configurationId',
      width: 170,
      // 配置项无显示名称，只展示 key 行（关联不到时回退展示 #id）
      render: (_: unknown, record) =>
        renderDimension(null, record.configurationKey, record.configurationId, 'purple'),
    },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 120, render: (v: string | null) => v || '-' },
    { title: 'IP', dataIndex: 'clientIpAddress', key: 'clientIpAddress', width: 140, render: (v: string | null) => v || '-' },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 170, render: formatTime },
  ];

  // 列配置：显隐/宽度按页面持久化；components 提供表头拖拽调宽
  const { mergedColumns, components, columnMetas, setVisible, setWidth, reset } = useColumnSettings(
    'operation-log-list',
    columns,
  );

  return (
    <PageContainer
      title="操作审计"
      icon={<AuditOutlined />}
      accentColor="#722ed1"
      description="多维度检索配置变更与发布操作记录"
    >
      {/* 筛选区：卡片内顶部一行，右侧列配置按钮，与表格之间留 16px 间距 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSearch} style={{ rowGap: 12, flex: 1 }}>
          <Form.Item name="operator" label="操作人">
            <Input style={{ width: 160 }} placeholder="全部（模糊匹配）" allowClear />
          </Form.Item>
          <Form.Item name="timeRange" label="时间范围">
            <DatePicker.RangePicker showTime allowClear />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
        <ColumnSettingButton columnMetas={columnMetas} setVisible={setVisible} setWidth={setWidth} reset={reset} />
      </div>
      <Table<OperationLogResponse>
        rowKey="id"
        size="middle"
        columns={mergedColumns}
        components={components}
        dataSource={data?.items ?? []}
        loading={loading}
        // 窄窗口下横向滚动，避免内容越过容器
        scroll={{ x: 'max-content' }}
        pagination={{
          current: query.pageIndex,
          pageSize: query.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (pageIndex, pageSize) => setQuery((prev) => ({ ...prev, pageIndex, pageSize })),
        }}
        expandable={{
          rowExpandable: (record) => !!record.detail,
          // detail 变更详情：JSON 格式化后展示，非 JSON 内容原样兜底
          expandedRowRender: (record) => (
            <pre style={{ margin: 0, maxHeight: 320, overflow: 'auto', fontSize: 12 }}>
              {formatDetail(record.detail ?? '')}
            </pre>
          ),
        }}
      />
    </PageContainer>
  );
}
