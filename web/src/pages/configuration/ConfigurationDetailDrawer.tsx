import { useMemo } from 'react';
import { Button, Descriptions, Drawer, Typography, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import type { ConfigurationResponse } from '@/api/types';
import StatusTag from '@/components/StatusTag';
import FormatTag from '@/components/FormatTag';
import CopyableText from '@/components/CopyableText';
import DimensionCell from '@/components/DimensionCell';
import { copyToClipboard } from '@/utils/clipboard';
import { getFormatter } from '@/utils/formatters';

interface ConfigurationDetailDrawerProps {
  open: boolean;
  record: ConfigurationResponse | null;
  onClose: () => void;
  onEdit: (id: number) => void;
}

/** 时间字段本地化展示（与列表页 formatTime 保持一致） */
const formatTime = (value: string | null) => (value ? new Date(value).toLocaleString() : '-');

/** 配置值展示上限：超长内容截断，完整内容引导进编辑器查看 */
const MAX_CONTENT_LENGTH = 5000;

/** 维度展示：共享 DimensionCell（首行名称 Tag、次行 code 框展示业务 key，点击复制；key 缺失时兜底显 #id），与列表页保持一致 */
const renderDimension = (name: string | null | undefined, key: string | null | undefined, id: number, color: string) => (
  <DimensionCell name={name} dimensionKey={key} id={id} color={color} />
);

/**
 * 配置详情抽屉：只读展示配置项元信息 + 格式化后的配置值。
 * 无表单无脏检测，故用普通 Drawer 而非 FormDrawer；编辑入口通过 onEdit 交回列表页跳转。
 */
export default function ConfigurationDetailDrawer({
  open,
  record,
  onClose,
  onEdit,
}: ConfigurationDetailDrawerProps) {
  // 格式化内容随 record 变化重算（注册表 format 失败自动回退原文）；抽屉 destroyOnClose，关闭后无残留
  const formattedContent = useMemo(
    () => (record?.content ? getFormatter(record.format).format(record.content) : ''),
    [record],
  );
  const truncated = formattedContent.length > MAX_CONTENT_LENGTH;

  /** 复制全部：复制格式化后的完整内容（不受展示截断影响） */
  const handleCopyAll = async () => {
    if (!formattedContent) {
      message.warning('配置值为空');
      return;
    }
    const ok = await copyToClipboard(formattedContent);
    if (ok) {
      message.success('已复制');
    } else {
      message.error('复制失败，请手动复制');
    }
  };

  return (
    <Drawer
      title="配置详情"
      width={560}
      open={open}
      onClose={onClose}
      destroyOnClose
      extra={
        record && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => onEdit(record.id)}>
            编辑配置
          </Button>
        )
      }
    >
      {record && (
        <>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="配置 ID">{record.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <StatusTag status={record.status} />
            </Descriptions.Item>
            <Descriptions.Item label="命名空间">
              {renderDimension(record.namespaceName, record.namespaceKey, record.namespaceId, 'geekblue')}
            </Descriptions.Item>
            <Descriptions.Item label="环境">
              {renderDimension(record.environmentName, record.environmentKey, record.environmentId, 'cyan')}
            </Descriptions.Item>
            <Descriptions.Item label="所属配置组">
              {renderDimension(record.groupName, record.groupKey, record.groupId, 'blue')}
            </Descriptions.Item>
            <Descriptions.Item label="配置项 Key">
              <CopyableText value={record.configurationKey} code maxWidth={120} />
            </Descriptions.Item>
            <Descriptions.Item label="格式">
              <FormatTag format={record.format} />
            </Descriptions.Item>
            <Descriptions.Item label="最新版本">
              {record.latestVersionNumber > 0 ? `v${record.latestVersionNumber}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="最后修改人">{record.updatedBy || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTime(record.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTime(record.updatedAt)}</Descriptions.Item>
            <Descriptions.Item label="配置说明" span={2}>
              {record.description || '-'}
            </Descriptions.Item>
          </Descriptions>

          {/* 配置值区块：格式化全文复制 + 截断只读预览 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 24,
              marginBottom: 8,
            }}
          >
            <Typography.Text strong>配置值</Typography.Text>
            <Button type="link" size="small" onClick={handleCopyAll}>
              复制全部
            </Button>
          </div>
          {formattedContent ? (
            <>
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 6,
                  maxHeight: 400,
                  overflow: 'auto',
                  fontSize: 12,
                  fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                  margin: 0,
                }}
              >
                {truncated ? formattedContent.slice(0, MAX_CONTENT_LENGTH) : formattedContent}
              </pre>
              {truncated && (
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                  内容过长，完整内容请进编辑器查看
                </Typography.Text>
              )}
            </>
          ) : (
            <Typography.Text type="secondary">-</Typography.Text>
          )}
        </>
      )}
    </Drawer>
  );
}
