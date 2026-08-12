---
kind: frontend_style
name: 基于 Ant Design 5 的 React + Vite 前端样式体系
category: frontend_style
scope:
    - '**'
source_files:
    - web/src/main.tsx
    - web/src/layouts/MainLayout.tsx
    - web/src/components/PageContainer.tsx
    - web/vite.config.ts
    - web/package.json
    - web/src/pages/configuration/ConfigurationList.tsx
---

## 1. 采用的系统与工具

- **UI 组件库**：Ant Design 5（`antd@^5.21.0`），配合 `@ant-design/icons@^5.6.1` 图标库。
- **构建与开发**：Vite 5 + `@vitejs/plugin-react`，TypeScript 5，通过 `vite.config.ts` 将构建产物输出到后端 `k_config_center/wwwroot`，实现前后端单体部署。
- **编辑器与可视化**：`@monaco-editor/react` 用于配置内容编辑，`react-diff-viewer-continued` 展示版本差异，`js-yaml`、`xml-formatter` 处理多格式配置值。
- **状态管理**：Zustand（已引入）；当前页面级状态以 React Hooks 为主。
- **路由**：React Router v6。

## 2. 关键文件与位置

| 作用 | 路径 |
|---|---|
| 应用入口与全局主题 | `web/src/main.tsx` |
| 根路由容器 | `web/src/App.tsx` |
| 主布局（侧边栏 + 顶栏 + 内容区） | `web/src/layouts/MainLayout.tsx` |
| 页面通用容器（标题 banner + Card 内容区） | `web/src/components/PageContainer.tsx` |
| 表格列设置、请求封装等 UI 复用 Hook | `web/src/hooks/useColumnSettings.ts`、`useTableRequest.ts` |
| 业务页面（配置/环境/分组/命名空间/审计） | `web/src/pages/**` |
| 共享 UI 组件（状态标签、格式标签、抽屉表单、Diff 查看器等） | `web/src/components/**` |
| Vite 配置（别名 `@`、代理 `/api`、构建输出目录） | `web/vite.config.ts` |
| 依赖清单 | `web/package.json` |

## 3. 架构与设计约定

### 3.1 主题系统（Design Tokens）

所有视觉变量集中在 `main.tsx` 的 `ConfigProvider` 中定义，采用 Ant Design 5 的 `theme.token` 覆盖方式：

- **品牌主色**：`colorPrimary: '#2f54eb'`（蓝色），作为按钮、链接、选中态、PageContainer 圆形图标底色等统一来源。
- **圆角**：`borderRadius: 6`，卡片、输入框、弹窗统一使用。
- **画布背景**：`colorBgLayout: '#f5f7fa'`，页面整体浅灰底，避免纯白造成的视觉割裂。
- **字体栈**：`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif`，优先系统字体并兼容中文。
- **组件级覆盖**：`Layout.siderBg/headerBg = '#fff'`、`Table.headerBg = '#fafafa'`，保证侧边栏、表头为白色。
- **语言**：`ConfigProvider locale={zhCN}` 全局启用中文文案。

### 3.2 布局结构

- 顶层 `MainLayout` 使用 AntD `Layout` 组合 `Sider`（宽度 200，浅色主题，带分割线）、`Header`（白底、阴影、操作人输入框）、`Content`（24px padding）。
- 每个业务页面通过 `PageContainer` 包裹，提供统一的标题区（可选渐变 banner + 圆形图标 + 描述 + extra 操作区）和 `Card` 内容容器，确保各页面风格一致。
- 导航菜单项 key 即路由路径，支持深层路由归并高亮。

### 3.3 样式组织方式

- **无独立 CSS/SCSS/Less 文件**：仓库中未发现任何 `*.css`、`*.scss`、`*.less` 或 Tailwind 配置文件。所有样式通过以下三种方式内联完成：
  1. **Ant Design 主题 token**：在 `main.tsx` 集中声明。
  2. **组件 inline style**：如 `MainLayout` 中的 `style={{ minHeight: '100vh' }}`、`header` 的背景/边框/阴影等。
  3. **Tailwind 风格的 className 字符串**：如 `PageContainer` 中使用 `display: 'flex'`、`gap: 16`、`background: linear-gradient(...)` 等 JS 对象形式。
- 这种“零 CSS 文件”的方式使样式完全跟随组件树，便于局部调整但缺乏全局样式隔离机制。

### 3.4 设计一致性约束

- **颜色**：除主色 `#2f54eb` 外，其他颜色来自 AntD 语义色（如 `geekblue`、`cyan`、`blue` 用于维度 Tag，`orange` 表示未发布变更）。
- **间距**：页面级间距统一使用 16px、24px 等固定值，通过 `Space`、`Card` 默认 margin/padding 控制。
- **字号**：标题使用 `Typography.Title level={4}`，正文使用 `Typography.Text type="secondary"`，代码/ID 使用 `fontFamily: 'monospace'`。
- **交互反馈**：成功/失败提示统一通过 AntD `message.success/error`，危险操作通过 `Modal.confirm` 二次确认。

## 4. 约定与约束

| 约定 | 说明 | 依据 |
|---|---|---|
| 全局主题只允许在 `main.tsx` 修改 | 所有页面通过 `ConfigProvider` 继承主题，禁止在各组件内单独覆盖主题 | `main.tsx` 中 `ConfigProvider` 包裹整个 App |
| 页面统一由 `PageContainer` 包裹 | 新页面需使用此组件获得一致的标题 banner 与 Card 内容区 | `PageContainer` 被所有业务页面复用 |
| 不使用外部样式文件 | 项目中不存在任何 CSS/SCSS/Less/Tailwind 配置，样式全部通过 inline style 与 AntD 主题完成 | 全仓搜索未发现 `.css/.scss/.less` 导入及对应文件 |
| 品牌主色固定为 `#2f54eb` | 出现在主题 token、Logo、PageContainer 圆形图标等多个位置 | `main.tsx` 与 `MainLayout.tsx`、`PageContainer.tsx` 多处引用 |
| 构建产物输出至后端静态目录 | Vite 构建后直接复制到 `k_config_center/wwwroot`，实现单一应用部署 | `vite.config.ts` 中 `build.outDir` |
| 开发时通过 Vite 代理 `/api` 到后端 9002 端口 | 解决跨域问题，前端与后端同源访问 | `vite.config.ts` 中 `server.proxy` |

## 5. 总结

该前端采用 **Ant Design 5 + Vite + TypeScript** 的轻量方案，通过 `ConfigProvider` 集中管理设计令牌（主色、圆角、背景、字体、组件级覆盖），并以 `PageContainer` + `MainLayout` 两个高层布局组件强制统一页面结构与视觉风格。项目刻意不引入任何独立的 CSS/SCSS/Less 文件，所有样式通过 inline style 与 AntD 主题完成，形成“零样式文件、单点主题”的独特风格体系。这种模式适合中小型后台管理系统，维护成本低，但在复杂主题定制或样式复用方面存在局限。