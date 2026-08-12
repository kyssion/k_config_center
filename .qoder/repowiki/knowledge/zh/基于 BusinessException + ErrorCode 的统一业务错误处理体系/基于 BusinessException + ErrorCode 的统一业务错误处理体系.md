---
kind: error_handling
name: 基于 BusinessException + ErrorCode 的统一业务错误处理体系
category: error_handling
scope:
    - '**'
source_files:
    - k_config_center/src/Infrastructure/BusinessException.cs
    - k_config_center/src/Infrastructure/ErrorCodes.cs
    - k_config_center/src/Infrastructure/ApiResponse.cs
    - k_config_center/src/Infrastructure/OperationHelper.cs
    - k_config_center/Program.cs
    - k_config_center/src/Services/NamespaceService.cs
    - k_config_center/src/Services/EnvironmentService.cs
    - k_config_center/src/Services/ConfigurationGroupService.cs
    - k_config_center/src/Services/ConfigurationService.cs
    - k_config_center/src/Services/ClientConfigurationService.cs
---

## 1. 采用的系统/方案

后端采用 **ASP.NET Core 自定义中间件 + 业务异常类型** 的错误处理方案：
- 所有业务错误通过抛出 `BusinessException`（携带 `ErrorCode` 枚举值）表达；
- 全局异常处理中间件在 `Program.cs` 中注册，捕获 `BusinessException` 后统一返回 `{ code, message, data: null }` 的 JSON 响应，HTTP 状态码仍为 200；
- 非业务异常（未预期异常）记录结构化日志后返回 HTTP 500 + `ErrorCode.InternalServerError(10000)`；
- 客户端断开（长轮询取消）引发的 `OperationCanceledException` 被静默忽略。

前端通过统一的 `ApiResponse` 结构解析 `code` 字段判断成功/失败，不依赖 HTTP 状态码区分业务结果。

## 2. 核心文件与位置

| 文件 | 职责 |
|---|---|
| `k_config_center/src/Infrastructure/BusinessException.cs` | 业务异常类型，封装 `Code` 和 `Message` |
| `k_config_center/src/Infrastructure/ErrorCodes.cs` | 错误码枚举，按分段约定定义全部业务错误码 |
| `k_config_center/src/Infrastructure/ApiResponse.cs` | 统一响应构造器 `Ok` / `Fail` |
| `k_config_center/src/Infrastructure/OperationHelper.cs` | 工具方法，含 PostgreSQL 唯一约束冲突识别 `IsUniqueViolation` |
| `k_config_center/Program.cs` | 全局异常处理中间件、Swagger 文档说明 |
| `k_config_center/src/Services/*Service.cs` | 各 Service 层抛错点（资源不存在、唯一冲突、级联删除等） |

## 3. 架构与约定

### 3.1 错误码分段约定
`ErrorCodes` 注释明确划分三段：
- `0`：成功
- `10000+`：通用错误（服务器内部错误、业务状态非法、资源不存在）
- `20000+`：基础维度错误（命名空间/环境/配置组的 key 冲突、级联删除冲突）
- `30000+`：配置与发布错误（配置 key 冲突、无未发布变更、回滚版本不存在、发布并发冲突）

新增错误码须按段追加，禁止修改既有码值。该约定同时出现在 Swagger 文档描述中，作为对外契约。

### 3.2 异常传播路径
1. Service 层遇到业务校验失败或数据库约束冲突时，抛出 `BusinessException`；
2. 数据库唯一约束冲突通过 `OperationHelper.IsUniqueViolation` 识别 `Npgsql.PostgresException { SqlState: "23505" }`，再转为对应 `ErrorCode` 的 `BusinessException`；
3. Controller 层仅负责参数绑定与调用 Service，不再自行包装错误；
4. 全局中间件捕获 `BusinessException`，写入 200 + `ApiResponse.Fail(code, message)`；
5. 未捕获异常记录日志并返回 500 + `InternalServerError`。

### 3.3 审计与操作人提取
`OperationHelper.GetOperator` 从请求头 `X-Operator` 读取操作人，缺省为 `system`；`GetClientIpAddress` 提取客户端 IP。这些值用于审计日志，与错误处理解耦但同属基础设施层。

## 4. 约定与约束

- **HTTP 一律 200**：业务失败不改变 HTTP 状态码，由 `code` 字段表达错误（见 `ApiResponse` 注释与全局中间件实现）。
- **禁止向客户端泄露堆栈**：非业务异常只返回固定消息 `服务器内部错误`，原始异常仅写入结构化日志（`app.Logger.LogError(exception, ...)`）。
- **数据库约束冲突必须转业务错误码**：Service 层捕获底层异常并通过 `OperationHelper.IsUniqueViolation` 判断后，抛出对应的 `*KeyConflict` 业务错误码，不得将数据库异常透传到上层。
- **新增错误码需按分段追加且不可改旧码**：`ErrorCodes` 类注释明确要求。
- **客户端断开静默处理**：`OperationCanceledException` 仅在 `context.RequestAborted.IsCancellationRequested` 时忽略，避免长轮询场景下产生噪音日志。
- **Swagger 文档同步契约**：错误码分段与统一响应结构在 `Program.cs` 的 SwaggerDoc 描述中声明，作为 API 契约的一部分。

## 5. 前端侧配合

前端 `web/src/api/http.ts` 及页面组件依据 `code === 0` 判定成功，否则根据 `message` 提示用户。由于后端 HTTP 始终 200，前端不依赖 HTTP 状态码做分支判断。

## 6. 覆盖范围

当前错误处理集中在后端 ASP.NET Core 服务。前端尚未发现集中式错误拦截器或全局错误边界，错误处理分散在各 API 调用处。