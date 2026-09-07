# AGENTS.md — k_config_center AI 开发指引

> 本文件是 AI 编码代理（ZCode / Claude Code / Codex 等）在本仓库工作的**必读约定**。
> 深入细节见 `docs/` 下的设计文档；本文回答"怎么改、怎么验、别踩什么坑"。

## 0. 开发总原则（优先级最高，与任何后续章节冲突时以本节为准）

1. **不过度设计**：只实现当前明确需要的功能，不为"将来可能"预留抽象与扩展点；能用直白方案解决的绝不绕弯。加任何一层抽象前先问：它今天消除了哪处真实重复？
2. **不过度封装**：间接层数越少越好。只有一个调用方、且看不到复用前景的方法/类/接口不要建；不为"隔离变化"而隔离——等变化真发生时再重构成本更低。不为了"规范"而强制接口 + 实现类、工厂、Builder 这类仪式性结构。
3. **可读性优先**：代码是写给下一个读的人的。命名达意、逻辑直线化、早返回少嵌套；注释解释"为什么"而不是复述代码。简洁直白 > 聪明炫技；读代码的人 5 秒内看不懂的写法，就换成看得懂的。
4. **兼顾性能最优**：数据库访问警惕 N+1（循环内查库）、无索引列过滤、重复查询与不必要全表扫描；列表接口一次查齐需要的数据；高频路径（客户端读取/长轮询）注意查询代价与连接占用；前端注意不必要的重渲染与重复请求。

判断尺度：一段代码如果需要"先看三层定义才能明白它做什么"，通常就是封装过度了；如果每次改动都要"改 N 个文件才能加一个小功能"，通常就是设计过度了。

## 1. 项目是什么

自研配置中心：集中管理应用配置，提供管理 Portal（React SPA）+ 管理/客户端 API（ASP.NET Core 单进程）。

核心领域模型（四级层级，均软删除）：

```
namespace（命名空间）→ environment（环境）→ configuration_group（配置组）→ configuration（配置项）
                                                    └─ configuration_version（发布版本快照，不可变）+ operation_log（审计）
```

配置状态机：`DRAFT → PUBLISHED → OFFLINE`；发布产生线性递增的不可变版本；回滚 = 用历史版本内容生成新版本。

## 2. 技术栈与环境要求

| 端 | 技术 | 版本 |
|----|------|------|
| 后端 | ASP.NET Core Web API（`net10.0`，单项目 `k_config_center/`） | SDK 10.x |
| ORM | SqlSugar（PostgreSQL，DbFirst 手工建表，**禁 CodeFirst**） | 5.1.4 |
| 数据库 | PostgreSQL（部分唯一索引 / JSONB / timestamptz） | 14+ |
| 前端 | React 18 + TypeScript + Tailwind CSS v4 + shadcn/ui + Vite（`web/`，独立 Node 工程，不进 .sln） | Node 18+ |

## 3. 常用命令（在仓库根执行）

| 目的 | 命令 |
|------|------|
| **改动后验证（必跑）** | `./scripts/check.sh` ＝ `dotnet build` + `dotnet format --verify-no-changes` + `dotnet test` + `cd web && npx tsc --noEmit` |
| 一键启动前后端 | `./scripts/dev.sh`（后端 :9000，前端 :9001，Ctrl+C 双杀） |
| 只起后端 | `cd k_config_center && dotnet run`（http://localhost:9000，Swagger 在 `/swagger`，仅 Development） |
| 只起前端 | `cd web && npm run dev`（http://localhost:9001，`/api` 代理到 :9000） |
| 生产构建 | `./scripts/build.sh`（前端产物 → `k_config_center/wwwroot/`，单一应用部署） |
| 初始化数据库 | `psql -U <user> -d k_config_center -f "docs/数据库脚本/配置中心建表脚本.sql"` |

首次准备：复制 `k_config_center/appsettings.Development.json.example` 为 `appsettings.Development.json` 并填入真实数据库连接（该文件含凭据，**已 gitignore，禁止提交**）。前端首次 `cd web && npm install`。

## 4. 目录地图

