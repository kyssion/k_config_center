import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

interface DiffViewerProps {
  /** 旧文本（左侧），空内容传空串 */
  oldText: string;
  /** 新文本（右侧），空内容传空串 */
  newText: string;
  /** 左侧标题（如版本号），可选 */
  oldTitle?: string;
  /** 右侧标题，可选 */
  newTitle?: string;
  /** 单栏模式（inline），默认双栏（split） */
  splitView?: boolean;
}

/** Diff 视图封装：按行对比旧/新文本，用于版本历史与「编辑态 vs 已发布」对比 */
export default function DiffViewer({ oldText, newText, oldTitle, newTitle, splitView = true }: DiffViewerProps) {
  return (
    <ReactDiffViewer
      oldValue={oldText}
      newValue={newText}
      leftTitle={oldTitle}
      rightTitle={newTitle}
      splitView={splitView}
      compareMethod={DiffMethod.LINES}
    />
  );
}
