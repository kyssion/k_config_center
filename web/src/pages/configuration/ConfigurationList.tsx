import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Dropdown,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  MoreOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  createConfiguration,
  deleteConfiguration,
  listConfigurations,
  offlineConfiguration,
  publishConfiguration,
} from '@/api/configuration';
import { listGroups } from '@/api/group';
import { listNamespaces } from '@/api/namespace';
import { listEnvironments } from '@/api/environment';
import type {
  ConfigFormat,
  ConfigStatus,
  ConfigurationGroupResponse,
  ConfigurationResponse,
  EnvironmentResponse,
  NamespaceResponse,
} from '@/api/types';
import StatusTag from '@/components/StatusTag';
import FormatSelect from '@/components/FormatSelect';
import FormatTag from '@/components/FormatTag';
import PageContainer from '@/components/PageContainer';
import ContentPreview from '@/components/ContentPreview';
import CopyableText from '@/components/CopyableText';
import FormDrawer from '@/components/FormDrawer';
import ColumnSettingButton from '@/components/ColumnSettingButton';
import DimensionCell from '@/components/DimensionCell';
import ConfigurationDetailDrawer from '@/pages/configuration/ConfigurationDetailDrawer';
import { useTableRequest } from '@/hooks/useTableRequest';
import { useColumnSettings } from '@/hooks/useColumnSettings';
import { getFormatter } from '@/utils/formatters';

/** 时间字段本地化展示（ISO 8601 → 本地时间字符串） */
const formatTime = (value: string | null) => (value ? new Date(value).toLocaleString() : '-');

/** 状态筛选选项（与 StatusTag 文案对齐） */
const statusOptions: { value: ConfigStatus; label: string }[] = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PUBLISHED', label: '已发布' },
  { value: 'OFFLINE', label: '已下线' },
];

/** 维度列渲染：共享 DimensionCell（首行名称 Tag、次行 code 框展示业务 key，点击复制；key 缺失时兜底显 #id） */
const renderDimension = (name: string | null | undefined, key: string | null | undefined, id: number, color: string) => (
  <DimensionCell name={name} dimensionKey={key} id={id} color={color} />
);

/** 新建配置表单值 */
interface CreateFormValues {
  groupId: number;
  configurationKey: string;
  format: ConfigFormat;
  content?: string;
  description?: string;
}

/**
 * 配置项列表页：命名空间/环境/配置组三级级联 + 状态 + Key 关键字组合筛选（全可选，默认全量）；
 * 行操作：编辑 / 发布 / 下线 / 删除 / 版本历史；支持新建配置。
 */
