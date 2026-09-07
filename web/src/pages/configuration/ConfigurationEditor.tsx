import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlignLeft, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import Editor from '@monaco-editor/react';
import '@/utils/monacoSetup';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getConfiguration, publishConfiguration, updateConfiguration } from '@/api/configuration';
import type { ConfigFormat, ConfigurationDetailResponse } from '@/api/types';
import StatusTag from '@/components/StatusTag';
import FormatSelect from '@/components/FormatSelect';
import FormatTag from '@/components/FormatTag';
import CopyableText from '@/components/CopyableText';
import DimensionCell from '@/components/DimensionCell';
import { usePolling } from '@/hooks/usePolling';
import { getFormatter } from '@/utils/formatters';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ReactNode } from 'react';

/** 时间字段本地化展示 */
const formatTime = (value: string | null) => (value ? new Date(value).toLocaleString() : '-');

/**
 * format → Monaco 语言映射。
 * properties/toml 无内置语言支持，映射到 ini（同为 key=value 风格，高亮近似）；
 * text 映射到 plaintext。
 */
const monacoLanguageMap: Record<ConfigFormat, string> = {
  text: 'plaintext',
  json: 'json',
  yaml: 'yaml',
  properties: 'ini',
  xml: 'xml',
  toml: 'ini',
};

/** 信息栏单行：灰 label + 值，底部分隔线 */
function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-b py-2.5 text-sm last:border-b-0">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * 保存前基础语法校验，返回错误信息（null 表示通过）。
 * 委托给 formatters 注册表：json/yaml/xml/properties/toml 各自校验（错误信息含行号），
 * text/未注册格式恒合法；json 额外要求非空（空内容无法构成合法 JSON）。
 */
function validateContent(format: ConfigFormat, content: string): string | null {
  if (format === 'json' && !content.trim()) {
    return 'json 内容不能为空';
  }
  const error = getFormatter(format).validate(content);
  return error ? `${format} 语法错误：${error}` : null;
}

/**
 * 配置编辑页：Monaco 编辑器按 format 高亮，保存（草稿）与发布严格分离；
 * 侧栏展示状态 / md5 / 生效版本信息；低频轮询探测他人变更并提示刷新。
 */
