import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Server } from 'lucide-react';
import { createEnvironment, deleteEnvironment, listEnvironments, updateEnvironment } from '@/api/environment';
import { listNamespaces } from '@/api/namespace';
import type { EnvironmentResponse } from '@/api/types';
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

/** 抽屉表单字段：新建含命名空间与 key，编辑时两者只读展示不提交 */
interface EnvironmentFormValues {
  namespaceId?: number;
  environmentKey: string;
  environmentName: string;
  description: string;
  sortOrder: number;
}

const emptyForm: EnvironmentFormValues = { environmentKey: '', environmentName: '', description: '', sortOrder: 0 };

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
  const [form, setForm] = useState<EnvironmentFormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof EnvironmentFormValues, string>>>({});
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EnvironmentResponse | null>(null);

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

  const setField = <K extends keyof EnvironmentFormValues>(key: K, value: EnvironmentFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sortOrder: 0 });
    setErrors({});
    setDirty(false);
    setDrawerOpen(true);
  };

  const openEdit = (record: EnvironmentResponse) => {
    setEditing(record);
    setForm({
      namespaceId: record.namespaceId,
      environmentKey: record.environmentKey,
      environmentName: record.environmentName,
      description: record.description ?? '',
      sortOrder: record.sortOrder,
    });
    setErrors({});
    setDirty(false);
    setDrawerOpen(true);
  };

  /** 表单校验：新建要求选命名空间；名称/Key 必填；排序值为合法数字 */
  const validate = (): EnvironmentFormValues | null => {
    const next: Partial<Record<keyof EnvironmentFormValues, string>> = {};
    if (!editing && form.namespaceId === undefined) next.namespaceId = '请选择命名空间';
    if (!form.environmentName.trim()) next.environmentName = '请输入环境名称';
    if (!editing && !form.environmentKey.trim()) next.environmentKey = '请输入环境 Key';
    if (!Number.isFinite(form.sortOrder)) next.sortOrder = '请输入排序值';
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
        await updateEnvironment(editing.id, {
          environmentName: values.environmentName,
          description: values.description || null,
          sortOrder: values.sortOrder,
          status: editing.status, // 状态由列表行内切换维护，编辑抽屉不改
        });
        toast.success('更新成功');
      } else {
        await createEnvironment({
          namespaceId: values.namespaceId!,
          environmentKey: values.environmentKey,
          environmentName: values.environmentName,
          description: values.description || null,
          sortOrder: values.sortOrder,
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
  const handleToggleStatus = async (record: EnvironmentResponse) => {
    const next = record.status === 1 ? 0 : 1;
    try {
      await updateEnvironment(record.id, {
        environmentName: record.environmentName,
        description: record.description,
        sortOrder: record.sortOrder,
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
      await deleteEnvironment(deleteTarget.id);
      toast.success('删除成功');
      reload();
    } catch {
      // 接口错误已由拦截器提示
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns: DataTableColumn<EnvironmentResponse>[] = [
    {
      key: 'id',
      title: 'ID',
      width: 80,
      render: (record) => <span className="font-mono text-xs text-muted-foreground">{record.id}</span>,
    },
    {
      key: 'namespaceId',
      title: '所属命名空间',
      width: 170,
      // 后端联查返回 key/名称；共享 DimensionCell（首行名称 Badge、次行 code 框展示 key，点击复制；key 缺失兜底显 #id）
      render: (record) => (
        <DimensionCell name={record.namespaceName} dimensionKey={record.namespaceKey} id={record.namespaceId} tone="blue" />
      ),
    },
    { key: 'environmentName', title: '名称' },
    {
      key: 'environmentKey',
      title: 'Key',
      render: (record) => <CopyableText value={record.environmentKey} code />,
    },
    {
      key: 'description',
      title: '描述',
      render: (record) => record.description || '-',
    },
    { key: 'sortOrder', title: '排序', width: 80 },
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
  const { mergedColumns, columnMetas, setVisible, setWidth, reset } = useColumnSettings('environment-list', columns);

  return (
    <PageContainer
      title="环境管理"
      icon={<Server className="size-5" />}
      description="管理各命名空间下的部署环境，支持排序与启用状态控制"
      extra={
        <Button onClick={openCreate}>
          <Plus />
          新建环境
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
            onChange={setFilterNamespaceId}
            onOpenChange={(open) => open && reloadNamespaces()}
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
        title={editing ? '编辑环境' : '新建环境'}
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
              onValueChange={(v) => setField('namespaceId', Number(v))}
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
          <FormField label="名称" required error={errors.environmentName}>
            <Input
              placeholder="如 开发环境"
              value={form.environmentName}
              onChange={(e) => setField('environmentName', e.target.value)}
            />
          </FormField>
          <FormField label="Key" required error={errors.environmentKey}>
            <Input
              placeholder="如 dev / test / staging / prod"
              value={form.environmentKey}
              disabled={!!editing}
              onChange={(e) => setField('environmentKey', e.target.value)}
            />
          </FormField>
          <FormField label="排序值" required error={errors.sortOrder}>
            <Input
              type="number"
              placeholder="数值越小越靠前"
              value={Number.isFinite(form.sortOrder) ? form.sortOrder : ''}
              onChange={(e) => setField('sortOrder', e.target.value === '' ? Number.NaN : Number(e.target.value))}
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
            <AlertDialogTitle>确定删除该环境？</AlertDialogTitle>
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
