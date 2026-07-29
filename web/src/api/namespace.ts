import { request } from './http';
import type { NamespaceCreateRequest, NamespaceResponse, NamespaceUpdateRequest } from './types';

/** 命名空间接口：对应后端 NamespaceController（路由前缀 /api/namespaces） */

/** 命名空间全量列表（非分页） */
export const listNamespaces = () => request.get<NamespaceResponse[]>('/namespaces');

/** 创建命名空间，返回新建记录（含 id） */
export const createNamespace = (data: NamespaceCreateRequest) =>
  request.post<NamespaceResponse>('/namespaces', data);

/** 更新命名空间（名称/描述/状态，key 不可改） */
export const updateNamespace = (id: number, data: NamespaceUpdateRequest) =>
  request.put<null>(`/namespaces/${id}`, data);

/** 删除命名空间（后端软删除） */
export const deleteNamespace = (id: number) => request.delete<null>(`/namespaces/${id}`);
