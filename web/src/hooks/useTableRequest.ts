import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 通用列表加载 Hook：封装 loading / data / reload 三件套。
 * fetcher 由调用方用 useCallback 稳定引用（或依赖变化时自动重新加载）。
 */
export function useTableRequest<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  // 请求序列号：只接受最新一次 reload 的结果，避免旧请求晚返回覆盖新数据
  const requestIdRef = useRef(0);

  const reload = useCallback(() => {
    const currentId = ++requestIdRef.current;
    setLoading(true);
    fetcher()
      .then((result) => {
        if (requestIdRef.current === currentId) {
          setData(result);
        }
      })
      // 错误提示已由 http.ts 拦截器统一弹出，这里只收尾 loading
      .catch(() => undefined)
      .finally(() => {
        if (requestIdRef.current === currentId) {
          setLoading(false);
        }
      });
  }, [fetcher]);

  // fetcher 变化（如筛选条件变更）时自动重新加载
  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, reload };
}
