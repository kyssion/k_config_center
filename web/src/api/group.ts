import { request } from './http';
import type {
  ConfigurationGroupCreateRequest,
  ConfigurationGroupResponse,
  ConfigurationGroupUpdateRequest,
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

/** 删除配置组（后端软删除） */
export const deleteGroup = (id: number) => request.delete<null>(`/configuration-groups/${id}`);
