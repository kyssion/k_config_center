import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

/**
 * Monaco 本地化：@monaco-editor/react 默认经 @monaco-editor/loader 运行时从
 * cdn.jsdelivr.net 拉取 monaco，内网/离线环境下编辑器不可用。此处改为使用
 * 本地打包的 monaco-editor 实例，保持「单镜像自包含部署」。
 *
 * 本模块是带副作用的配置模块，由 ConfigurationEditor 顶部 import（首个使用方），
 * 必须在 <Editor> 首次挂载前完成 loader.config。
 *
 * Web Worker 无需手工配置：monaco-editor 0.5x 在打包器环境下内置了基于
 * `new URL(..., import.meta.url)` 的相对路径自举（基础编辑 worker 走
 * editorWebWorkerMain，json/css/html/ts 语言 worker 走各自 workerManager），
 * Vite 构建期静态分析并产出独立 worker chunk。自定义 MonacoEnvironment.getWorker
 * 反而会覆盖内置自举，须保持 undefined。
 */
loader.config({ monaco });
