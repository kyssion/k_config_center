import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';
import type { ApiResponse } from './types';

/**
 * Axios 实例与拦截器：统一错误提示与响应解包。
 * 后端统一响应结构 { code, message, data }，业务失败时 HTTP 仍为 200、由 code 表达；
 * 拦截器解包后页面代码只感知 data，不重复处理错误展示。
 */
const http = axios.create({
  baseURL: '/api',
  timeout: 30_000,
});

// 请求拦截器：非 GET 的写操作注入 X-Operator 头（后端缺省 system，Portal 缺省 portal）
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (config.method && config.method.toLowerCase() !== 'get') {
    config.headers.set('X-Operator', localStorage.getItem('operator') || 'portal');
  }
  return config;
});

// 响应拦截器：code === 0 直接返回 data；业务失败与 HTTP 错误统一弹出错误提示并 reject
http.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>;
    if (body.code === 0) {
      return body.data as never;
    }
    message.error(body.message || '请求失败');
    return Promise.reject(new Error(body.message || `业务错误码 ${body.code}`));
  },
  (error: AxiosError<ApiResponse<unknown>>) => {
    // HTTP 非 2xx：优先展示后端返回的 message，否则展示网络层错误
    const msg = error.response?.data?.message || error.message || '网络请求失败';
    message.error(msg);
    return Promise.reject(error);
  },
);

/**
 * 请求方法薄封装：拦截器已把响应体解包为 data，
 * 这里收窄类型让调用方直接拿到业务数据类型 T。
 */
export const request = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    http.get<never, T>(url, { params }),
  post: <T>(url: string, data?: unknown) => http.post<never, T>(url, data),
  put: <T>(url: string, data?: unknown) => http.put<never, T>(url, data),
  delete: <T>(url: string) => http.delete<never, T>(url),
};

export default http;