export default function ConfigurationEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const configurationId = Number(id);
  // 路由参数非法（如手改 URL）：hooks 必须无条件执行，此处仅计算标记，跳转放在所有 hooks 之后
  const invalidId = !Number.isFinite(configurationId) || configurationId <= 0;

  // 服务端详情快照（加载/保存后的基准态）
  const [detail, setDetail] = useState<ConfigurationDetailResponse | null>(null);
  // 编辑器本地态
  const [content, setContent] = useState('');
  const [format, setFormat] = useState<ConfigFormat>('text');
  // 本地是否有未保存修改（用于轮询提示的防覆盖判断）
  const [dirty, setDirty] = useState(false);
  // 轮询发现服务端内容已被他人变更
  const [remoteChanged, setRemoteChanged] = useState(false);

  const [saving, setSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishRemark, setPublishRemark] = useState('');

  // 非法 ID 仅提示一次，跳转由渲染末尾的 Navigate 完成
  useEffect(() => {
    if (invalidId) {
      toast.error('配置 ID 非法');
    }
  }, [invalidId]);

  /** 加载详情并重置本地编辑态 */
  const load = useCallback(async () => {
    if (invalidId) return;
    const data = await getConfiguration(configurationId);
    setDetail(data);
    setContent(data.configuration.content ?? '');
    setFormat((data.configuration.format || 'text') as ConfigFormat);
    setDirty(false);
    setRemoteChanged(false);
  }, [configurationId, invalidId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  // 低频轮询（10s）探测他人变更：updatedAt 与本地基准不一致视为内容有变；
  // 仅在本地未编辑时提示刷新，避免覆盖用户正在编辑的内容
  usePolling(() => {
    if (invalidId || !detail) return;
    getConfiguration(configurationId)
      .then((data) => {
        if (data.configuration.updatedAt !== detail.configuration.updatedAt && !dirty) {
          setRemoteChanged(true);
        }
      })
      .catch(() => undefined);
  }, 10_000);

  /** 保存草稿：只更新当前态，不产生版本；保存前按格式走注册表校验 */
  const handleSave = async () => {
    const error = validateContent(format, content);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      await updateConfiguration(configurationId, {
        content,
        format,
        // 描述与标签本页不编辑，回传原值避免被置空
        description: detail?.configuration.description,
        tags: detail?.configuration.tags,
      });
      toast.success('保存成功（草稿，尚未发布）');
      await load();
    } catch {
      // 错误提示已由 http.ts 拦截器统一弹出
    } finally {
      setSaving(false);
    }
  };

  /**
   * 内容美化：canFormat 的格式可用，先校验再格式化，校验失败提示具体错误、不改动内容。
   * 纯本地文本处理，不触发任何接口。
   */
  const handleFormatContent = () => {
    const formatter = getFormatter(format);
    const error = formatter.validate(content);
    if (error) {
      toast.error(`${format} 语法错误，无法格式化：${error}`);
      return;
    }
    setContent(formatter.format(content));
    setDirty(true);
  };

  /** 发布确认：发布的是服务端已保存的内容 */
  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await publishConfiguration(configurationId, {
        changeRemark: publishRemark || null,
      });
      toast.success(`发布成功，版本号 v${result.versionNumber}`);
      setPublishOpen(false);
      setPublishRemark('');
      await load();
    } catch {
      // 错误提示已由拦截器统一处理
    } finally {
      setPublishing(false);
    }
  };

  // 非法 ID 跳回列表：必须位于所有 hooks 之后，避免 hooks 数量在两次渲染间不一致
  if (invalidId) {
    return <Navigate to="/configuration" replace />;
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  const { configuration, publishedVersion } = detail;

  return (
    <div>
      {/* 顶部工具条：返回 + 配置 key + 变更标记；右侧格式切换与操作按钮组 */}
      <Card className="mb-4 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/configuration')}>
              <ArrowLeft />
              返回列表
            </Button>
            <h1 className="text-lg font-semibold tracking-tight">{configuration.configurationKey}</h1>
            {/* hasUnpublishedChange 由服务端计算，前端只做展示 */}
            {configuration.hasUnpublishedChange && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="border-transparent bg-amber-50 text-amber-700">
                    有未发布变更
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>当前内容与生效版本存在差异，发布后才对客户端生效</TooltipContent>
              </Tooltip>
            )}
            {dirty && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="border-transparent bg-sky-50 text-sky-700">
                    本地未保存
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>本地修改尚未保存到服务端</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FormatSelect
              value={format}
              onChange={(value) => {
                setFormat(value);
                setDirty(true);
              }}
            />
            {/* canFormat 的格式（json/yaml/xml/properties）提供格式化入口 */}
            {getFormatter(format).canFormat && (
              <Button variant="outline" onClick={handleFormatContent}>
                <AlignLeft />
                格式化
              </Button>
            )}
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              保存草稿
            </Button>
            <Button onClick={() => setPublishOpen(true)}>发布</Button>
            <Button variant="outline" onClick={() => navigate(`/configuration/${configurationId}/versions`)}>
              版本历史
            </Button>
          </div>
        </div>
      </Card>

      {/* 他人变更提示：仅本地未编辑时出现，点击刷新拉取最新内容 */}
      {remoteChanged && (
        <Alert variant="warning" className="mb-4" action={
          <Button size="sm" onClick={() => load().catch(() => undefined)}>
            <RefreshCw />
            刷新
          </Button>
        }>
          <span>该配置已被他人修改，本地内容不是最新</span>
        </Alert>
      )}

      <div className="flex items-start gap-4">
        {/* 左侧信息栏：字段口径对齐详情抽屉（维度、key、版本、人员、时间、说明），编辑器居右 */}
        <Card className="w-80 shrink-0 p-4">
          <p className="mb-2 text-sm font-semibold">配置信息</p>
          <div className="flex flex-col">
            <InfoRow label="配置 ID">
              <span className="font-mono text-sm">{configuration.id}</span>
            </InfoRow>
            <InfoRow label="状态">
              <StatusTag status={configuration.status} />
            </InfoRow>
            <InfoRow label="命名空间">
              <DimensionCell
                name={configuration.namespaceName}
                dimensionKey={configuration.namespaceKey}
                id={configuration.namespaceId}
                tone="blue"
              />
            </InfoRow>
            <InfoRow label="环境">
              <DimensionCell
                name={configuration.environmentName}
                dimensionKey={configuration.environmentKey}
                id={configuration.environmentId}
                tone="cyan"
              />
            </InfoRow>
            <InfoRow label="所属配置组">
              <DimensionCell
                name={configuration.groupName}
                dimensionKey={configuration.groupKey}
                id={configuration.groupId}
                tone="sky"
              />
            </InfoRow>
            <InfoRow label="配置项 Key">
              <CopyableText value={configuration.configurationKey} code maxWidth={180} />
            </InfoRow>
            <InfoRow label="保存格式">
              <FormatTag format={configuration.format} />
            </InfoRow>
            <InfoRow label="当前 md5">
              {configuration.md5 ? <CopyableText value={configuration.md5} code /> : <span className="text-muted-foreground">-</span>}
            </InfoRow>
            <InfoRow label="生效版本">
              {publishedVersion ? `v${publishedVersion.versionNumber}` : '从未发布'}
            </InfoRow>
            <InfoRow label="生效 md5">
              {publishedVersion?.md5 ? <CopyableText value={publishedVersion.md5} code /> : <span className="text-muted-foreground">-</span>}
            </InfoRow>
            <InfoRow label="最新版本">
              {configuration.latestVersionNumber > 0 ? `v${configuration.latestVersionNumber}` : '-'}
            </InfoRow>
            <InfoRow label="发布时间">{formatTime(configuration.publishedAt)}</InfoRow>
            <InfoRow label="创建人">{configuration.createdBy || '-'}</InfoRow>
            <InfoRow label="创建时间">{formatTime(configuration.createdAt)}</InfoRow>
            <InfoRow label="最后修改人">{configuration.updatedBy || '-'}</InfoRow>
            <InfoRow label="更新时间">{formatTime(configuration.updatedAt)}</InfoRow>
            <InfoRow label="标签">{configuration.tags || '-'}</InfoRow>
            <InfoRow label="配置说明">{configuration.description || '-'}</InfoRow>
          </div>
        </Card>

        <Card className="min-w-0 flex-1 p-2">
          <Editor
            height="60vh"
            language={monacoLanguageMap[format] ?? 'plaintext'}
            value={content}
            onChange={(value) => {
              setContent(value ?? '');
              setDirty(true);
            }}
            options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
          />
        </Card>
      </div>

      {/* 发布弹窗：填写变更备注；发布与保存严格分离 */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发布配置：{configuration.configurationKey}</DialogTitle>
            <DialogDescription>发布后立即对客户端生效</DialogDescription>
          </DialogHeader>
          {/* 发布的是服务端已保存内容：本地未保存修改不会包含在本次发布中 */}
          {dirty && (
            <Alert variant="warning">
              <span>本地存在未保存的修改，本次发布仅包含已保存的草稿内容，请先保存</span>
            </Alert>
          )}
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
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              取消
            </Button>
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? '发布中…' : '发布'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