```
k_config_center.sln               # .NET 解决方案（仅后端）
k_config_center/                  # 后端 ASP.NET Core
  Program.cs                      # 全部 DI 注册 + 中间件管道（新增类必须来这里注册）
  src/
    Controllers/                  # 薄层：收参数 → 调 Service → 包 ApiResponse
    Services/                     # 业务逻辑全部在这里（按资源一类的模块拆分）
    Repositories/                 # 唯一允许注入 ISqlSugarClient、接触 Entities 的层
    Entities/                     # SqlSugar 实体（表映射，仅此层使用）
    Models/
      Domain/                     # record 业务数据（Repository 对外交换的数据形态）
      Requests/ Responses/        # API 入参 / 出参 DTO
    Infrastructure/               # ApiResponse、BusinessException、ErrorCode、SqlSugarSetup、事务 Runner、鉴权/校验/健康检查中间件
k_config_center.Tests/           # xUnit 测试工程（WebApplicationFactory 集成测试，不依赖真实数据库）
web/                              # 前端 React SPA
  src/
    api/                          # 按资源一个文件（http.ts 为 axios 封装，拦截器已解包 data）
    pages/<资源>/                  # 页面组件；layouts/MainLayout.tsx 外框
    components/ hooks/            # 通用组件 / hooks
    router/index.tsx              # 集中式路由表（新页面必须来这里注册）
docs/
  设计文档/配置中心设计文档.md      # 领域模型、ER、状态机、设计取舍（改领域逻辑前先读）
  技术方案/{项目整体架构设计,后端方案,前端方案}.md
  数据库脚本/配置中心建表脚本.sql   # 唯一 DDL 真源
scripts/                          # check.sh / dev.sh / build.sh
```

## 5. 后端铁律

1. **分层依赖只准向下**：Controller → Service → Repository。禁止：Controller 直接碰 Repository/ISqlSugarClient；Service 直接写 SQL/Queryable；Repository 写业务判断。
2. **数据形态三段换装**：Entity（表映射）↔ Domain record（`Models/Domain/`，Repository 出入口）↔ Response DTO（Controller 出口）。跨层不得泄漏 Entity。
3. **统一响应**：所有接口返回 `ApiResponse.Ok(data)`；业务失败抛 `BusinessException(ErrorCode.X, "中文消息")`，全局中间件转 `{ code, message, data: null }`，**HTTP 恒为 200**，错误由 code 表达。
4. **错误码分段**（`Infrastructure/ErrorCodes.cs`）：`0` 成功；`10000+` 通用；`20000+` 基础维度；`30000+` 配置与发布。新增按分段追加，**禁止修改既有码值**（码值即对外契约）。
5. **软删除**：只置 `deleted_at`；SqlSugarSetup 已注册全局过滤器自动排除已删记录，读已删数据需 `ClearFilter`。唯一性冲突检查只约束未删除记录。
6. **事务**：跨 Repository 写操作用 `DatabaseTransactionRunner.UseTranAsync` 包裹；Repository 不得自行 new SqlSugarClient（会脱离同一 Scope 导致事务失效）。
7. **操作审计**：所有写操作（建/改/发布/回滚/下线/删）必须落 `operation_log`，操作人取 `X-Operator` 请求头（Service 经 IHttpContextAccessor 读取，缺省 `system`）。
8. **XML 注释即文档**：每个 public 成员写中文 `///` 注释（Controller 上写清参数、返回、错误码场景）——它是 Swagger 文档的唯一来源；csproj 已压 1591 告警，**构建保持 0 警告**。
9. **改表流程**：先改 `docs/数据库脚本/配置中心建表脚本.sql`，再手工在库上执行，然后同步 Entities 映射。**禁用 CodeFirst 建表**。
10. 路由：统一 `api/` 前缀小写复数（如 `api/environments`）；管理端与客户端接口分控制器（后者只有 `ClientConfigurationController`：读取 + 长轮询）。

## 6. 前端铁律

1. **API 层**：新接口在 `web/src/api/<资源>.ts` 用 `request.get/post/put/delete` 封装；类型放 `api/types.ts`。拦截器已解包 `data` 并统一弹错，页面代码只处理成功路径。
2. **写操作带操作人**：非 GET 请求自动注入 `X-Operator`（localStorage `operator`，缺省 `portal`），无需页面手动处理。
3. **新页面**：组件放 `pages/<资源>/`，路由注册进 `router/index.tsx`；UI 用 shadcn/ui 组件（`components/ui/`，缺的按 shadcn 惯例新增）+ Tailwind 工具类，图标用 lucide-react，轻提示用 sonner 的 `toast`（文案本身中文，无 locale 配置）。
4. **构建即检查**：`npm run build` 含 `tsc --noEmit`，类型错误=构建失败，不得用 `any` 糊弄过去。
5. 路径别名 `@` → `web/src`（vite.config.ts 与 tsconfig paths 保持一致）。

## 7. 典型任务：新增一个资源模块（checklist）

以"新增 XXX 管理"为例，顺序：

1. `docs/数据库脚本/` 加表 DDL → 库上执行 → `Entities/ConfigCenterXxx.cs` 加映射（snake_case 列名显式标注）；
2. `Models/Domain/` 加 record；`Models/Requests/` `Models/Responses/` 加 DTO；
3. `Repositories/XxxRepository.cs` 数据访问（出入 Domain record）；有 `deleted_at` 的实体去 `SqlSugarSetup.cs` 注册过滤器；
4. `Services/XxxService.cs` 业务（校验、唯一冲突抛对应分段错误码、写操作落审计）；
5. `Controllers/XxxController.cs` 薄控制器（`api/xxxs` 路由 + XML 注释）；
6. **`Program.cs` 注册** `AddScoped<XxxRepository>()` 与 `AddScoped<XxxService>()`（新增类不会自动注册，漏了运行时才炸）；
7. 前端：`api/xxx.ts` + `api/types.ts` → `pages/xxx/` 页面 → `router/index.tsx` 注册 → `MainLayout.tsx` 加菜单；
8. 跑 `./scripts/check.sh`。

