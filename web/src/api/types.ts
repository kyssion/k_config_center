/**
 * 与后端 Requests/Responses 对齐的 TypeScript 类型（camelCase，源自 k_config_center/src/Models）。
 * 时间字段为 ISO 8601 字符串（后端 DateTimeOffset 序列化）；status 数值 1=启用 0=禁用。
 */

/** 后端统一响应包裹结构：code=0 成功，非 0 业务失败（HTTP 仍 200） */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 分页结构：操作日志 / 版本历史等分页接口的 data 形态 */
export interface PageResponse<T> {
  items: T[];
  total: number;
}

/** 配置内容格式 */
export type ConfigFormat = 'text' | 'json' | 'yaml' | 'properties' | 'xml' | 'toml';

/** 配置项状态机 */
export type ConfigStatus = 'DRAFT' | 'PUBLISHED' | 'OFFLINE';

/** 版本变更类型 */
export type ChangeType = 'CREATE' | 'UPDATE' | 'ROLLBACK';

/** 操作日志的操作类型 */
export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE' | 'PUBLISH' | 'ROLLBACK' | 'OFFLINE';

// ---------- 命名空间 ----------

export interface NamespaceResponse {
  id: number;
  namespaceKey: string;
  namespaceName: string;
  description: string | null;
  status: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NamespaceCreateRequest {
  namespaceKey: string;
  namespaceName: string;
  description?: string | null;
}

export interface NamespaceUpdateRequest {
  namespaceName: string;
  description?: string | null;
  status: number;
}

// ---------- 环境 ----------

export interface EnvironmentResponse {
  id: number;
  namespaceId: number;
  /** 所属命名空间业务 key/名称（列表展示用，后端联查补充，可选可空） */
  namespaceKey?: string | null;
  namespaceName?: string | null;
  environmentKey: string;
  environmentName: string;
  description: string | null;
  sortOrder: number;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentCreateRequest {
  namespaceId: number;
  environmentKey: string;
  environmentName: string;
  description?: string | null;
  sortOrder: number;
}

export interface EnvironmentUpdateRequest {
  environmentName: string;
  description?: string | null;
  sortOrder: number;
  status: number;
}

// ---------- 配置组 ----------

export interface ConfigurationGroupResponse {
  id: number;
  namespaceId: number;
  environmentId: number;
  /** 所属命名空间/环境业务 key 与名称（列表展示用，后端联查补充，可选可空） */
  namespaceKey?: string | null;
  namespaceName?: string | null;
  environmentKey?: string | null;
  environmentName?: string | null;
  groupKey: string;
  groupName: string;
  description: string | null;
  status: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigurationGroupCreateRequest {
  namespaceId: number;
  environmentId: number;
  groupKey: string;
  groupName: string;
  description?: string | null;
}

export interface ConfigurationGroupUpdateRequest {
  groupName: string;
  description?: string | null;
  status: number;
}

// ---------- 配置项 ----------

export interface ConfigurationResponse {
  id: number;
  groupId: number;
  namespaceId: number;
  environmentId: number;
  /** 所属命名空间/环境/配置组名称（列表展示用，后端联查补充，可选可空） */
  namespaceName?: string | null;
  environmentName?: string | null;
  groupName?: string | null;
  /** 所属命名空间/环境/配置组业务 key（列表展示用，后端联查补充，可选可空） */
  namespaceKey?: string | null;
  environmentKey?: string | null;
  groupKey?: string | null;
  configurationKey: string;
  content: string | null;
  format: string;
  md5: string | null;
  description: string | null;
  tags: string | null;
  status: ConfigStatus;
  publishedVersionId: number | null;
  latestVersionNumber: number;
  publishedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** 当前内容与生效版本是否有差异（服务端算好，前端不做 md5 对比） */
  hasUnpublishedChange: boolean;
}

/** 配置详情：当前编辑态 + 生效版本快照（从未发布过为 null） */
export interface ConfigurationDetailResponse {
  configuration: ConfigurationResponse;
  publishedVersion: ConfigurationVersionResponse | null;
}

export interface ConfigurationVersionResponse {
  id: number;
  configurationId: number;
  versionNumber: number;
  content: string | null;
  format: string | null;
  md5: string | null;
  changeType: ChangeType;
  changeRemark: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ConfigurationCreateRequest {
  groupId: number;
  configurationKey: string;
  content?: string | null;
  format?: string;
  description?: string | null;
  tags?: string | null;
}

export interface ConfigurationUpdateRequest {
  content?: string | null;
  format?: string;
  description?: string | null;
  tags?: string | null;
}

export interface PublishRequest {
  changeRemark?: string | null;
}

export interface RollbackRequest {
  versionNumber: number;
  changeRemark?: string | null;
}

/** 发布/回滚结果：新生成的版本快照 id 与版本号 */
export interface PublishResponse {
  versionId: number;
  versionNumber: number;
}

// ---------- 操作日志 ----------

export interface OperationLogResponse {
  id: number;
  namespaceId: number | null;
  environmentId: number | null;
  groupId: number | null;
  configurationId: number | null;
  /** 关联维度的业务 key 与名称（列表展示用，后端联查补充、含已软删记录，可选可空；配置项无显示名称只有 key） */
  namespaceKey?: string | null;
  namespaceName?: string | null;
  environmentKey?: string | null;
  environmentName?: string | null;
  groupKey?: string | null;
  groupName?: string | null;
  configurationKey?: string | null;
  operation: string;
  detail: string | null;
  operator: string | null;
  clientIpAddress: string | null;
  createdAt: string;
}

/** 操作日志查询参数：各条件均可选，时间为 ISO 8601 字符串，区间 [startTime, endTime) */
export interface OperationLogQuery {
  namespaceId?: number;
  environmentId?: number;
  groupId?: number;
  configurationId?: number;
  operation?: string;
  startTime?: string;
  endTime?: string;
  pageIndex?: number;
  pageSize?: number;
}

/** 配置项列表查询参数：命名空间/环境/组均可选组合过滤，全不传为全量 */
export interface ConfigurationListQuery {
  namespaceId?: number;
  environmentId?: number;
  groupId?: number;
  status?: ConfigStatus;
  keyword?: string;
}
