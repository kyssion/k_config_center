import { Fragment, useMemo } from 'react';
import { toast } from 'sonner';
import { Edit } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ConfigurationResponse } from '@/api/types';
import StatusTag from '@/components/StatusTag';
import FormatTag from '@/components/FormatTag';
import CopyableText from '@/components/CopyableText';
import DimensionCell from '@/components/DimensionCell';
import { copyToClipboard } from '@/utils/clipboard';
import { getFormatter } from '@/utils/formatters';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

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

/** 键值对（Descriptions 的等价排版）：带边框网格，label 浅灰底 */
function DescriptionGrid({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="grid grid-cols-[116px_1fr] overflow-hidden rounded-xl border text-sm">
      {items.map((item) => (
        <Fragment key={item.label}>
          <div className="border-r border-b bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">{item.label}</div>
          <div className="border-b px-3 py-2.5">{item.value}</div>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * 配置详情抽屉：只读展示配置项元信息 + 格式化后的配置值。
 * 无表单无脏检测，故用普通 Sheet 而非 FormDrawer；编辑入口通过 onEdit 交回列表页跳转。
 */
export default function ConfigurationDetailDrawer({ open, record, onClose, onEdit }: ConfigurationDetailDrawerProps) {
  // 格式化内容随 record 变化重算（注册表 format 失败自动回退原文）；抽屉关闭后无残留
  const formattedContent = useMemo(
    () => (record?.content ? getFormatter(record.format).format(record.content) : ''),
    [record],
  );
  const truncated = formattedContent.length > MAX_CONTENT_LENGTH;

  /** 复制全部：复制格式化后的完整内容（不受展示截断影响） */
  const handleCopyAll = async () => {
    if (!formattedContent) {
      toast.warning('配置值为空');
      return;
    }
    const ok = await copyToClipboard(formattedContent);
    if (ok) {
      toast.success('已复制');
    } else {
      toast.error('复制失败，请手动复制');
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>配置详情</SheetTitle>
        </SheetHeader>
        {record && (
          <div className="flex-1 overflow-y-auto">
            <DescriptionGrid
              items={[
                { label: '配置 ID', value: record.id },
                { label: '状态', value: <StatusTag status={record.status} /> },
                {
                  label: '命名空间',
                  value: <DimensionCell name={record.namespaceName} dimensionKey={record.namespaceKey} id={record.namespaceId} tone="blue" />,
                },
                {
                  label: '环境',
                  value: <DimensionCell name={record.environmentName} dimensionKey={record.environmentKey} id={record.environmentId} tone="cyan" />,
                },
                {
                  label: '所属配置组',
                  value: <DimensionCell name={record.groupName} dimensionKey={record.groupKey} id={record.groupId} tone="sky" />,
                },
                { label: '配置项 Key', value: <CopyableText value={record.configurationKey} code maxWidth={140} /> },
                { label: '格式', value: <FormatTag format={record.format} /> },
                { label: '最新版本', value: record.latestVersionNumber > 0 ? `v${record.latestVersionNumber}` : '-' },
                { label: '最后修改人', value: record.updatedBy || '-' },
                { label: '创建时间', value: formatTime(record.createdAt) },
                { label: '更新时间', value: formatTime(record.updatedAt) },
                { label: '配置说明', value: record.description || '-' },
              ]}
            />

            {/* 配置值区块：格式化全文复制 + 截断只读预览 */}
            <div className="mt-6 mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">配置值</span>
              <Button variant="link" size="sm" className="h-6 px-2" onClick={handleCopyAll}>
                复制全部
              </Button>
            </div>
            {formattedContent ? (
              <>
                <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
                  {truncated ? formattedContent.slice(0, MAX_CONTENT_LENGTH) : formattedContent}
                </pre>
                {truncated && (
                  <p className="mt-2 text-xs text-muted-foreground">内容过长，完整内容请进编辑器查看</p>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}

            <div className="mt-6 text-right">
              <Button onClick={() => onEdit(record.id)}>
                <Edit />
                编辑配置
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