## 8. 验证回路（每次改动收尾必做）

```bash
./scripts/check.sh    # dotnet build（0 警告 0 错误）+ dotnet format 无差异 + dotnet test 全过 + tsc --noEmit
```

- 测试工程 `k_config_center.Tests/`（xUnit + WebApplicationFactory）：单元测试 + API 契约集成测试（统一响应、参数校验 10003、鉴权 10004、探针语义），测试宿主不连真实数据库；涉及接口行为改动时必须补对应测试。
- 涉及接口行为改动时，另启动 `./scripts/dev.sh` 用 Swagger（/swagger）实测。
- 前端验证：`npm run build` 通过 + 浏览器实测（:9001）。
- **提交前对照第 0 节自查**：本次改动有没有过度设计、过度封装？可读性是否打折？有没有引入 N+1 / 重复查询 / 不必要重渲染？
- 提交信息遵循 Conventional Commits，分支与提交流程见第 9 节。

## 9. Git 工作流与提交规范

### 9.1 分支

- `main`：默认主分支，始终可构建、`./scripts/check.sh` 全绿。
- 功能分支 `feat/<简述>`，修复分支 `fix/<简述>`，自 `main` 切出，合并后删除。

### 9.2 提交信息（Conventional Commits）

```
<type>(<scope>?): <中文描述>
```

| type | 用途 |
| ---- | ---- |
| feat | 新功能（跨模块的用 scope 标注，如 `feat(publish): …`、`feat(web): …`） |
| fix | 缺陷修复 |
| docs | 仅文档变更 |
| refactor | 重构（不改行为） |
| test | 仅测试变更（当前无测试工程，类型预留） |
| chore | 构建/工具/依赖变更 |

示例：

```
feat(client): 长轮询指纹查询不再取回配置内容
fix(web): 修复配置列表筛选时整表重渲染
chore(deps): 钉版 SQLitePCLRaw 修复 CVE-2025-6965
```

### 9.3 提交前自查清单

```
./scripts/check.sh    # dotnet build 0 警告 0 错误 + dotnet format 无格式差异 + dotnet test 全部通过 + tsc --noEmit
git status            # 无产物文件混入（bin/obj/node_modules/wwwroot/.idea 等）
```

文档同步：功能变更须同步更新 `docs/` 对应文档（变更类型 → 文档的对应关系见 [docs/README.md](docs/README.md#文档维护规则)）。

## 10. 陷阱清单

- **端口约定**：后端 9000（launchSettings http profile），前端 dev 9001；改端口需同步 vite.config.ts 代理目标。
- **探针端点不走统一契约**：`/health/live`、`/health/db` 按 HTTP 状态码表达（200/503），供编排器使用；业务接口才是"HTTP 恒 200 + code"。
- **API Key 鉴权**：`Auth:Enabled=true` 时所有 `/api` 请求须带 `X-Api-Key`（10004）；本地缺省关闭。前端在 Portal 顶栏配置。
- **record 校验特性必须放在构造参数上**（`[Required, StringLength(64)] string Key`），用 `[property:]` 指到属性会导致校验阶段抛异常（详见 ModelValidationFilter 注释）。
- `k_config_center/wwwroot/` 是前端构建产物，**已 gitignore，不要手工改**。
- `appsettings.Development.json` 不入库；仓库里只有 `.example` 模板。数据库连接串读 `ConnectionStrings:PostgreSQL`。
- vite build 输出目录在仓库根的 `k_config_center/wwwroot/`（注意是后端项目内，不是 web/ 内）。
- 发布/回滚有并发场景：版本号唯一约束冲突返回 30004；长轮询取消（OperationCanceledException）已被全局中间件静默处理，不要画蛇添足。
- 联表查询要显式带 `deleted_at IS NULL` 条件，不依赖全局过滤器在联表中的行为（既有 Repository 均如此）。

## 11. 更多背景文档

| 想了解 | 读 |
|--------|-----|
| 领域模型 / ER / 状态机 / 设计取舍 | `docs/设计文档/配置中心设计文档.md` |
| 后端分层细节 / API 清单 / 错误码 / 核心流程 | `docs/技术方案/后端方案.md` |
| 前端工程结构 / 页面设计 / 接口消费 | `docs/技术方案/前端方案.md` |
| 总体架构 / 部署形态 / 演进路线 | `docs/技术方案/项目整体架构设计.md` |
