import { useCallback, useState } from 'react';
import {
  Button,
  Divider,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { FolderOpenOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { createGroup, deleteGroup, listGroups, updateGroup } from '@/api/group';
import { listEnvironments } from '@/api/environment';
import { listNamespaces } from '@/api/namespace';
import type { ConfigurationGroupResponse, EnvironmentResponse } from '@/api/types';
import { useTableRequest } from '@/hooks/useTableRequest';
import { useColumnSettings } from '@/hooks/useColumnSettings';
import PageContainer from '@/components/PageContainer';
import FormDrawer from '@/components/FormDrawer';
import CopyableText from '@/components/CopyableText';
import DimensionCell from '@/components/DimensionCell';
import ColumnSettingButton from '@/components/ColumnSettingButton';

/** 抽屉表单字段：新建含命名空间/环境/key，编辑时三者只读展示不提交 */
interface GroupFormValues {
  namespaceId: number;
  environmentId: number;
  groupKey: string;
  groupName: string;
  description?: string;
}

/** ISO 时间字符串 → 本地可读格式 */
const formatTime = (iso: string) => new Date(iso).toLocaleString('zh-CN', { hour12: false });

/** 配置组管理页：命名空间/环境级联筛选（均可不选=全部）+ 关键字本地过滤 + 新建/编辑抽屉 */
export default function GroupList() {
  // 命名空间列表：筛选区下拉 / 抽屉表单共用同一份数据（下拉展开时 reload 取最新）
  const { data: namespaces, reload: reloadNamespaces } = useTableRequest(listNamespaces);
  // 筛选条件：均为 undefined 时查全部
  const [filterNamespaceId, setFilterNamespaceId] = useState<number>();
  const [filterEnvironmentId, setFilterEnvironmentId] = useState<number>();
  // 关键字筛选：前端本地过滤名称 / Key
  const [keyword, setKeyword] = useState('');

  // 筛选区环境选项：选了命名空间则拉该空间下环境，否则全量（下拉展开时 reload 取最新）
  const envFetcher = useCallback(() => listEnvironments(filterNamespaceId), [filterNamespaceId]);
  const { data: environments, reload: reloadEnvironments } = useTableRequest(envFetcher);

  // 筛选条件变化时 fetcher 引用变化，useTableRequest 自动重新加载
  const fetcher = useCallback(
    () => listGroups({ namespaceId: filterNamespaceId, environmentId: filterEnvironmentId }),
    [filterNamespaceId, filterEnvironmentId],
  );
  const { data, loading, reload } = useTableRequest(fetcher);

  const [drawerOpen, setDrawerOpen] = useState(false);
  // 当前编辑的记录，null 表示新建
  const [editing, setEditing] = useState<ConfigurationGroupResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 抽屉表单内的环境级联选项：按表单中选择的命名空间加载
  const [formEnvironments, setFormEnvironments] = useState<EnvironmentResponse[]>([]);
  const [form] = Form.useForm<GroupFormValues>();

  const namespaceOptions = (namespaces ?? []).map((n) => ({ label: n.namespaceName, value: n.id }));
  const environmentOptions = (environments ?? []).map((e) => ({
    label: e.environmentName,
    value: e.id,
  }));

  const kw = keyword.trim().toLowerCase();
  const filteredData = (data ?? []).filter(
    (item) =>
      !kw || item.groupName.toLowerCase().includes(kw) || item.groupKey.toLowerCase().includes(kw),
  );

  // 表单级联：每次直接按命名空间请求环境列表，保证拿到最新数据
  const loadFormEnvironments = (nsId: number) => {
    listEnvironments(nsId)
      .then(setFormEnvironments)
      .catch(() => undefined); // 接口错误已由拦截器提示
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setFormEnvironments([]);
    setDrawerOpen(true);
  };

  const openEdit = (record: ConfigurationGroupResponse) => {
    setEditing(record);
    loadFormEnvironments(record.namespaceId); // 让只读环境下拉能展示名称
    form.setFieldsValue({
      namespaceId: record.namespaceId,
      environmentId: record.environmentId,
      groupKey: record.groupKey,
      groupName: record.groupName,
      description: record.description ?? undefined,
    });
    setDrawerOpen(true);
  };

  // 新建/编辑提交：错误提示由 http.ts 拦截器统一弹出，这里只处理成功分支
  const handleSubmit = async () => {
    let values: GroupFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 表单校验失败，AntD 已在字段上展示错误
    }
    setSubmitting(true);
    try {
      if (editing) {
        await updateGroup(editing.id, {
          groupName: values.groupName,
          description: values.description ?? null,
          status: editing.status, // 状态由列表行内切换维护，编辑抽屉不改
        });
        message.success('更新成功');
      } else {
        await createGroup({
          namespaceId: values.namespaceId,
          environmentId: values.environmentId,
          groupKey: values.groupKey,
          groupName: values.groupName,
          description: values.description ?? null,
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
  const handleToggleStatus = async (record: ConfigurationGroupResponse) => {
    const next = record.status === 1 ? 0 : 1;
    try {
      await updateGroup(record.id, {
        groupName: record.groupName,
        description: record.description,
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
      await deleteGroup(id);
      message.success('删除成功');
      reload();
    } catch {
      // 接口错误已由拦截器提示
    }
  };

  const columns: ColumnsType<ConfigurationGroupResponse> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (v: number) => <span style={{ color: '#8c8c8c', fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '命名空间',
      dataIndex: 'namespaceId',
      key: 'namespaceId',
      width: 160,
      // 后端联查返回 key/名称；共享 DimensionCell（首行名称 Tag、次行 code 框展示 key，点击复制；key 缺失兜底显 #id）
      render: (_: unknown, record) => (
        <DimensionCell name={record.namespaceName} dimensionKey={record.namespaceKey} id={record.namespaceId} color="geekblue" />
      ),
    },
    {
      title: '环境',
      dataIndex: 'environmentId',
      key: 'environmentId',
      width: 140,
      render: (_: unknown, record) => (
        <DimensionCell name={record.environmentName} dimensionKey={record.environmentKey} id={record.environmentId} color="cyan" />
      ),
    },
    { title: '名称', dataIndex: 'groupName', key: 'groupName' },
    { title: 'Key', dataIndex: 'groupKey', key: 'groupKey', render: (v: string) => <CopyableText value={v} code /> },
    { title: '描述', dataIndex: 'description', key: 'description', render: (v: string | null) => v || '-' },
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
          <Popconfirm title="确定删除该配置组？" onConfirm={() => handleDelete(record.id)}>
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
    'group-list',
    columns,
  );

  return (
    <PageContainer
      title="配置组管理"
      icon={<FolderOpenOutlined />}
      accentColor="#fa8c16"
      description="按环境组织配置项集合，配置项归属于唯一配置组"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建配置组
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
            onChange={(v?: number) => {
              setFilterNamespaceId(v);
              setFilterEnvironmentId(undefined); // 命名空间变化时清空环境选中值
            }}
            onDropdownVisibleChange={(open) => open && reloadNamespaces()}
          />
          <Select
            allowClear
            placeholder="全部环境"
            style={{ width: 180 }}
            value={filterEnvironmentId}
            options={environmentOptions}
            onChange={(v?: number) => setFilterEnvironmentId(v)}
            onDropdownVisibleChange={(open) => open && reloadEnvironments()}
          />
          <Input.Search
            allowClear
            placeholder="搜索名称 / Key"
            style={{ width: 240 }}
            onSearch={setKeyword}
            onChange={(e) => {
              // 点清空按钮或删空输入时立即还原全量
              if (!e.target.value) setKeyword('');
            }}
          />
        </Space>
        <ColumnSettingButton columnMetas={columnMetas} setVisible={setVisible} setWidth={setWidth} reset={reset} />
      </div>
      <Table<ConfigurationGroupResponse>
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
        title={editing ? '编辑配置组' : '新建配置组'}
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
              onChange={(v: number) => {
                // 级联：切换命名空间后清空已选环境并重载环境选项
                form.setFieldsValue({ environmentId: undefined });
                loadFormEnvironments(v);
              }}
            />
          </Form.Item>
          <Form.Item
            name="environmentId"
            label="环境"
            rules={[{ required: true, message: '请选择环境' }]}
          >
            <Select
              placeholder={formEnvironments.length ? '请选择环境' : '请先选择命名空间'}
              options={formEnvironments.map((e) => ({ label: e.environmentName, value: e.id }))}
              disabled={!!editing}
              onDropdownVisibleChange={(open) => {
                // 展开即按当前已选命名空间重新请求，取最新环境列表
                const nsId = form.getFieldValue('namespaceId') as number | undefined;
                if (open && nsId) loadFormEnvironments(nsId);
              }}
            />
          </Form.Item>
          <Form.Item
            name="groupName"
            label="名称"
            rules={[{ required: true, message: '请输入配置组名称' }]}
          >
            <Input placeholder="如 应用主配置" />
          </Form.Item>
          <Form.Item
            name="groupKey"
            label="Key"
            rules={[{ required: true, message: '请输入配置组 Key' }]}
          >
            <Input placeholder="如 application" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </FormDrawer>
    </PageContainer>
  );
}
