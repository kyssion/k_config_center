import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Edit, Eye, MoreHorizontal, Plus, Search, Settings2 } from 'lucide-react';
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
import FormField from '@/components/FormField';
import FilterSelect from '@/components/FilterSelect';
import ContentPreview from '@/components/ContentPreview';
import CopyableText from '@/components/CopyableText';
import FormDrawer from '@/components/FormDrawer';
import ColumnSettingButton from '@/components/ColumnSettingButton';
import DimensionCell from '@/components/DimensionCell';
import ConfigurationDetailDrawer from '@/pages/configuration/ConfigurationDetailDrawer';
import type { DataTableColumn } from '@/components/DataTable';
import { DataTable } from '@/components/DataTable';
import { useTableRequest } from '@/hooks/useTableRequest';
import { useColumnSettings } from '@/hooks/useColumnSettings';
import { getFormatter } from '@/utils/formatters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** 时间字段本地化展示（ISO 8601 → 本地时间字符串） */
const formatTime = (value: string | null) => (value ? new Date(value).toLocaleString() : '-');

/** 状态筛选选项（与 StatusTag 文案对齐） */
const statusOptions: { value: ConfigStatus; label: string }[] = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PUBLISHED', label: '已发布' },
  { value: 'OFFLINE', label: '已下线' },
];

/** 新建配置表单值 */
interface CreateFormValues {
  groupId?: number;
  configurationKey: string;
  format: ConfigFormat;
  content: string;
  description: string;
}

const emptyCreateForm: CreateFormValues = { configurationKey: '', format: 'text', content: '', description: '' };

/**
 * 配置项列表页：命名空间/环境/配置组三级级联 + 状态 + Key 关键字组合筛选（全可选，点「查询」手动生效）；
 * 行操作：编辑 / 发布 / 下线 / 删除 / 版本历史；支持新建配置。
 */
