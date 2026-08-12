---
kind: configuration_system
name: ASP.NET Core + Vite 双端配置加载与分层管理
category: configuration_system
scope:
    - '**'
source_files:
    - k_config_center/Program.cs
    - k_config_center/appsettings.json
    - k_config_center/appsettings.Development.json
    - k_config_center/Properties/launchSettings.json
    - k_config_center/src/Infrastructure/SqlSugarSetup.cs
    - web/vite.config.ts
    - web/src/api/http.ts
---

## 1. 整体方案

本仓库采用 ASP.NET Core Web API（后端）+ React/Vite（前端）的全栈架构，配置系统围绕 .NET `IConfiguration` 体系与 Vite 构建时配置展开：

- **后端**：通过 `appsettings.json` / `appsettings.Development.json` 提供应用级配置，使用 `ConnectionStrings` 注入 PostgreSQL 连接串；通过 `launchSettings.json` 的 `environmentVariables` 设置 `ASPNETCORE_ENVIRONMENT` 切换环境。
- **前端**：Vite 在开发期通过 `vite.config.ts` 的 `server.proxy` 将 `/api` 请求代理到后端 `localhost:9002`；构建产物输出到 `../k_config_center/wwwroot`，由后端 `UseStaticFiles()` 托管，实现单一部署包。

## 2. 关键文件与位置

| 层级 | 文件 | 作用 |
|---|---|---|
| 后端应用入口 | `k_config_center/Program.cs` | 注册服务、Swagger、静态文件、全局异常处理、SPA 兜底路由 |
| 应用配置 | `k_config_center/appsettings.json` | 默认日志级别、AllowedHosts、PostgreSQL 连接串占位符 |
| 开发配置 | `k_config_center/appsettings.Development.json` | 覆盖日志级别为 Debug、填入实际数据库连接串 |
| 启动环境 | `k_config_center/Properties/launchSettings.json` | 定义 http/https 两种 profile，设置 `ASPNETCORE_ENVIRONMENT=Development` |
| 数据层配置 | `k_config_center/src/Infrastructure/SqlSugarSetup.cs` | 从 `builder.Configuration.GetConnectionString("PostgreSQL")` 读取连接串并注册单例 `ISqlSugarClient` |
| 前端构建 | `web/vite.config.ts` | 定义别名、开发代理、构建输出目录 |
| 前端 HTTP | `web/src/api/http.ts` | Axios 实例、统一拦截器、`baseURL=/api` |

## 3. 架构与设计约定

### 3.1 后端配置加载链

1. `WebApplication.CreateBuilder(args)` 自动加载 `appsettings.json` → `appsettings.{Environment}.json` → 环境变量 → 命令行参数（ASP.NET Core 默认顺序）。
2. `Program.cs` 调用 `builder.Services.AddSqlSugarSetup(builder.Configuration)`，将 `IConfiguration` 传入 SqlSugar 初始化扩展。
3. `SqlSugarSetup.AddSqlSugarSetup` 中通过 `configuration.GetConnectionString("PostgreSQL")` 获取连接串；若缺失则抛出 `InvalidOperationException`，强制要求生产环境必须提供该键。
4. 实体映射使用 `InitKeyType.Attribute`，表结构由外部 DDL 脚本维护（注释明确禁用 CodeFirst），查询层启用全局软删除过滤器（`DeletedAt == null`）。

### 3.2 环境隔离策略

- 开发环境：`launchSettings.json` 设置 `ASPNETCORE_ENVIRONMENT=Development`，触发 `appsettings.Development.json` 覆盖，同时启用 Swagger UI（`IsDevelopment()` 分支）。
- 生产环境：不启用 Swagger UI；`appsettings.json` 中的连接串为占位符，需由部署平台以环境变量或密钥管理服务注入。

### 3.3 前后端联调与部署配置

- 开发期：Vite 服务器端口 `9001`，通过 `proxy '/api' -> localhost:9002` 转发到后端；后端监听 `http://localhost:9002`。
- 构建期：`outDir: '../k_config_center/wwwroot'`，将前端产物直接打入后端静态目录，配合 `UseStaticFiles()` 和 `MapFallbackToFile("index.html")` 实现 SPA 单应用部署。
- 运行时：前端 axios 统一以 `baseURL: '/api'` 发起请求，无需硬编码后端地址。

### 3.4 安全与审计相关配置

- 写操作请求头：前端非 GET 请求自动注入 `X-Operator` 头（取自 `localStorage.operator`，缺省为 `portal`），用于记录操作人；后端通过 `HttpContextAccessor` 提取当前请求上下文。
- 全局异常处理：业务异常 `BusinessException` 返回 HTTP 200 + `{ code, message, data: null }`；未捕获异常记录结构化日志后返回 500，避免堆栈泄露。

## 4. 约定与约束

- **数据库连接串键名固定**：必须提供 `ConnectionStrings:PostgreSQL`，否则启动阶段抛异常（`SqlSugarSetup.cs` 显式校验）。
- **禁止自行 new SqlSugarClient**：注释明确要求所有 Repository 必须经 DI 注入此处注册的 `ISqlSugarClient` 单例，否则跨 Repository 的环境事务会失效。
- **DDL 手工执行**：禁用 CodeFirst，表结构由 `docs/数据库脚本/配置中心建表脚本.sql` 维护，实体仅做映射。
- **软删除全局生效**：含 `DeletedAt` 的实体默认过滤已删除行，审计回溯等场景需显式 `ClearFilter` 绕过。
- **前端代理目标绑定 launchSettings**：`vite.config.ts` 中代理目标 `localhost:9002` 与 `launchSettings.json` 的 http profile 端口一致，修改任一需同步更新。
- **API 前缀统一**：前端 `baseURL=/api`，后端控制器按 REST 风格暴露，未知 `/api/*` 路径返回 404（`MapFallback("/api/{*path}", NotFound)`）。
- **响应格式统一**：后端统一 `{ code, message, data }`，前端拦截器对 `code === 0` 解包 data，非零则弹出错误提示并 reject。

## 5. 适用性说明

该配置系统覆盖了 .NET 应用启动配置、数据库连接、环境切换、前后端联调代理以及部署时的静态资源托管，是一个完整但相对轻量级的全栈配置方案。