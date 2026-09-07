import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { FolderOpen, Plus } from 'lucide-react';
import { createGroup, deleteGroup, listGroups, updateGroup } from '@/api/group';
import { listEnvironments } from '@/api/environment';
import { listNamespaces } from '@/api/namespace';
import type { ConfigurationGroupResponse, EnvironmentResponse } from '@/api/types';
import { useTableRequest } from '@/hooks/useTableRequest';
import { useColumnSettings } from '@/hooks/useColumnSettings';
import type { DataTableColumn } from '@/components/DataTable';
import { DataTable } from '@/components/DataTable';
import PageContainer from '@/components/PageContainer';
import FormDrawer from '@/components/FormDrawer';
import FormField from '@/components/FormField';
import FilterSelect from '@/components/FilterSelect';
import CopyableText from '@/components/CopyableText';
import DimensionCell from '@/components/DimensionCell';
import ColumnSettingButton from '@/components/ColumnSettingButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

/** 抽屉表单字段：新建含命名空间/环境/key，编辑时三者只读展示不提交 */
interface GroupFormValues {
  namespaceId?: number;
  environmentId?: number;
  groupKey: string;
  groupName: string;
  description: string;
}

const emptyForm: GroupFormValues = { groupKey: '', groupName: '', description: '' };

/** ISO 时间字符串 → 本地可读格式 */
const formatTime = (iso: string) => new Date(iso).toLocaleString('zh-CN', { hour12: false });