export default function ConfigurationList() {
  const navigate = useNavigate();

  // 筛选草稿：命名空间 → 环境 → 配置组三级级联 + 状态 + 关键字，均可为空；点「查询」后才生效
  const [namespaceId, setNamespaceId] = useState<number | undefined>(undefined);
  const [environmentId, setEnvironmentId] = useState<number | undefined>(undefined);
  const [groupId, setGroupId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<ConfigStatus | undefined>(undefined);
  const [keywordInput, setKeywordInput] = useState('');
  // 已生效的查询条件：点「查询」时由草稿快照生成（每次都是新对象，条件未变时也会触发刷新）
  const [applied, setApplied] = useState<{
    namespaceId?: number;
    environmentId?: number;
    groupId?: number;
    status?: ConfigStatus;
    keyword?: string;
  }>({});

  // 级联下拉数据源
  const [namespaces, setNamespaces] = useState<NamespaceResponse[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentResponse[]>([]);
  const [groups, setGroups] = useState<ConfigurationGroupResponse[]>([]);

  // 发布弹窗：当前待发布的配置项 + 变更备注草稿
  const [publishTarget, setPublishTarget] = useState<ConfigurationResponse | null>(null);
  const [publishRemark, setPublishRemark] = useState('');
  const [publishing, setPublishing] = useState(false);

  // 新建配置抽屉
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormValues>(emptyCreateForm);
  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof CreateFormValues, string>>>({});
  const [createDirty, setCreateDirty] = useState(false);
  const [creating, setCreating] = useState(false);

  // 配置详情抽屉：非空即打开
  const [detailRecord, setDetailRecord] = useState<ConfigurationResponse | null>(null);

  // 下线/删除确认目标
  const [offlineTarget, setOfflineTarget] = useState<ConfigurationResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConfigurationResponse | null>(null);

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

  // 点「查询」时已生效条件变化即重载（useTableRequest 依赖 fetcher 引用，已防竞态）
  const fetcher = useCallback(
    () =>
      listConfigurations({
        namespaceId: applied.namespaceId,
        environmentId: applied.environmentId,
        groupId: applied.groupId,
        status: applied.status,
        keyword: applied.keyword || undefined,
      }),
    [applied],
  );
  const { data, loading, reload } = useTableRequest(fetcher);

  // 点「查询」/回车：草稿条件快照生效，触发列表重新加载
  const handleSearch = () => {
    setApplied({ namespaceId, environmentId, groupId, status, keyword: keywordInput.trim() });
  };

  // 点「重置」：清空草稿与已生效条件，恢复全量
  const handleResetFilter = () => {
    setNamespaceId(undefined);
    setEnvironmentId(undefined);
    setGroupId(undefined);
    setStatus(undefined);
    setKeywordInput('');
    setApplied({});
  };

  /** 发布确认：填变更备注后调用发布接口 */
  const handlePublish = async () => {
    if (!publishTarget) return;
    setPublishing(true);
    try {
      const result = await publishConfiguration(publishTarget.id, {
        changeRemark: publishRemark || null,
      });
      toast.success(`发布成功，版本号 v${result.versionNumber}`);
      setPublishTarget(null);
      setPublishRemark('');
      reload();
    } catch {
      // 错误提示已由 http.ts 拦截器统一弹出
    } finally {
      setPublishing(false);
    }
  };

  /** 下线：仅 PUBLISHED 状态可下线 */
  const handleOffline = async () => {
    if (!offlineTarget) return;
    try {
      await offlineConfiguration(offlineTarget.id);
      toast.success('下线成功');
      reload();
    } catch {
      // 错误提示已由拦截器统一处理
    } finally {
      setOfflineTarget(null);
    }
  };

  /** 删除（后端软删除） */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteConfiguration(deleteTarget.id);
      toast.success('删除成功');
      reload();
    } catch {
      // 错误提示已由拦截器统一处理
    } finally {
      setDeleteTarget(null);
    }
  };

  /** 新建表单字段更新：置脏并清对应错误 */
  const setCreateField = <K extends keyof CreateFormValues>(key: K, value: CreateFormValues[K]) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
    setCreateDirty(true);
    setCreateErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  /** 新建配置确认 */
  const handleCreate = async () => {
    const next: Partial<Record<keyof CreateFormValues, string>> = {};
    if (createForm.groupId === undefined) next.groupId = '请选择配置组';
    if (!createForm.configurationKey.trim()) next.configurationKey = '请输入配置项 Key';
    setCreateErrors(next);
    if (Object.keys(next).length) return;
    setCreating(true);
    try {
      await createConfiguration({
        groupId: createForm.groupId!,
        configurationKey: createForm.configurationKey,
        format: createForm.format,
        content: createForm.content || null,
        description: createForm.description || null,
      });
      toast.success('新建配置成功');
      setCreateOpen(false);
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
    if (!createForm.content.trim()) {
      toast.warning('配置值为空');
      return;
    }
    const formatter = getFormatter(createForm.format);
    const error = formatter.validate(createForm.content);
    if (error) {
      toast.error(`${createForm.format} 校验失败：${error}`);
      return;
    }
    setCreateForm((prev) => ({ ...prev, content: formatter.format(prev.content) }));
    toast.success(`${createForm.format} 校验通过，已格式化`);
  };

  const columns: DataTableColumn<ConfigurationResponse>[] = [
    {
      key: 'id',
      title: 'ID',
      width: 80,
      render: (record) => <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{record.id}</span>,
    },
    {
      key: 'namespaceName',
      title: '命名空间',
      width: 150,
      render: (record) => (
        <DimensionCell name={record.namespaceName} dimensionKey={record.namespaceKey} id={record.namespaceId} tone="blue" />
      ),
    },
    {
      key: 'environmentName',
      title: '环境',
      width: 130,
      render: (record) => (
        <DimensionCell name={record.environmentName} dimensionKey={record.environmentKey} id={record.environmentId} tone="cyan" />
      ),
    },
    {
      key: 'groupName',
      title: '所属配置组',
      width: 150,
      render: (record) => (
        <DimensionCell name={record.groupName} dimensionKey={record.groupKey} id={record.groupId} tone="sky" />
      ),
    },
    {
      key: 'configurationKey',
      title: '配置项 Key',
      width: 220,
      render: (record) => <CopyableText value={record.configurationKey} code maxWidth={200} />,
    },
    {
      key: 'content',
      title: '内容',
      width: 240,
      render: (record) => <ContentPreview content={record.content} format={record.format} />,
    },
    {
      key: 'format',
      title: '格式',
      width: 90,
      render: (record) => <FormatTag format={record.format} />,
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (record) => <StatusTag status={record.status} />,
    },
    {
      key: 'latestVersionNumber',
      title: '最新版本',
      width: 90,
      render: (record) => (record.latestVersionNumber > 0 ? `v${record.latestVersionNumber}` : '-'),
    },
    {
      key: 'hasUnpublishedChange',
      title: '未发布变更',
      width: 120,
      // hasUnpublishedChange 由服务端计算，前端只做展示
      render: (record) =>
        record.hasUnpublishedChange ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="border-transparent bg-amber-50 text-amber-700">有未发布变更</Badge>
            </TooltipTrigger>
            <TooltipContent>此配置有草稿未发布，发布后对客户端生效</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">无</span>
        ),
    },
    {
      key: 'updatedAt',
      title: '最后更新',
      width: 170,
      // 时间 + 次行修改人（灰色小字），修改人为空时省略次行
      render: (record) => (
        <div>
          <div>{formatTime(record.updatedAt)}</div>
          {record.updatedBy && <div className="text-xs text-muted-foreground">{record.updatedBy}</div>}
        </div>
      ),
    },
    {
      key: 'action',
      title: '操作',
      width: 300,
      render: (record) => (
        <div className="flex items-center">
          <Button variant="link" size="sm" className="h-7 px-1.5" onClick={() => setDetailRecord(record)}>
            <Eye />
            详情
          </Button>
          <Button
            variant="link"
            size="sm"
            className="h-7 px-1.5"
            onClick={() => navigate(`/configuration/${record.id}/edit`)}
          >
            <Edit />
            编辑
          </Button>
          <Button
            variant="link"
            size="sm"
            className="h-7 px-1.5"
            onClick={() => {
              setPublishRemark('');
              setPublishTarget(record);
            }}
          >
            发布
          </Button>
          <Button
            variant="link"
            size="sm"
            className="h-7 px-1.5"
            onClick={() => navigate(`/configuration/${record.id}/versions`)}
          >
            版本历史
          </Button>
          {/* 低频/危险操作收纳进下拉菜单，点击后二次确认 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="link" size="sm" className="h-7 w-7 px-1" aria-label="更多操作">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                variant="destructive"
                disabled={record.status !== 'PUBLISHED'}
                onClick={() => setOfflineTarget(record)}
              >
                下线
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(record)}>
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  // 列配置：显隐/宽度按页面 key 持久化，操作列（key='action'）强制显示；表头拖拽调宽由 useColumnSettings 注入
  const { mergedColumns, columnMetas, setVisible, setWidth, reset } = useColumnSettings('configuration-list', columns);

  return (
    <PageContainer
      title="配置管理"
      icon={<Settings2 className="size-5" />}
      description="集中维护服务运行参数，支持多格式内容、版本管理与发布流程"
      extra={
        <Button
          onClick={() => {
            // 默认选中当前过滤的配置组（未过滤时留空，表单内组必选）
            setCreateForm({ ...emptyCreateForm, groupId });
            setCreateErrors({});
            setCreateDirty(false);
            setCreateOpen(true);
          }}
        >
          <Plus />
          新建配置
        </Button>
      }
    >
      {/* 筛选区：命名空间 → 环境 → 配置组三级级联 + 状态 + Key 关键字，点「查询」生效；右侧列配置入口 */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            placeholder="全部命名空间"
            className="w-44"
            value={namespaceId}
            options={namespaces.map((n) => ({ value: n.id, label: n.namespaceName }))}
            onOpenChange={(open) => {
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
          <FilterSelect
            placeholder="全部环境"
            className="w-40"
            value={environmentId}
            options={environments.map((e) => ({ value: e.id, label: e.environmentName }))}
            onOpenChange={(open) => {
              // 展开时按当前命名空间重新拉取
              if (open) refreshEnvironments();
            }}
            onChange={(id) => {
              // 环境变化时清空下级配置组选中值
              setEnvironmentId(id);
              setGroupId(undefined);
            }}
          />
          <FilterSelect
            placeholder="全部配置组"
            className="w-48"
            value={groupId}
            options={groups.map((g) => ({ value: g.id, label: g.groupName }))}
            onOpenChange={(open) => {
              // 展开时按当前命名空间/环境重新拉取
              if (open) refreshGroups();
            }}
            onChange={setGroupId}
          />
          <FilterSelect
            placeholder="全部状态"
            className="w-32"
            value={status}
            options={statusOptions}
            onChange={setStatus}
          />
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-60 pl-8"
              placeholder="按配置 Key 搜索"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch}>查询</Button>
          <Button variant="outline" onClick={handleResetFilter}>
            重置
          </Button>
        </div>
        <ColumnSettingButton columnMetas={columnMetas} setVisible={setVisible} setWidth={setWidth} reset={reset} />
      </div>

      <DataTable
        rowKey={(record) => record.id}
        columns={mergedColumns}
        data={data ?? []}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* 发布弹窗：填写变更备注后发布 */}
      <Dialog open={publishTarget !== null} onOpenChange={(open) => !open && setPublishTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>发布配置：{publishTarget?.configurationKey ?? ''}</DialogTitle>
            <DialogDescription>发布后立即对客户端生效</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Textarea
              rows={3}
              maxLength={200}
              placeholder="本次发布的变更说明（可选）"
              value={publishRemark}
              onChange={(e) => setPublishRemark(e.target.value)}
            />
            <span className="self-end text-xs text-muted-foreground">{publishRemark.length}/200</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishTarget(null)}>
              取消
            </Button>
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? '发布中…' : '发布'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建配置抽屉：脏表单关闭二次确认由 FormDrawer 内置 */}
      <FormDrawer
        title="新建配置"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        loading={creating}
        dirty={createDirty}
        okText="创建"
        width={640}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
          <FormField label="配置组" required error={createErrors.groupId}>
            <Select
              value={createForm.groupId !== undefined ? String(createForm.groupId) : undefined}
              onValueChange={(v) => setCreateField('groupId', Number(v))}
              onOpenChange={(open) => {
                // 展开时按当前命名空间/环境重新拉取，与筛选区下拉同源
                if (open) refreshGroups();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择配置组" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.groupName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="配置项 Key" required error={createErrors.configurationKey}>
            {/* maxLength 对齐建表脚本 configuration_key VARCHAR(256) */}
            <Input
              placeholder="如 application.yaml / redis.timeout"
              maxLength={256}
              value={createForm.configurationKey}
              onChange={(e) => setCreateField('configurationKey', e.target.value)}
            />
            <span className="self-end text-xs text-muted-foreground">{createForm.configurationKey.length}/256</span>
          </FormField>
          <FormField label="格式" required>
            <FormatSelect value={createForm.format} onChange={(value) => setCreateField('format', value)} />
          </FormField>
          <FormField
            label="配置值"
            extra={
              getFormatter(createForm.format).canFormat && (
                <Button type="button" variant="link" size="sm" className="h-5 px-0" onClick={handleFormatContent}>
                  校验并格式化
                </Button>
              )
            }
          >
            <Textarea
              rows={6}
              placeholder="配置内容（可选，也可创建后在编辑器中填写）"
              value={createForm.content}
              onChange={(e) => setCreateField('content', e.target.value)}
            />
          </FormField>
          <FormField label="配置说明">
            {/* maxLength 对齐建表脚本 description VARCHAR(512) */}
            <Textarea
              rows={2}
              maxLength={512}
              placeholder="配置用途说明（可选）"
              value={createForm.description}
              onChange={(e) => setCreateField('description', e.target.value)}
            />
            <span className="self-end text-xs text-muted-foreground">{createForm.description.length}/512</span>
          </FormField>
        </form>
      </FormDrawer>

      {/* 下线二次确认 */}
      <AlertDialog open={offlineTarget !== null} onOpenChange={(open) => !open && setOfflineTarget(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认下线该配置？</AlertDialogTitle>
            <AlertDialogDescription>下线后客户端将无法再拉取该配置</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleOffline}>下线</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除二次确认 */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该配置？</AlertDialogTitle>
            <AlertDialogDescription>删除为软删除，版本快照与日志保留</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
