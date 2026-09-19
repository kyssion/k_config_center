import { request } from './http';
import type {
  ConfigurationGroupCreateRequest,
  ConfigurationGroupResponse,
  ConfigurationGroupUpdateRequest,
  GroupPublishResponse,
  PublishRequest,
} from './types';

/** 配置组接口：对应后端 ConfigurationGroupController（路由前缀 /api/configuration-groups） */

/** 配置组列表（两个过滤条件均可选、可组合，非分页） */
export const listGroups = (params?: { namespaceId?: number; environmentId?: number }) =>
  request.get<ConfigurationGroupResponse[]>('/configuration-groups', params);

/** 创建配置组，返回新建记录（含 id） */
export const createGroup = (data: ConfigurationGroupCreateRequest) =>
  request.post<ConfigurationGroupResponse>('/configuration-groups', data);

/** 更新配置组（名称/描述/状态，key 与所属环境不可改） */
export const updateGroup = (id: number, data: ConfigurationGroupUpdateRequest) =>
  request.put<null>(`/configuration-groups/${id}`, data);

/** 组级发布：一个事务内发布组内全部「有未发布变更且未下线」的配置，返回发布清单与跳过条数 */
export const publishGroup = (id: number, data: PublishRequest) =>
  request.post<GroupPublishResponse>(`/configuration-groups/${id}/publish`, data);

/** 删除配置组（后端软删除） */
export const deleteGroup = (id: number) => request.delete<null>(`/configuration-groups/${id}`);
