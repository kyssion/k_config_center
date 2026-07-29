import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getConfiguration, listVersions, rollbackConfiguration } from '@/api/configuration';
import type { ChangeType, ConfigurationDetailResponse, ConfigurationVersionResponse, PageResponse } from '@/api/types';
import DiffViewer from '@/components/DiffViewer';
import PageContainer from '@/components/PageContainer';
import ColumnSettingButton from '@/components/ColumnSettingButton';
import { useTableRequest } from '@/hooks/useTableRequest';
import { useColumnSettings } from '@/hooks/useColumnSettings';

/** 时间字段本地化展示 */
const formatTime = (value: string | null) => (value ? new Date(value).toLocaleString() : '-');

/** 变更类型 → 颜色/文案映射 */
const changeTypeMeta: Record<ChangeType, { color: string; label: string }> = {
  CREATE: { color: 'blue', label: '创建' },
  UPDATE: { color: 'cyan', label: '更新' },
  ROLLBACK: { color: 'orange', label: '回滚' },
};

/** Diff 弹窗数据 */
interface DiffState {
  oldTitle: string;
  newTitle: string;
  oldText: string;
  newText: string;
}

/**
 * 版本历史页：分页版本列表 + 任选两个版本 Diff +「当前编辑态 vs 生效版本」预设对比 + 回滚入口。
 */
