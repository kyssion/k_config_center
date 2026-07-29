import { useState } from 'react';
import { Button, Divider, Form, Input, Popconfirm, Space, Table, Tag, message } from 'antd';
import { AppstoreOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { createNamespace, deleteNamespace, listNamespaces, updateNamespace } from '@/api/namespace';
import type { NamespaceResponse } from '@/api/types';
import { useTableRequest } from '@/hooks/useTableRequest';
import { useColumnSettings } from '@/hooks/useColumnSettings';
import PageContainer from '@/components/PageContainer';
import FormDrawer from '@/components/FormDrawer';
import CopyableText from '@/components/CopyableText';
import ColumnSettingButton from '@/components/ColumnSettingButton';

/** 抽屉表单字段：新建含 key，编辑时 key 只读展示不提交 */
interface NamespaceFormValues {
  namespaceKey: string;
  namespaceName: string;
  description?: string;
}

/** ISO 时间字符串 → 本地可读格式 */
const formatTime = (iso: string) => new Date(iso).toLocaleString('zh-CN', { hour12: false });

/** 命名空间管理页：列表（关键字本地过滤）+ 新建/编辑抽屉 + 启用禁用切换 + 删除（软删除，二次确认） */
export default function NamespaceList() {
  const { data, loading, reload } = useTableRequest(listNamespaces);
  // 关键字筛选：前端本地过滤名称 / Key
  const [keyword, setKeyword] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 当前编辑的记录，null 表示新建
  const [editing, setEditing] = useState<NamespaceResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<NamespaceFormValues>();

  const kw = keyword.trim().toLowerCase();
  const filteredData = (data ?? []).filter(
    (item) =>
      !kw ||
      item.namespaceName.toLowerCase().includes(kw) ||
      item.namespaceKey.toLowerCase().includes(kw),
  );

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (record: NamespaceResponse) => {
    setEditing(record);
    form.setFieldsValue({
      namespaceKey: record.namespaceKey,
      namespaceName: record.namespaceName,
      description: record.description ?? undefined,
    });
    setDrawerOpen(true);
  };

  // 新建/编辑提交：错误提示由 http.ts 拦截器统一弹出，这里只处理成功分支
  const handleSubmit = async () => {
    let values: NamespaceFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 表单校验失败，AntD 已在字段上展示错误
    }
    setSubmitting(true);
    try {
      if (editing) {
        await updateNamespace(editing.id, {
          namespaceName: values.namespaceName,
          description: values.description ?? null,
          status: editing.status, // 状态由列表行内切换维护，编辑抽屉不改
        });
        message.success('更新成功');
      } else {
        await createNamespace({
          namespaceKey: values.namespaceKey,
          namespaceName: values.namespaceName,
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
  const handleToggleStatus = async (record: NamespaceResponse) => {
    const next = record.status === 1 ? 0 : 1;
    try {
      await updateNamespace(record.id, {
        namespaceName: record.namespaceName,
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
      await deleteNamespace(id);
      message.success('删除成功');
      reload();
    } catch {
      // 接口错误已由拦截器提示
    }
  };

  const columns: ColumnsType<NamespaceResponse> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (v: number) => <span style={{ color: '#8c8c8c', fontFamily: 'monospace' }}>{v}</span>,
    },
    { title: '名称', dataIndex: 'namespaceName', key: 'namespaceName' },
    { title: 'Key', dataIndex: 'namespaceKey', key: 'namespaceKey', render: (v: string) => <CopyableText value={v} code /> },
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
          <Popconfirm title="确定删除该命名空间？" onConfirm={() => handleDelete(record.id)}>
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
    'namespace-list',
    columns,
  );

  return (
    <PageContainer
      title="命名空间管理"
      icon={<AppstoreOutlined />}
      description="以业务域划分配置隔离边界，命名空间下挂环境与配置组"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建命名空间
        </Button>
      }
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <Space wrap>
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
      <Table<NamespaceResponse>
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
        title={editing ? '编辑命名空间' : '新建命名空间'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmit}
        loading={submitting}
        form={form}
        okText={editing ? '保存' : '创建'}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="namespaceName"
            label="名称"
            rules={[{ required: true, message: '请输入命名空间名称' }]}
          >
            <Input placeholder="如 订单中心" />
          </Form.Item>
          <Form.Item
            name="namespaceKey"
            label="Key"
            rules={[{ required: true, message: '请输入命名空间 Key' }]}
          >
            <Input placeholder="如 order-center" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </FormDrawer>
    </PageContainer>
  );
}
