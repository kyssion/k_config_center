---
kind: external_dependency
name: Ant Design 5 主题与组件体系
slug: ant-design-5
category: external_dependency
category_hints:
    - framework_behavior
scope:
    - '**'
---

前端基于 Ant Design 5.21 + @ant-design/icons 5.6，通过 `main.tsx` 注入全局 theme token（主色 geekblue `#2f54eb`、圆角 6、灰色页面底 `#f5f7fa`、系统字体栈、白色侧栏/顶栏）。所有列表页、抽屉表单、状态 Tag、格式 Tag 均基于 AntD 组件扩展，未引入额外 UI 框架。