export default function VersionHistory() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const configurationId = Number(id);
  // 路由参数非法（如手改 URL）：hooks 必须无条件执行，此处仅计算标记，跳转放在所有 hooks 之后
  const invalidId = !Number.isFinite(configurationId) || configurationId <= 0;

  // 配置详情：供「当前编辑态 vs 生效版本」预设对比与页头展示
  const [detail, setDetail] = useState<ConfigurationDetailResponse | null>(null);

  // 分页参数
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 勾选的版本（保存整行对象，跨页勾选也能取到内容），最多 2 个
  const [selected, setSelected] = useState<ConfigurationVersionResponse[]>([]);

  // Diff 弹窗
  const [diff, setDiff] = useState<DiffState | null>(null);

  // 回滚弹窗：目标版本
  const [rollbackTarget, setRollbackTarget] = useState<ConfigurationVersionResponse | null>(null);
  const [rollbackForm] = Form.useForm<{ changeRemark?: string }>();
  const [rollingBack, setRollingBack] = useState(false);

  // 非法 ID 仅提示一次，跳转由渲染末尾的 Navigate 完成
  useEffect(() => {
    if (invalidId) {
      message.error('配置 ID 非法');
    }
  }, [invalidId]);

  const loadDetail = useCallback(() => {
    if (invalidId) return Promise.resolve();
    return getConfiguration(configurationId)
      .then(setDetail)
      .catch(() => undefined);
  }, [configurationId, invalidId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // 版本列表：分页拉取（按版本号倒序）；非法 ID 不发请求，返回空结果占位
  const fetcher = useCallback(
    () =>
      invalidId
        ? Promise.resolve<PageResponse<ConfigurationVersionResponse>>({ items: [], total: 0 })
        : listVersions(configurationId, pageIndex, pageSize),
    [configurationId, invalidId, pageIndex, pageSize],
  );
  const { data, loading, reload } = useTableRequest(fetcher);

  /** 对比勾选的两个版本：版本号小的在左（旧），大的在右（新） */
  const handleDiffSelected = () => {
    if (selected.length !== 2) return;
    const [older, newer] = [...selected].sort((a, b) => a.versionNumber - b.versionNumber);
    setDiff({
      oldTitle: `v${older.versionNumber}（${changeTypeMeta[older.changeType]?.label ?? older.changeType}）`,
      newTitle: `v${newer.versionNumber}（${changeTypeMeta[newer.changeType]?.label ?? newer.changeType}）`,
      oldText: older.content ?? '',
      newText: newer.content ?? '',
    });
  };

  /** 预设对比：当前编辑态 vs 生效版本 */
  const handleDiffCurrentVsPublished = () => {
    if (!detail || !detail.publishedVersion) return;
    setDiff({
      oldTitle: `生效版本 v${detail.publishedVersion.versionNumber}`,
      newTitle: '当前编辑态',
      oldText: detail.publishedVersion.content ?? '',
      newText: detail.configuration.content ?? '',
    });
  };

  /** 回滚确认：以历史版本内容生成新版本（版本号不回退） */
  const handleRollback = async () => {
    if (!rollbackTarget) return;
    const values = await rollbackForm.validateFields();
    setRollingBack(true);
    try {
      const result = await rollbackConfiguration(configurationId, {
        versionNumber: rollbackTarget.versionNumber,
        changeRemark: values.changeRemark || null,
      });
      message.success(`回滚成功，已生成新版本 v${result.versionNumber}`);
      setRollbackTarget(null);
      rollbackForm.resetFields();
      setSelected([]);
      reload();
      loadDetail();
    } catch {
      // 错误提示已由 http.ts 拦截器统一弹出
    } finally {
      setRollingBack(false);
    }
  };

  const columns: ColumnsType<ConfigurationVersionResponse> = [
    {
      title: '版本号',
      dataIndex: 'versionNumber',
      key: 'versionNumber',
      width: 150,
      render: (n: number, record) => (
        <Space size={6}>
          <Typography.Text strong>v{n}</Typography.Text>
          {/* 标记当前生效版本（结果前置到版本号旁） */}
          {detail?.configuration.publishedVersionId === record.id && (
            <Tag color="success" bordered={false}>
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#52c41a',
                  marginRight: 6,
                  verticalAlign: 'middle',
                }}
              />
              生效中
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '变更类型',
      dataIndex: 'changeType',
      key: 'changeType',
      width: 100,
      render: (type: ChangeType) => {
        const meta = changeTypeMeta[type];
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{type}</Tag>;
      },
    },
    {
      title: '变更备注',
      dataIndex: 'changeRemark',
      key: 'changeRemark',
      ellipsis: true,
      render: (remark: string | null) => remark || <Typography.Text type="secondary">-</Typography.Text>,
    },
    { title: '操作人', dataIndex: 'createdBy', key: 'createdBy', width: 120, render: (v: string | null) => v ?? '-' },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (value: string) => formatTime(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          danger
          onClick={() => {
            rollbackForm.resetFields();
            setRollbackTarget(record);
          }}
        >
          回滚到此版本
        </Button>
      ),
    },
  ];

  // 列配置：显隐/宽度按页面持久化，操作列强制显示；components 提供表头拖拽调宽
  const { mergedColumns, components, columnMetas, setVisible, setWidth, reset } = useColumnSettings(
    'version-history',
    columns,
  );

  // 非法 ID 跳回列表：必须位于所有 hooks 之后，避免 hooks 数量在两次渲染间不一致
  if (invalidId) {
    return <Navigate to="/configuration" replace />;
  }

  return (
    <PageContainer
      title={`版本历史${detail ? `：${detail.configuration.configurationKey}` : ''}`}
      extra={
        <Space wrap>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/configuration')}>
            返回列表
          </Button>
          {/* 未勾选够两个版本时禁用，Tooltip 说明原因（包 span 以保证 disabled 按钮上仍能触发提示） */}
          <Tooltip title="勾选两个版本进行对比">
            <span>
              <Button disabled={selected.length !== 2} onClick={handleDiffSelected}>
                对比所选两个版本
              </Button>
            </span>
          </Tooltip>
          <Button disabled={!detail?.publishedVersion} onClick={handleDiffCurrentVsPublished}>
            当前编辑态 vs 生效版本
          </Button>
          <Button type="primary" onClick={() => navigate(`/configuration/${configurationId}/edit`)}>
            去编辑
          </Button>
        </Space>
      }
    >
      {/* 提示条与列配置按钮同排：说明在左，工具区在右 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Alert
          type="info"
          showIcon
          style={{ flex: 1, minWidth: 0 }}
          message="勾选两个版本后可进行 Diff 对比；回滚会以历史版本内容生成新版本，版本号不回退"
        />
        <ColumnSettingButton columnMetas={columnMetas} setVisible={setVisible} setWidth={setWidth} reset={reset} />
      </div>

      <Table<ConfigurationVersionResponse>
        rowKey="id"
        columns={mergedColumns}
        components={components}
        dataSource={data?.items ?? []}
        loading={loading}
        size="middle"
        // 窄窗口下横向滚动，避免内容越过容器
        scroll={{ x: 'max-content' }}
        rowSelection={{
          selectedRowKeys: selected.map((v) => v.id),
          hideSelectAll: true,
          // 手动维护选中行对象，跨页翻动后仍能取到版本内容做 Diff
          onSelect: (record, isSelected) => {
            setSelected((prev) =>
              isSelected ? [...prev, record] : prev.filter((v) => v.id !== record.id),
            );
          },
          // 已选满 2 个时禁用其余行的勾选
          getCheckboxProps: (record) => ({
            disabled: selected.length >= 2 && !selected.some((v) => v.id === record.id),
          }),
        }}
        pagination={{
          current: pageIndex,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 个版本`,
          onChange: (page, size) => {
            setPageIndex(page);
            setPageSize(size);
          },
        }}
      />

      {/* Diff 弹窗：双栏对比 */}
      <Modal
        title={`版本对比：${diff?.oldTitle ?? ''} → ${diff?.newTitle ?? ''}`}
        open={diff !== null}
        onCancel={() => setDiff(null)}
        footer={null}
        width="90%"
        destroyOnClose
      >
        {diff && (
          <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
            <DiffViewer
              oldText={diff.oldText}
              newText={diff.newText}
              oldTitle={diff.oldTitle}
              newTitle={diff.newTitle}
            />
          </div>
        )}
      </Modal>

      {/* 回滚弹窗：二次确认 + 变更备注 */}
      <Modal
        title={`回滚到版本 v${rollbackTarget?.versionNumber ?? ''}`}
        open={rollbackTarget !== null}
        onOk={handleRollback}
        onCancel={() => setRollbackTarget(null)}
        confirmLoading={rollingBack}
        okText="确认回滚"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`将以版本 v${rollbackTarget?.versionNumber ?? ''} 的内容重新发布，生成一个新版本（版本号线性递增，不回退），并覆盖当前编辑内容`}
        />
        <Form form={rollbackForm} layout="vertical">
          <Form.Item name="changeRemark" label="变更备注">
            <Input.TextArea rows={3} placeholder="本次回滚的说明（可选）" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
