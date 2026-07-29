/** execCommand 降级复制：临时 textarea（fixed + 透明，不扰动布局），复制后立即移除 */
const fallbackCopy = (text: string): boolean => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
};

/**
 * 复制文本到剪贴板：优先 navigator.clipboard（需安全上下文），不可用或失败时降级 execCommand。
 * 返回是否复制成功；不在工具内弹提示，由调用方根据结果反馈。
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 安全上下文受限等场景，回退 execCommand
    }
  }
  return fallbackCopy(text);
};