export default function ConfigurationList() {
  const navigate = useNavigate();

  // 筛选条件：命名空间 → 环境 → 配置组三级级联，均可为空（空 = 不过滤）
  const [namespaceId, setNamespaceId] = useState<number | undefined>(undefined);
  const [environmentId, setEnvironmentId] = useState<number | undefined>(undefined);
  const [groupId, setGroupId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<ConfigStatus | undefined>(undefined);
  // keyword 拆两个 state：输入框受控值 + 点搜索/回车后生效的查询值（非输入即查）
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');

  // 级联下拉数据源
  const [namespaces, setNamespaces] = useState<NamespaceResponse[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentResponse[]>([]);
  const [groups, setGroups] = useState<ConfigurationGroupResponse[]>([]);

  // 发布弹窗：当前待发布的配置项
  const [publishTarget, setPublishTarget] = useState<ConfigurationResponse | null>(null);
  const [publishForm] = Form.useForm<{ changeRemark?: string }>();
  const [publishing, setPublishing] = useState(false);

  // 新建配置抽屉
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm<CreateFormValues>();
  const [creating, setCreating] = useState(false);
  // 监听新建表单格式选择：canFormat 的格式才展示「校验并格式化」按钮
  const createFormat = Form.useWatch('format', createForm);

  // 配置详情抽屉：非空即打开
  const [detailRecord, setDetailRecord] = useState<ConfigurationResponse | null>(null);

  // 下拉数据源请求序列号（参考 useTableRequest 的 requestIdRef）：只接受最新一次请求的结果，
  // 避免 useEffect 自动拉取与下拉展开刷新两通路乱序时旧响应覆盖新响应
  const namespaceRequestIdRef = useRef(0);
  const environmentRequestIdRef = useRef(0);
  const groupRequestIdRef = useRef(0);

  /** 刷新命名空间选项（useEffect 首次加载与下拉展开共用，序列号共享防竞态） */
  const refreshNamespaces = useCallback(() => {
    const currentId = ++namespaceRequestIdRef.current;
    listNamespaces()
      .then((result) => {
        if (namespaceRequestIdRef.current === currentId) setNamespaces(result);
      })
      .catch(() => undefined);
  }, []);

  /** 刷新环境选项：选了命名空间则按其过滤，否则全量 */
  const refreshEnvironments = useCallback(() => {
    const currentId = ++environmentRequestIdRef.current;
    listEnvironments(namespaceId)
      .then((result) => {
        if (environmentRequestIdRef.current === currentId) setEnvironments(result);
      })
      .catch(() => undefined);
  }, [namespaceId]);

  /** 刷新配置组选项：按当前所选命名空间/环境过滤（均可选，全不传为全量） */
  const refreshGroups = useCallback(() => {
    const currentId = ++groupRequestIdRef.current;
    listGroups({ namespaceId, environmentId })
      .then((result) => {
        if (groupRequestIdRef.current === currentId) setGroups(result);
      })
      .catch(() => undefined);
  }, [namespaceId, environmentId]);

  // 命名空间选择器数据源（一次性加载）
  useEffect(() => {
    refreshNamespaces();
  }, [refreshNamespaces]);

  // 环境选项：命名空间变化时重新拉取
  useEffect(() => {
    refreshEnvironments();
  }, [refreshEnvironments]);

  // 配置组选项：命名空间/环境变化时重新拉取；
  // 该列表同时作为表格「所属配置组」列的 id → 名称映射数据源
  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

  // 任一筛选条件变化即重载（useTableRequest 依赖 fetcher 引用，已防竞态）
  const fetcher = useCallback(
    () =>
      listConfigurations({
        namespaceId,
        environmentId,
        groupId,
        status,
        keyword: keyword || undefined,
      }),
    [namespaceId, environmentId, groupId, status, keyword],
  );
  const { data, loading, reload } = useTableRequest(fetcher);

  /** 发布确认：填变更备注后调用发布接口 */
  const handlePublish = async () => {
    if (!publishTarget) return;
    let values: { changeRemark?: string };
    try {
      values = await publishForm.validateFields();
    } catch {
      return; // 校验失败，错误已由表单项展示
    }
    setPublishing(true);
    try {
      const result = await publishConfiguration(publishTarget.id, {
        changeRemark: values.changeRemark || null,
      });
      message.success(`发布成功，版本号 v${result.versionNumber}`);
      setPublishTarget(null);
      publishForm.resetFields();
      reload();
    } catch {
      // 错误提示已由 http.ts 拦截器统一弹出
    } finally {
      setPublishing(false);
    }
  };

  /** 下线：仅 PUBLISHED 状态可下线 */
  const handleOffline = async (record: ConfigurationResponse) => {
    try {
      await offlineConfiguration(record.id);
      message.success('下线成功');
      reload();
    } catch {
      // 错误提示已由拦截器统一处理
    }
  };

  /** 删除（后端软删除） */
  const handleDelete = async (record: ConfigurationResponse) => {
    try {
      await deleteConfiguration(record.id);
      message.success('删除成功');
      reload();
    } catch {
      // 错误提示已由拦截器统一处理
    }
  };

  /** 新建配置确认 */
  const handleCreate = async () => {
    let values: CreateFormValues;
    try {
      values = await createForm.validateFields();
    } catch {
      return; // 校验失败，错误已由表单项展示
    }
    setCreating(true);
    try {
      await createConfiguration({
        groupId: values.groupId,
        configurationKey: values.configurationKey,
        format: values.format,
        content: values.content || null,
        description: values.description || null,
      });
      message.success('新建配置成功');
      setCreateOpen(false);
      createForm.resetFields();
      // 列表支持跨组展示，新建后直接刷新即可
      reload();
    } catch {
      // 错误提示已由拦截器统一处理
    } finally {
      setCreating(false);
    }
  };

  /** 新建表单「校验并格式化」：按当前格式取注册表校验，失败提示具体错误，通过则美化回写 */
  const handleFormatContent = () => {
    const content = createForm.getFieldValue('content') as string | undefined;
    if (!content?.trim()) {
      message.warning('配置值为空');
      return;
    }
    const formatter = getFormatter(createFormat ?? 'text');
    const error = formatter.validate(content);
    if (error) {
      message.error(`${createFormat} 校验失败：${error}`);
      return;
    }
    createForm.setFieldsValue({ content: formatter.format(content) });
    message.success(`${createFormat} 校验通过，已格式化`);
  };

  const columns: ColumnsType<ConfigurationResponse> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: number) => (
        <Typography.Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }} code>
          {id}
        </Typography.Text>
      ),
    },
    {
      title: '命名空间',
      dataIndex: 'namespaceName',
      key: 'namespaceName',
      width: 150,
      ellipsis: true,
      render: (_, record) => renderDimension(record.namespaceName, record.namespaceKey, record.namespaceId, 'geekblue'),
    },
    {
      title: '环境',
      dataIndex: 'environmentName',
      key: 'environmentName',
      width: 130,
      ellipsis: true,
      render: (_, record) => renderDimension(record.environmentName, record.environmentKey, record.environmentId, 'cyan'),
    },
    {
      title: '所属配置组',
      dataIndex: 'groupName',
      key: 'groupName',
      width: 150,
      ellipsis: true,
      render: (_, record) => renderDimension(record.groupName, record.groupKey, record.groupId, 'blue'),
    },
    {
      title: '配置项 Key',
      dataIndex: 'configurationKey',
      key: 'configurationKey',
      width: 220,
      render: (key: string) => <CopyableText value={key} code maxWidth={200} />,
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      width: 240,
      render: (_, record) => <ContentPreview content={record.content} format={record.format} />,
    },
    {
      title: '格式',
      dataIndex: 'format',
      key: 'format',
      width: 90,
      render: (format: string) => <FormatTag format={format} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <StatusTag status={status} />,
    },
    {
      title: '最新版本',
      dataIndex: 'latestVersionNumber',
      key: 'latestVersionNumber',
      width: 90,
      render: (n: number) => (n > 0 ? `v${n}` : '-'),
    },
    {
      title: '未发布变更',
      dataIndex: 'hasUnpublishedChange',
      key: 'hasUnpublishedChange',
      width: 120,
      // hasUnpublishedChange 由服务端计算，前端只做展示
      render: (has: boolean) =>
        has ? (
          <Tooltip title="此配置有草稿未发布，发布后对客户端生效">
            <Tag color="orange">有未发布变更</Tag>
          </Tooltip>
        ) : (
          <Typography.Text type="secondary">无</Typography.Text>
        ),
    },
    {
      title: '最后更新',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      // 时间 + 次行修改人（灰色小字），修改人为空时省略次行
      render: (value: string, record) => (
        <>
          <div>{formatTime(value)}</div>
          {record.updatedBy && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {record.updatedBy}
            </Typography.Text>
          )}
        </>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailRecord(record)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/configuration/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              publishForm.resetFields();
              setPublishTarget(record);
            }}
          >
            发布
          </Button>
          <Button type="link" size="small" onClick={() => navigate(`/configuration/${record.id}/versions`)}>
            版本历史
          </Button>
          {/* 低频/危险操作收纳进下拉菜单，点击后用 Modal.confirm 做二次确认，onOk 复用原 handler */}
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'offline',
                  label: '下线',
                  danger: true,
                  disabled: record.status !== 'PUBLISHED',
                  onClick: () =>
                    Modal.confirm({
                      title: '确认下线该配置？',
                      icon: <ExclamationCircleOutlined />,
                      content: '下线后客户端将无法再拉取该配置',
                      onOk: () => handleOffline(record),
                    }),
                },
                {
                  key: 'delete',
                  label: '删除',
                  danger: true,
                  onClick: () =>
                    Modal.confirm({
                      title: '确认删除该配置？',
                      icon: <ExclamationCircleOutlined />,
                      content: '删除为软删除，版本快照与日志保留',
                      onOk: () => handleDelete(record),
                    }),
                },
              ],
            }}
          >
            <Button type="link" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  // 列配置：显隐/宽度按页面 key 持久化，操作列（key='action'）强制显示；components 提供表头拖拽调宽
  const { mergedColumns, components, columnMetas, setVisible, setWidth, reset } = useColumnSettings(
    'configuration-list',
    columns,
  );

  return (
    <PageContainer
      title="配置管理"
      icon={<SettingOutlined />}
      description="集中维护服务运行参数，支持多格式内容、版本管理与发布流程"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            createForm.resetFields();
            // 默认选中当前过滤的配置组（未过滤时留空，表单内组必选）
            createForm.setFieldsValue({ groupId, format: 'text' });
            setCreateOpen(true);
          }}
        >
          新建配置
        </Button>
      }
    >
      {/* 筛选区：命名空间 → 环境 → 配置组三级级联 + 状态 + Key 关键字；右侧列配置入口 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
        <Space wrap>
          <Select
            style={{ width: 180 }}
            placeholder="全部命名空间"
            allowClear
            value={namespaceId}
            options={namespaces.map((n) => ({ value: n.id, label: n.namespaceName }))}
            onDropdownVisibleChange={(open) => {
              // 展开时重新拉取，避免其他页面新增后选项陈旧
              if (open) refreshNamespaces();
            }}
            onChange={(id) => {
              // 命名空间变化时清空下级环境/配置组选中值
              setNamespaceId(id);
              setEnvironmentId(undefined);
              setGroupId(undefined);
            }}
          />
          <Select
            style={{ width: 150 }}
            placeholder="全部环境"
            allowClear
            value={environmentId}
            options={environments.map((e) => ({ value: e.id, label: e.environmentName }))}
            onDropdownVisibleChange={(open) => {
              // 展开时按当前命名空间重新拉取
              if (open) refreshEnvironments();
            }}
            onChange={(id) => {
              // 环境变化时清空下级配置组选中值
              setEnvironmentId(id);
              setGroupId(undefined);
            }}
          />
          <Select
            style={{ width: 200 }}
            placeholder="全部配置组"
            allowClear
            value={groupId}
            options={groups.map((g) => ({ value: g.id, label: g.groupName }))}
            onDropdownVisibleChange={(open) => {
              // 展开时按当前命名空间/环境重新拉取
              if (open) refreshGroups();
            }}
            onChange={(id) => setGroupId(id)}
          />
          <Select
            style={{ width: 130 }}
            placeholder="全部状态"
            allowClear
            value={status}
            options={statusOptions}
            onChange={(v) => setStatus(v)}
          />
          <Input.Search
            style={{ width: 240 }}
            placeholder="按配置 Key 搜索"
            allowClear
            value={keywordInput}
            onChange={(e) => {
              const value = e.target.value;
              setKeywordInput(value);
              // allowClear 清空只触发 onChange，此处同步重置生效查询值；非空时仍为提交式搜索
              if (!value.trim()) setKeyword('');
            }}
            onSearch={(value) => setKeyword(value.trim())}
          />
        </Space>
        <ColumnSettingButton columnMetas={columnMetas} setVisible={setVisible} setWidth={setWidth} reset={reset} />
      </div>

      <Table<ConfigurationResponse>
        rowKey="id"
        columns={mergedColumns}
        components={components}
        dataSource={data ?? []}
        loading={loading}
        // 窄窗口下横向滚动，避免内容越过容器
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        size="middle"
      />

      {/* 发布弹窗：填写变更备注后发布 */}
      <Modal
        title={`发布配置：${publishTarget?.configurationKey ?? ''}`}
        open={publishTarget !== null}
        onOk={handlePublish}
        onCancel={() => setPublishTarget(null)}
        confirmLoading={publishing}
        okText="发布"
        width={520}
        maskClosable={false}
        destroyOnClose
      >
        <Form form={publishForm} layout="vertical">
          <Form.Item name="changeRemark" label="变更备注">
            <Input.TextArea rows={3} placeholder="本次发布的变更说明（可选）" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新建配置抽屉：脏表单关闭二次确认由 FormDrawer 内置 */}
      <FormDrawer
        title="新建配置"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        loading={creating}
        form={createForm}
        okText="创建"
        width={640}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="groupId" label="配置组" rules={[{ required: true, message: '请选择配置组' }]}>
            <Select
              placeholder="选择配置组"
              options={groups.map((g) => ({ value: g.id, label: g.groupName }))}
              onDropdownVisibleChange={(open) => {
                // 展开时按当前命名空间/环境重新拉取，与筛选区下拉同源
                if (open) refreshGroups();
              }}
            />
          </Form.Item>
          <Form.Item
            name="configurationKey"
            label="配置项 Key"
            rules={[{ required: true, message: '请输入配置项 Key' }]}
          >
            {/* maxLength 对齐建表脚本 configuration_key VARCHAR(256) */}
            <Input placeholder="如 application.yaml / redis.timeout" maxLength={256} showCount />
          </Form.Item>
          <Form.Item name="format" label="格式" rules={[{ required: true, message: '请选择格式' }]}>
            <FormatSelect />
          </Form.Item>
          <Form.Item
            name="content"
            label="配置值"
            extra={
              getFormatter(createFormat ?? 'text').canFormat && (
                <Button type="link" size="small" style={{ padding: 0 }} onClick={handleFormatContent}>
                  校验并格式化
                </Button>
              )
            }
          >
            <Input.TextArea rows={6} placeholder="配置内容（可选，也可创建后在编辑器中填写）" />
          </Form.Item>
          <Form.Item name="description" label="配置说明">
            {/* maxLength 对齐建表脚本 description VARCHAR(512) */}
            <Input.TextArea rows={2} placeholder="配置用途说明（可选）" maxLength={512} showCount />
          </Form.Item>
        </Form>
      </FormDrawer>

      {/* 配置详情抽屉：只读展示，编辑入口关闭抽屉后跳编辑器 */}
      <ConfigurationDetailDrawer
        open={detailRecord !== null}
        record={detailRecord}
        onClose={() => setDetailRecord(null)}
        onEdit={(id) => {
          setDetailRecord(null);
          navigate(`/configuration/${id}/edit`);
        }}
      />
    </PageContainer>
  );
}
