import { useCallback, useState } from 'react';
import {
  Button,
  Divider,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { DeploymentUnitOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { createEnvironment, deleteEnvironment, listEnvironments, updateEnvironment } from '@/api/environment';
import { listNamespaces } from '@/api/namespace';
import type { EnvironmentResponse } from '@/api/types';
import { useTableRequest } from '@/hooks/useTableRequest';
import { useColumnSettings } from '@/hooks/useColumnSettings';
import PageContainer from '@/components/PageContainer';
import FormDrawer from '@/components/FormDrawer';
import CopyableText from '@/components/CopyableText';
import DimensionCell from '@/components/DimensionCell';
import ColumnSettingButton from '@/components/ColumnSettingButton';

/** 抽屉表单字段：新建含命名空间与 key，编辑时两者只读展示不提交 */
interface EnvironmentFormValues {
  namespaceId: number;
  environmentKey: string;
  environmentName: string;
  description?: string;
  sortOrder: number;
}

/** ISO 时间字符串 → 本地可读格式 */
const formatTime = (iso: string) => new Date(iso).toLocaleString('zh-CN', { hour12: false });

/** 环境管理页：命名空间 + 关键字筛选（点「查询」手动生效）+ 新建/编辑抽屉 */
export default function EnvironmentList() {
  // 命名空间列表：筛选区下拉 / 抽屉表单共用同一份数据（下拉展开时 reload 取最新）
  const { data: namespaces, reload: reloadNamespaces } = useTableRequest(listNamespaces);
  // 筛选草稿：命名空间 undefined 表示查全部，关键字为输入框受控值；点「查询」后才生效
  const [filterNamespaceId, setFilterNamespaceId] = useState<number>();
  const [keywordInput, setKeywordInput] = useState('');
  // 已生效的服务端筛选条件：点「查询」时由草稿快照生成（每次都是新对象，条件未变时也会触发刷新）
  const [applied, setApplied] = useState<{ namespaceId?: number }>({});
  // 关键字筛选（已生效）：前端本地过滤名称 / Key
  const [keyword, setKeyword] = useState('');
  // 已生效条件变化时 fetcher 引用变化，useTableRequest 自动重新加载
  const fetcher = useCallback(() => listEnvironments(applied.namespaceId), [applied]);
  const { data, loading, reload } = useTableRequest(fetcher);

  const [drawerOpen, setDrawerOpen] = useState(false);
  // 当前编辑的记录，null 表示新建
  const [editing, setEditing] = useState<EnvironmentResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<EnvironmentFormValues>();

  const namespaceOptions = (namespaces ?? []).map((n) => ({ label: n.namespaceName, value: n.id }));

  const kw = keyword.trim().toLowerCase();
  const filteredData = (data ?? []).filter(
    (item) =>
      !kw ||
      item.environmentName.toLowerCase().includes(kw) ||
      item.environmentKey.toLowerCase().includes(kw),
  );

  // 点「查询」/回车：草稿条件生效（命名空间走服务端筛选，关键字为本地过滤）
  const handleSearch = () => {
    setApplied({ namespaceId: filterNamespaceId });
    setKeyword(keywordInput);
  };

  // 点「重置」：清空草稿与已生效条件，恢复全量
  const handleResetFilter = () => {
    setFilterNamespaceId(undefined);
    setKeywordInput('');
    setApplied({});
    setKeyword('');
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ sortOrder: 0 });
    setDrawerOpen(true);
  };

  const openEdit = (record: EnvironmentResponse) => {
    setEditing(record);
    form.setFieldsValue({
      namespaceId: record.namespaceId,
      environmentKey: record.environmentKey,
      environmentName: record.environmentName,
      description: record.description ?? undefined,
      sortOrder: record.sortOrder,
    });
    setDrawerOpen(true);
  };

  // 新建/编辑提交：错误提示由 http.ts 拦截器统一弹出，这里只处理成功分支
  const handleSubmit = async () => {
    let values: EnvironmentFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 表单校验失败，AntD 已在字段上展示错误
    }
    setSubmitting(true);
    try {
      if (editing) {
        await updateEnvironment(editing.id, {
          environmentName: values.environmentName,
          description: values.description ?? null,
          sortOrder: values.sortOrder,
          status: editing.status, // 状态由列表行内切换维护，编辑抽屉不改
        });
        message.success('更新成功');
      } else {
        await createEnvironment({
          namespaceId: values.namespaceId,
          environmentKey: values.environmentKey,
          environmentName: values.environmentName,
          description: values.description ?? null,
          sortOrder: values.sortOrder,
        });
        message.success('创建成功');
      }
      setDrawerOpen(false);
      reload();
    } catch {
      // 接口错误已由拦截器提示
    } finally {
      setSubmitting(false);
    }
  };

  // 启用/禁用切换：复用更新接口，仅翻转 status
  const handleToggleStatus = async (record: EnvironmentResponse) => {
    const next = record.status === 1 ? 0 : 1;
    try {
      await updateEnvironment(record.id, {
        environmentName: record.environmentName,
        description: record.description,
        sortOrder: record.sortOrder,
        status: next,
      });
      message.success(next === 1 ? '已启用' : '已禁用');
      reload();
    } catch {
      // 接口错误已由拦截器提示
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteEnvironment(id);
      message.success('删除成功');
      reload();
    } catch {
      // 接口错误已由拦截器提示
    }
  };

  const columns: ColumnsType<EnvironmentResponse> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (v: number) => <span style={{ color: '#8c8c8c', fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '所属命名空间',
      dataIndex: 'namespaceId',
      key: 'namespaceId',
      width: 170,
      // 后端联查返回 key/名称；共享 DimensionCell（首行名称 Tag、次行 code 框展示 key，点击复制；key 缺失兜底显 #id）
      render: (_: unknown, record) => (
        <DimensionCell name={record.namespaceName} dimensionKey={record.namespaceKey} id={record.namespaceId} color="geekblue" />
      ),
    },
    { title: '名称', dataIndex: 'environmentName', key: 'environmentName' },
    { title: 'Key', dataIndex: 'environmentKey', key: 'environmentKey', render: (v: string) => <CopyableText value={v} code /> },
    { title: '描述', dataIndex: 'description', key: 'description', render: (v: string | null) => v || '-' },
    { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: number) => (v === 1 ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>),
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170, render: formatTime },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170, render: formatTime },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size={0} split={<Divider type="vertical" />}>
          <Button type="link" size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger={record.status === 1}
            onClick={() => handleToggleStatus(record)}
          >
            {record.status === 1 ? '禁用' : '启用'}
          </Button>
          <Popconfirm title="确定删除该环境？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 列配置：显隐/宽度按页面持久化，操作列强制显示；components 提供表头拖拽调宽
  const { mergedColumns, components, columnMetas, setVisible, setWidth, reset } = useColumnSettings(
    'environment-list',
    columns,
  );

  return (
    <PageContainer
      title="环境管理"
      icon={<DeploymentUnitOutlined />}
      accentColor="#13c2c2"
      description="管理各命名空间下的部署环境，支持排序与启用状态控制"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建环境
        </Button>
      }
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <Space wrap>
          <Select
            allowClear
            placeholder="全部命名空间"
            style={{ width: 200 }}
            value={filterNamespaceId}
            options={namespaceOptions}
            onChange={(v?: number) => setFilterNamespaceId(v)}
            onDropdownVisibleChange={(open) => open && reloadNamespaces()}
          />
          <Input
            allowClear
            placeholder="搜索名称 / Key"
            style={{ width: 240 }}
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
          <Button onClick={handleResetFilter}>重置</Button>
        </Space>
        <ColumnSettingButton columnMetas={columnMetas} setVisible={setVisible} setWidth={setWidth} reset={reset} />
      </div>
      <Table<EnvironmentResponse>
        rowKey="id"
        size="middle"
        columns={mergedColumns}
        components={components}
        dataSource={filteredData}
        loading={loading}
        // 窄窗口下横向滚动，避免内容越过容器
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
      />
      <FormDrawer
        title={editing ? '编辑环境' : '新建环境'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmit}
        loading={submitting}
        form={form}
        okText={editing ? '保存' : '创建'}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="namespaceId"
            label="命名空间"
            rules={[{ required: true, message: '请选择命名空间' }]}
          >
            <Select
              placeholder="请选择命名空间"
              options={namespaceOptions}
              disabled={!!editing}
              showSearch
              optionFilterProp="label"
              onDropdownVisibleChange={(open) => open && reloadNamespaces()}
            />
          </Form.Item>
          <Form.Item
            name="environmentName"
            label="名称"
            rules={[{ required: true, message: '请输入环境名称' }]}
          >
            <Input placeholder="如 开发环境" />
          </Form.Item>
          <Form.Item
            name="environmentKey"
            label="Key"
            rules={[{ required: true, message: '请输入环境 Key' }]}
          >
            <Input placeholder="如 dev / test / staging / prod" disabled={!!editing} />
          </Form.Item>
          <Form.Item
            name="sortOrder"
            label="排序值"
            rules={[{ required: true, message: '请输入排序值' }]}
          >
            <InputNumber style={{ width: '100%' }} placeholder="数值越小越靠前" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </FormDrawer>
    </PageContainer>
  );
}
