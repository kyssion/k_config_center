import { useEffect, useRef } from 'react';

/**
 * 间隔轮询 Hook：每隔 intervalMs 调用一次 callback，组件卸载时自动清理。
 * 用于编辑页探测他人发布导致的内容变更等场景（Portal 不使用长轮询接口）。
 * intervalMs 传 null 可暂停轮询。
 */
export function usePolling(callback: () => void, intervalMs: number | null) {
  // ref 保存最新回调，避免 callback 变化导致定时器反复重建
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (intervalMs === null) {
      return;
    }
    const timer = window.setInterval(() => savedCallback.current(), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
}
