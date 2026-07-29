import { request } from './http';
import type { OperationLogQuery, OperationLogResponse, PageResponse } from './types';

/** 操作日志接口：对应后端 OperationLogController（路由前缀 /api/operation-logs），日志只读 */

/** 操作日志分页列表（各过滤条件均可选，按创建时间倒序） */
export const listOperationLogs = (params: OperationLogQuery) =>
  request.get<PageResponse<OperationLogResponse>>('/operation-logs', { ...params });
