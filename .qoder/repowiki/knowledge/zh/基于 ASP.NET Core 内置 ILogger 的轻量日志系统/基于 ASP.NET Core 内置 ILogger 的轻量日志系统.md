---
kind: logging_system
name: 基于 ASP.NET Core 内置 ILogger 的轻量日志系统
category: logging_system
scope:
    - '**'
source_files:
    - k_config_center/Program.cs
    - k_config_center/appsettings.json
    - k_config_center/appsettings.Development.json
    - k_config_center/src/Controllers/HealthController.cs
---

## 1. 使用的系统与框架

本仓库采用 ASP.NET Core 内置的依赖注入 + `Microsoft.Extensions.Logging` 体系，未引入任何第三方日志库（如 Serilog、NLog、MiniProfiler 等）。所有日志通过构造函数注入的 `ILogger<T>` 输出，由运行时根据 `appsettings.json` / `appsettings.Development.json` 中的 `Logging.LogLevel` 配置进行过滤。

## 2. 关键文件与位置

- `k_config_center/Program.cs`：应用启动入口，注册中间件并集中处理全局异常；在 `catch (Exception)` 分支中调用 `app.Logger.LogError(exception, "未处理异常：{Method} {Path}", ...)` 记录未捕获异常。
- `k_config_center/appsettings.json`：生产环境日志级别配置，默认 `Information`，`Microsoft.AspNetCore` 为 `Warning`。
- `k_config_center/appsettings.Development.json`：开发环境日志级别配置，默认 `Debug`，`Microsoft.AspNetCore` 也为 `Debug`。
- `k_config_center/src/Controllers/HealthController.cs`：唯一显式使用 `ILogger<HealthController>` 的业务代码，在数据库连接失败时调用 `logger.LogError(exception, "健康检查：数据库连接失败")`。

## 3. 架构与约定

- **无自定义 Logger 抽象**：项目中没有定义统一的日志门面或封装类，各组件直接通过 DI 获取 `ILogger<T>` 实例。
- **集中式异常日志**：全局异常处理中间件统一记录未处理异常，包含 HTTP Method 和 Path 两个结构化字段，避免业务层重复记录堆栈。
- **按环境区分日志级别**：生产默认 `Information`，仅记录信息及以上；开发默认 `Debug`，便于本地排查。ASP.NET Core 自身日志在生产降级为 `Warning`，减少噪音。
- **无异步落盘/滚动文件/外部 Sink**：当前未配置控制台以外的输出目标，日志仅走默认 Console 提供者。

## 4. 约定与约束

- **日志级别策略**：生产环境以 `Information` 为基线，仅对 `Microsoft.AspNetCore` 框架日志降为 `Warning`；开发环境提升为 `Debug`。该策略由 `appsettings.json` 与 `appsettings.Development.json` 强制生效。
- **异常日志必须带异常对象**：全局异常处理与 HealthController 均将 `Exception` 作为第一个参数传入 `LogError`，以便保留完整堆栈。
- **结构化字段使用内插占位符**：日志消息使用 `{Method}`、`{Path}` 等占位符而非字符串拼接，确保结构化查询能力（遵循 Microsoft.Extensions.Logging 约定）。
- **不向客户端暴露内部错误细节**：全局异常处理先记日志再返回通用 `服务器内部错误` 响应，防止堆栈泄露。
- **无操作审计日志写入**：虽然存在 `OperationLog` 实体与相关 Repository/Service/Controller，但它们是持久化到数据库的“操作审计”数据，不属于运行期日志系统范畴；当前未见将审计事件同时写入日志流的逻辑。

总体而言，该项目是一个极简的日志方案：完全依赖 ASP.NET Core 内置 `ILogger`，通过配置文件控制级别，仅在关键路径（全局异常、健康检查失败）输出日志，没有自定义 sink、格式化器或链路追踪集成。