import { useState } from 'react';
import { toast } from 'sonner';
import { LayoutGrid, Plus, Search } from 'lucide-react';
import { createNamespace, deleteNamespace, listNamespaces, updateNamespace } from '@/api/namespace';
import type { NamespaceResponse } from '@/api/types';
import { useTableRequest } from '@/hooks/useTableRequest';
import { useColumnSettings } from '@/hooks/useColumnSettings';
import type { DataTableColumn } from '@/components/DataTable';
import { DataTable } from '@/components/DataTable';
import PageContainer from '@/components/PageContainer';
import FormDrawer from '@/components/FormDrawer';
import FormField from '@/components/FormField';
import CopyableText from '@/components/CopyableText';
import ColumnSettingButton from '@/components/ColumnSettingButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

/** 抽屉表单字段：新建含 key，编辑时 key 只读展示不提交 */
interface NamespaceFormValues {
  namespaceKey: string;
  namespaceName: string;
  description: string;
}

const emptyForm: NamespaceFormValues = { namespaceKey: '', namespaceName: '', description: '' };

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
  const [form, setForm] = useState<NamespaceFormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof NamespaceFormValues, string>>>({});
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 删除确认目标
  const [deleteTarget, setDeleteTarget] = useState<NamespaceResponse | null>(null);

  const kw = keyword.trim().toLowerCase();
  const filteredData = (data ?? []).filter(
    (item) =>
      !kw ||
      item.namespaceName.toLowerCase().includes(kw) ||
      item.namespaceKey.toLowerCase().includes(kw),
  );

  const setField = (key: keyof NamespaceFormValues, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setDirty(false);
    setDrawerOpen(true);
  };

  const openEdit = (record: NamespaceResponse) => {
    setEditing(record);
    setForm({
      namespaceKey: record.namespaceKey,
      namespaceName: record.namespaceName,
      description: record.description ?? '',
    });
    setErrors({});
    setDirty(false);
    setDrawerOpen(true);
  };

  /** 表单校验：名称与 Key 必填（编辑时 Key 只读但仍要求非空，取自记录本身恒满足） */
  const validate = (): NamespaceFormValues | null => {
    const next: Partial<Record<keyof NamespaceFormValues, string>> = {};
    if (!form.namespaceName.trim()) next.namespaceName = '请输入命名空间名称';
    if (!editing && !form.namespaceKey.trim()) next.namespaceKey = '请输入命名空间 Key';
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
        await updateNamespace(editing.id, {
          namespaceName: values.namespaceName,
          description: values.description || null,
          status: editing.status, // 状态由列表行内切换维护，编辑抽屉不改
        });
        toast.success('更新成功');
      } else {
        await createNamespace({
          namespaceKey: values.namespaceKey,
          namespaceName: values.namespaceName,
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
  const handleToggleStatus = async (record: NamespaceResponse) => {
    const next = record.status === 1 ? 0 : 1;
    try {
      await updateNamespace(record.id, {
        namespaceName: record.namespaceName,
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
      await deleteNamespace(deleteTarget.id);
      toast.success('删除成功');
      reload();
    } catch {
      // 接口错误已由拦截器提示
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns: DataTableColumn<NamespaceResponse>[] = [
    {
      key: 'id',
      title: 'ID',
      width: 80,
      render: (record) => <span className="font-mono text-xs text-muted-foreground">{record.id}</span>,
    },
    { key: 'namespaceName', title: '名称' },
    {
      key: 'namespaceKey',
      title: 'Key',
      render: (record) => <CopyableText value={record.namespaceKey} code />,
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
  const { mergedColumns, columnMetas, setVisible, setWidth, reset } = useColumnSettings('namespace-list', columns);

  return (
    <PageContainer
      title="命名空间管理"
      icon={<LayoutGrid className="size-5" />}
      description="以业务域划分配置隔离边界，命名空间下挂环境与配置组"
      extra={
        <Button onClick={openCreate}>
          <Plus />
          新建命名空间
        </Button>
      }
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-60 pl-8"
            placeholder="搜索名称 / Key"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
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
        title={editing ? '编辑命名空间' : '新建命名空间'}
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
          <FormField label="名称" required error={errors.namespaceName}>
            <Input
              placeholder="如 订单中心"
              value={form.namespaceName}
              onChange={(e) => setField('namespaceName', e.target.value)}
            />
          </FormField>
          <FormField label="Key" required error={errors.namespaceKey}>
            <Input
              placeholder="如 order-center"
              value={form.namespaceKey}
              disabled={!!editing}
              onChange={(e) => setField('namespaceKey', e.target.value)}
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
            <AlertDialogTitle>确定删除该命名空间？</AlertDialogTitle>
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
