import { request } from './http';
import type {
  ConfigurationCreateRequest,
  ConfigurationDetailResponse,
  ConfigurationListQuery,
  ConfigurationResponse,
  ConfigurationUpdateRequest,
  ConfigurationVersionResponse,
  PageResponse,
  PublishRequest,
  PublishResponse,
  RollbackRequest,
} from './types';

/** 配置项接口：对应后端 ConfigurationController（路由前缀 /api/configurations），
 * 含编辑（草稿）/发布/回滚/下线/版本历史；客户端读取接口为 SDK 专用，Portal 不消费 */

/** 配置项列表（命名空间/环境/组可选组合过滤，非分页），附 hasUnpublishedChange 标记 */
export const listConfigurations = (params: ConfigurationListQuery) =>
  request.get<ConfigurationResponse[]>('/configurations', { ...params });

/** 配置详情：当前编辑态 + 生效版本快照 */
export const getConfiguration = (id: number) =>
  request.get<ConfigurationDetailResponse>(`/configurations/${id}`);

/** 新建配置（初始 DRAFT、版本号 0），返回新建记录（含 id） */
export const createConfiguration = (data: ConfigurationCreateRequest) =>
  request.post<ConfigurationResponse>('/configurations', data);

/** 保存编辑（草稿）：只更新当前态，不产生版本、不改变 status */
export const updateConfiguration = (id: number, data: ConfigurationUpdateRequest) =>
  request.put<null>(`/configurations/${id}`, data);

/** 删除配置（后端软删除，版本快照与日志保留） */
export const deleteConfiguration = (id: number) => request.delete<null>(`/configurations/${id}`);

/** 发布配置：生成新版本快照并置 PUBLISHED */
export const publishConfiguration = (id: number, data: PublishRequest) =>
  request.post<PublishResponse>(`/configurations/${id}/publish`, data);

/** 回滚配置：以历史版本内容重新发布（版本号不回退，生成 ROLLBACK 新版本） */
export const rollbackConfiguration = (id: number, data: RollbackRequest) =>
  request.post<PublishResponse>(`/configurations/${id}/rollback`, data);

/** 下线配置：status 置 OFFLINE（仅 PUBLISHED 可下线） */
export const offlineConfiguration = (id: number) =>
  request.post<null>(`/configurations/${id}/offline`);

/** 版本历史列表（分页，按版本号倒序） */
export const listVersions = (id: number, pageIndex = 1, pageSize = 20) =>
  request.get<PageResponse<ConfigurationVersionResponse>>(`/configurations/${id}/versions`, {
    pageIndex,
    pageSize,
  });

/** 单个版本快照（供 Diff 取数） */
export const getVersion = (id: number, versionNumber: number) =>
  request.get<ConfigurationVersionResponse>(`/configurations/${id}/versions/${versionNumber}`);
