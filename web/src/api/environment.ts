import { request } from './http';
import type { EnvironmentCreateRequest, EnvironmentResponse, EnvironmentUpdateRequest } from './types';

/** 环境接口：对应后端 EnvironmentController（路由前缀 /api/environments） */

/** 环境列表（按 sortOrder 升序，非分页）；namespaceId 缺省时查全量（axios 自动省略 undefined 参数） */
export const listEnvironments = (namespaceId?: number) =>
  request.get<EnvironmentResponse[]>('/environments', { namespaceId });

/** 创建环境，返回新建记录（含 id） */
export const createEnvironment = (data: EnvironmentCreateRequest) =>
  request.post<EnvironmentResponse>('/environments', data);

/** 更新环境（名称/描述/排序/状态，key 与所属命名空间不可改） */
export const updateEnvironment = (id: number, data: EnvironmentUpdateRequest) =>
  request.put<null>(`/environments/${id}`, data);

/** 删除环境（后端软删除） */
export const deleteEnvironment = (id: number) => request.delete<null>(`/environments/${id}`);
