import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并 Tailwind class：条件拼接 + 后写优先的冲突消解（shadcn/ui 标配工具） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