/** 配置组管理页：命名空间/环境级联 + 关键字筛选（点「查询」手动生效）+ 新建/编辑抽屉 */
export default function GroupList() {
  // 命名空间列表：筛选区下拉 / 抽屉表单共用同一份数据（下拉展开时 reload 取最新）
  const { data: namespaces, reload: reloadNamespaces } = useTableRequest(listNamespaces);
  // 筛选草稿：均为 undefined/空时查全部；点「查询」后才生效
  const [filterNamespaceId, setFilterNamespaceId] = useState<number>();
  const [filterEnvironmentId, setFilterEnvironmentId] = useState<number>();
  const [keywordInput, setKeywordInput] = useState('');
  // 已生效的服务端筛选条件：点「查询」时由草稿快照生成（每次都是新对象，条件未变时也会触发刷新）
  const [applied, setApplied] = useState<{ namespaceId?: number; environmentId?: number }>({});
  // 关键字筛选（已生效）：前端本地过滤名称 / Key
  const [keyword, setKeyword] = useState('');

  // 筛选区环境选项：按草稿命名空间拉取（驱动下拉选项，与列表查询无关；下拉展开时 reload 取最新）
  const envFetcher = useCallback(() => listEnvironments(filterNamespaceId), [filterNamespaceId]);
  const { data: environments, reload: reloadEnvironments } = useTableRequest(envFetcher);

  // 已生效条件变化时 fetcher 引用变化，useTableRequest 自动重新加载
  const fetcher = useCallback(
    () => listGroups({ namespaceId: applied.namespaceId, environmentId: applied.environmentId }),
    [applied],
  );
  const { data, loading, reload } = useTableRequest(fetcher);

  const [drawerOpen, setDrawerOpen] = useState(false);
  // 当前编辑的记录，null 表示新建
  const [editing, setEditing] = useState<ConfigurationGroupResponse | null>(null);
  const [form, setForm] = useState<GroupFormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof GroupFormValues, string>>>({});
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 抽屉表单内的环境级联选项：按表单中选择的命名空间加载
  const [formEnvironments, setFormEnvironments] = useState<EnvironmentResponse[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ConfigurationGroupResponse | null>(null);

  const namespaceOptions = (namespaces ?? []).map((n) => ({ label: n.namespaceName, value: n.id }));
  const environmentOptions = (environments ?? []).map((e) => ({
    label: e.environmentName,
    value: e.id,
  }));

  const kw = keyword.trim().toLowerCase();
  const filteredData = (data ?? []).filter(
    (item) => !kw || item.groupName.toLowerCase().includes(kw) || item.groupKey.toLowerCase().includes(kw),
  );

  // 点「查询」/回车：草稿条件生效（命名空间/环境走服务端筛选，关键字为本地过滤）
  const handleSearch = () => {
    setApplied({ namespaceId: filterNamespaceId, environmentId: filterEnvironmentId });
    setKeyword(keywordInput);
  };

  // 点「重置」：清空草稿与已生效条件，恢复全量
  const handleResetFilter = () => {
    setFilterNamespaceId(undefined);
    setFilterEnvironmentId(undefined);
    setKeywordInput('');
    setApplied({});
    setKeyword('');
  };

  const setField = <K extends keyof GroupFormValues>(key: K, value: GroupFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // 表单级联：每次直接按命名空间请求环境列表，保证拿到最新数据
  const loadFormEnvironments = (nsId: number) => {
    listEnvironments(nsId)
      .then(setFormEnvironments)
      .catch(() => undefined); // 接口错误已由拦截器提示
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setDirty(false);
    setFormEnvironments([]);
    setDrawerOpen(true);
  };

  const openEdit = (record: ConfigurationGroupResponse) => {
    setEditing(record);
    loadFormEnvironments(record.namespaceId); // 让只读环境下拉能展示名称
    setForm({
      namespaceId: record.namespaceId,
      environmentId: record.environmentId,
      groupKey: record.groupKey,
      groupName: record.groupName,
      description: record.description ?? '',
    });
    setErrors({});
    setDirty(false);
    setDrawerOpen(true);
  };

  /** 表单校验：新建要求选命名空间与环境；名称/Key 必填 */
  const validate = (): GroupFormValues | null => {
    const next: Partial<Record<keyof GroupFormValues, string>> = {};
    if (!editing && form.namespaceId === undefined) next.namespaceId = '请选择命名空间';
    if (!editing && form.environmentId === undefined) next.environmentId = '请选择环境';
    if (!form.groupName.trim()) next.groupName = '请输入配置组名称';
    if (!editing && !form.groupKey.trim()) next.groupKey = '请输入配置组 Key';
    setErrors(next);
    return Object.keys(next).length ? null : form;
  };

  // 新建/编辑提交：错误提示由 http.ts 拦截器统一弹出，这里只处理成功分支
  const handleSubmit = async () => {
    const values = validate();
    if (!values) return;
    setSubmitting(true);
    try {
      if (editing) {
        await updateGroup(editing.id, {
          groupName: values.groupName,
          description: values.description || null,
          status: editing.status, // 状态由列表行内切换维护，编辑抽屉不改
        });
        toast.success('更新成功');
      } else {
        await createGroup({
          namespaceId: values.namespaceId!,
          environmentId: values.environmentId!,
          groupKey: values.groupKey,
          groupName: values.groupName,
          description: values.description || null,
        });
        toast.success('创建成功');
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
      toast.success(next === 1 ? '已启用' : '已禁用');
      reload();
    } catch {
      // 接口错误已由拦截器提示
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGroup(deleteTarget.id);
      toast.success('删除成功');
      reload();
    } catch {
      // 接口错误已由拦截器提示
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns: DataTableColumn<ConfigurationGroupResponse>[] = [
    {
      key: 'id',
      title: 'ID',
      width: 80,
      render: (record) => <span className="font-mono text-xs text-muted-foreground">{record.id}</span>,
    },
    {
      key: 'namespaceId',
      title: '命名空间',
      width: 160,
      // 后端联查返回 key/名称；共享 DimensionCell（首行名称 Badge、次行 code 框展示 key，点击复制；key 缺失兜底显 #id）
      render: (record) => (
        <DimensionCell name={record.namespaceName} dimensionKey={record.namespaceKey} id={record.namespaceId} tone="blue" />
      ),
    },
    {
      key: 'environmentId',
      title: '环境',
      width: 140,
      render: (record) => (
        <DimensionCell name={record.environmentName} dimensionKey={record.environmentKey} id={record.environmentId} tone="cyan" />
      ),
    },
    { key: 'groupName', title: '名称' },
    {
      key: 'groupKey',
      title: 'Key',
      render: (record) => <CopyableText value={record.groupKey} code />,
    },
    {
      key: 'description',
      title: '描述',
      render: (record) => record.description || '-',
    },
    {
      key: 'status',
      title: '状态',
      width: 90,
      render: (record) =>
        record.status === 1 ? (
          <Badge variant="outline" className="border-transparent bg-emerald-50 text-emerald-700">启用</Badge>
        ) : (
          <Badge variant="secondary">禁用</Badge>
        ),
    },
    { key: 'createdAt', title: '创建时间', width: 170, render: (record) => formatTime(record.createdAt) },
    { key: 'updatedAt', title: '更新时间', width: 170, render: (record) => formatTime(record.updatedAt) },
    {
      key: 'action',
      title: '操作',
      width: 190,
      render: (record) => (
        <div className="flex items-center gap-0.5">
          <Button variant="link" size="sm" className="h-7 px-1.5" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <span className="mx-0.5 h-3 w-px bg-border" />
          <Button
            variant="link"
            size="sm"
            className={`h-7 px-1.5 ${record.status === 1 ? 'text-destructive hover:text-destructive' : ''}`}
            onClick={() => handleToggleStatus(record)}
          >
            {record.status === 1 ? '禁用' : '启用'}
          </Button>
          <span className="mx-0.5 h-3 w-px bg-border" />
          <Button
            variant="link"
            size="sm"
            className="h-7 px-1.5 text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(record)}
          >
            删除
          </Button>
        </div>
      ),
    },
  ];

  // 列配置：显隐/宽度按页面持久化，操作列强制显示；表头拖拽调宽由 useColumnSettings 注入
  const { mergedColumns, columnMetas, setVisible, setWidth, reset } = useColumnSettings('group-list', columns);

  return (
    <PageContainer
      title="配置组管理"
      icon={<FolderOpen className="size-5" />}
      description="按环境组织配置项集合，配置项归属于唯一配置组"
      extra={
        <Button onClick={openCreate}>
          <Plus />
          新建配置组
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            placeholder="全部命名空间"
            className="w-52"
            value={filterNamespaceId}
            options={namespaceOptions}
            onChange={(v) => {
              setFilterNamespaceId(v);
              setFilterEnvironmentId(undefined); // 命名空间变化时清空环境选中值
            }}
            onOpenChange={(open) => open && reloadNamespaces()}
          />
          <FilterSelect
            placeholder="全部环境"
            className="w-44"
            value={filterEnvironmentId}
            options={environmentOptions}
            onChange={setFilterEnvironmentId}
            onOpenChange={(open) => open && reloadEnvironments()}
          />
          <Input
            className="w-60"
            placeholder="搜索名称 / Key"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
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
        data={filteredData}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      <FormDrawer
        title={editing ? '编辑配置组' : '新建配置组'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmit}
        loading={submitting}
        dirty={dirty}
        okText={editing ? '保存' : '创建'}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <FormField label="命名空间" required error={errors.namespaceId}>
            <Select
              value={form.namespaceId !== undefined ? String(form.namespaceId) : undefined}
              onValueChange={(v) => {
                // 级联：切换命名空间后清空已选环境并重载环境选项
                setForm((prev) => ({ ...prev, namespaceId: Number(v), environmentId: undefined }));
                setDirty(true);
                loadFormEnvironments(Number(v));
              }}
              disabled={!!editing}
              onOpenChange={(open) => open && reloadNamespaces()}
            >
              <SelectTrigger>
                <SelectValue placeholder="请选择命名空间" />
              </SelectTrigger>
              <SelectContent>
                {namespaceOptions.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="环境" required error={errors.environmentId}>
            <Select
              value={form.environmentId !== undefined ? String(form.environmentId) : undefined}
              onValueChange={(v) => setField('environmentId', Number(v))}
              disabled={!!editing}
              onOpenChange={(open) => {
                // 展开即按当前已选命名空间重新请求，取最新环境列表
                if (open && form.namespaceId !== undefined) loadFormEnvironments(form.namespaceId);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={formEnvironments.length ? '请选择环境' : '请先选择命名空间'} />
              </SelectTrigger>
              <SelectContent>
                {formEnvironments.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.environmentName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="名称" required error={errors.groupName}>
            <Input
              placeholder="如 应用主配置"
              value={form.groupName}
              onChange={(e) => setField('groupName', e.target.value)}
            />
          </FormField>
          <FormField label="Key" required error={errors.groupKey}>
            <Input
              placeholder="如 application"
              value={form.groupKey}
              disabled={!!editing}
              onChange={(e) => setField('groupKey', e.target.value)}
            />
          </FormField>
          <FormField label="描述">
            <Textarea
              rows={3}
              placeholder="可选"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </FormField>
        </form>
      </FormDrawer>

      {/* 删除二次确认 */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确定删除该配置组？</AlertDialogTitle>
            <AlertDialogDescription>删除为软删除；存在未删除的下级资源时将被拒绝</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
