import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Info } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getConfiguration, listVersions, rollbackConfiguration } from '@/api/configuration';
import type { ChangeType, ConfigurationDetailResponse, ConfigurationVersionResponse, PageResponse } from '@/api/types';
import DiffViewer from '@/components/DiffViewer';
import PageContainer from '@/components/PageContainer';
import ColumnSettingButton from '@/components/ColumnSettingButton';
import type { DataTableColumn } from '@/components/DataTable';
import { DataTable } from '@/components/DataTable';
import { useTableRequest } from '@/hooks/useTableRequest';
import { useColumnSettings } from '@/hooks/useColumnSettings';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** 时间字段本地化展示 */
const formatTime = (value: string | null) => (value ? new Date(value).toLocaleString() : '-');

/** 变更类型 → 配色/文案映射 */
const changeTypeMeta: Record<ChangeType, { badge: string; label: string }> = {
  CREATE: { badge: 'border-transparent bg-sky-50 text-sky-700', label: '创建' },
  UPDATE: { badge: 'border-transparent bg-cyan-50 text-cyan-700', label: '更新' },
  ROLLBACK: { badge: 'border-transparent bg-amber-50 text-amber-700', label: '回滚' },
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

  // 回滚弹窗：目标版本 + 变更备注
  const [rollbackTarget, setRollbackTarget] = useState<ConfigurationVersionResponse | null>(null);
  const [rollbackRemark, setRollbackRemark] = useState('');
  const [rollingBack, setRollingBack] = useState(false);

  // 非法 ID 仅提示一次，跳转由渲染末尾的 Navigate 完成
  useEffect(() => {
    if (invalidId) {
      toast.error('配置 ID 非法');
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
    setRollingBack(true);
    try {
      const result = await rollbackConfiguration(configurationId, {
        versionNumber: rollbackTarget.versionNumber,
        changeRemark: rollbackRemark || null,
      });
      toast.success(`回滚成功，已生成新版本 v${result.versionNumber}`);
      setRollbackTarget(null);
      setRollbackRemark('');
      setSelected([]);
      reload();
      loadDetail();
    } catch {
      // 错误提示已由 http.ts 拦截器统一弹出
    } finally {
      setRollingBack(false);
    }
  };

  const columns: DataTableColumn<ConfigurationVersionResponse>[] = [
    {
      key: 'versionNumber',
      title: '版本号',
      width: 150,
      render: (record) => (
        <div className="flex items-center gap-1.5">
          <span className="font-semibold">v{record.versionNumber}</span>
          {/* 标记当前生效版本（结果前置到版本号旁） */}
          {detail?.configuration.publishedVersionId === record.id && (
            <Badge variant="outline" className="border-transparent bg-emerald-50 text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              生效中
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'changeType',
      title: '变更类型',
      width: 100,
      render: (record) => {
        const meta = changeTypeMeta[record.changeType];
        return meta ? (
          <Badge variant="outline" className={meta.badge}>
            {meta.label}
          </Badge>
        ) : (
          <Badge variant="outline">{record.changeType}</Badge>
        );
      },
    },
    {
      key: 'changeRemark',
      title: '变更备注',
      render: (record) =>
        record.changeRemark || <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'createdBy',
      title: '操作人',
      width: 120,
      render: (record) => record.createdBy ?? '-',
    },
    {
      key: 'createdAt',
      title: '创建时间',
      width: 180,
      render: (record) => formatTime(record.createdAt),
    },
    {
      key: 'action',
      title: '操作',
      width: 120,
      render: (record) => (
        <Button
          variant="link"
          size="sm"
          className="h-7 px-1.5 text-destructive hover:text-destructive"
          onClick={() => {
            setRollbackRemark('');
            setRollbackTarget(record);
          }}
        >
          回滚到此版本
        </Button>
      ),
    },
  ];

  // 列配置：显隐/宽度按页面持久化，操作列强制显示；表头拖拽调宽由 useColumnSettings 注入
  const { mergedColumns, columnMetas, setVisible, setWidth, reset } = useColumnSettings('version-history', columns);

  // 非法 ID 跳回列表：必须位于所有 hooks 之后，避免 hooks 数量在两次渲染间不一致
  if (invalidId) {
    return <Navigate to="/configuration" replace />;
  }

  return (
    <PageContainer
      title={`版本历史${detail ? `：${detail.configuration.configurationKey}` : ''}`}
      extra={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/configuration')}>
            <ArrowLeft />
            返回列表
          </Button>
          {/* 未勾选够两个版本时禁用，Tooltip 说明原因 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" disabled={selected.length !== 2} onClick={handleDiffSelected}>
                  对比所选两个版本
                </Button>
              </span>
            </TooltipTrigger>
            {selected.length !== 2 && <TooltipContent>勾选两个版本进行对比</TooltipContent>}
          </Tooltip>
          <Button variant="outline" disabled={!detail?.publishedVersion} onClick={handleDiffCurrentVsPublished}>
            当前编辑态 vs 生效版本
          </Button>
          <Button onClick={() => navigate(`/configuration/${configurationId}/edit`)}>去编辑</Button>
        </div>
      }
    >
      {/* 提示条与列配置按钮同排：说明在左，工具区在右 */}
      <div className="mb-4 flex items-center gap-3">
        <Alert variant="info" className="min-w-0 flex-1">
          <Info />
          <span>勾选两个版本后可进行 Diff 对比；回滚会以历史版本内容生成新版本，版本号不回退</span>
        </Alert>
        <ColumnSettingButton columnMetas={columnMetas} setVisible={setVisible} setWidth={setWidth} reset={reset} />
      </div>

      <DataTable
        rowKey={(record) => record.id}
        columns={mergedColumns}
        data={data?.items ?? []}
        loading={loading}
        pagination={{
          pageIndex,
          pageSize,
          total: data?.total ?? 0,
          onChange: (page, size) => {
            setPageIndex(page);
            setPageSize(size);
          },
        }}
        rowSelection={{
          selectedKeys: selected.map((v) => v.id),
          maxSelected: 2,
          // 手动维护选中行对象，跨页翻动后仍能取到版本内容做 Diff
          onSelect: (record, isSelected) => {
            setSelected((prev) =>
              isSelected ? [...prev, record] : prev.filter((v) => v.id !== record.id),
            );
          },
        }}
      />

      {/* Diff 弹窗：双栏对比 */}
      <Dialog open={diff !== null} onOpenChange={(open) => !open && setDiff(null)}>
        <DialogContent className="max-w-[90vw] sm:max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>版本对比：{diff?.oldTitle ?? ''} → {diff?.newTitle ?? ''}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto">
            {diff && (
              <DiffViewer
                oldText={diff.oldText}
                newText={diff.newText}
                oldTitle={diff.oldTitle}
                newTitle={diff.newTitle}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 回滚弹窗：二次确认 + 变更备注 */}
      <Dialog open={rollbackTarget !== null} onOpenChange={(open) => !open && setRollbackTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>回滚到版本 v{rollbackTarget?.versionNumber ?? ''}</DialogTitle>
            <DialogDescription>
              将以版本 v{rollbackTarget?.versionNumber ?? ''} 的内容重新发布，生成一个新版本（版本号线性递增，不回退），并覆盖当前编辑内容
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Textarea
              rows={3}
              maxLength={200}
              placeholder="本次回滚的说明（可选）"
              value={rollbackRemark}
              onChange={(e) => setRollbackRemark(e.target.value)}
            />
            <span className="self-end text-xs text-muted-foreground">{rollbackRemark.length}/200</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRollbackTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleRollback} disabled={rollingBack}>
              {rollingBack ? '回滚中…' : '确认回滚'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
