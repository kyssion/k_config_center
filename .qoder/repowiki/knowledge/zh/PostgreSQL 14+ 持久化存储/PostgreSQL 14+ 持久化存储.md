---
kind: external_dependency
name: PostgreSQL 14+ 持久化存储
slug: postgresql
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
---

项目使用 PostgreSQL 14+ 作为唯一数据源，通过 Npgsql + SqlSugarCore 访问。连接串位于 `appsettings.json` 的 `ConnectionStrings.PostgreSQL`，默认库名为 `k_config_center`；开发环境凭据在 `appsettings.Development.json`（已 `.gitignore`）。建表脚本位于 `docs/数据库脚本/配置中心建表脚本.sql`，定义 6 张表（namespace/environment/configuration_group/configuration/configuration_version/operation_log）及 `updated_at` 自动更新触发器、部分唯一索引与外键约束。版本表与审计日志无软删除列，主资源统一软删除配合 `WHERE deleted_at IS NULL` 实现同 key 复用。