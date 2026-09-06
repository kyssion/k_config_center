# k_config_center 配置中心

自研配置中心：集中管理应用配置，替代散落各应用的配置文件与手工改库。提供管理 Portal 与客户端读取 API,单进程部署。

- **层级模型**:namespace → environment → configuration_group → configuration,配置发布产生不可变版本快照,支持回滚与全量操作审计
- **后端**:ASP.NET Core(.NET 10)+ SqlSugar + PostgreSQL 14+,统一响应 `{ code, message, data }`
- **前端**:React 18 + TypeScript + Ant Design 5 + Vite,构建产物由后端 `wwwroot/` 托管,单一应用部署

详细文档见 [docs/](docs/) 目录([整体架构](docs/技术方案/项目整体架构设计.md) / [后端方案](docs/技术方案/后端方案.md) / [前端方案](docs/技术方案/前端方案.md) / [设计文档](docs/设计文档/配置中心设计文档.md))。

## 快速开始

环境要求:.NET 10 SDK、Node 18+、PostgreSQL 14+。

```bash
# 1. 初始化数据库(执行 docs/数据库脚本/配置中心建表脚本.sql)
psql -U <user> -d k_config_center -f "docs/数据库脚本/配置中心建表脚本.sql"

# 2. 准备本地配置(该文件不入库)
cp k_config_center/appsettings.Development.json.example k_config_center/appsettings.Development.json
# 编辑填入真实 PostgreSQL 连接串

# 3. 一键启动(后端 http://localhost:9000,前端 http://localhost:9001)
./scripts/dev.sh
```

开发期访问 http://localhost:9001(Portal)或 http://localhost:9000/swagger(接口文档,仅开发环境)。

## 常用命令

| 命令 | 作用 |
|------|------|
| `./scripts/dev.sh` | 同时启动前后端开发进程 |
| `./scripts/check.sh` | 验证:后端 dotnet build + 前端 tsc 类型检查 |
| `./scripts/build.sh` | 生产构建(前端产物 → 后端 wwwroot/,单应用部署形态) |

## AI 协作开发

本仓库为 AI 编码代理准备了 [AGENTS.md](AGENTS.md):包含架构分层铁律、代码约定、新增模块 checklist 与验证回路,AI(或新成员)开发前请先阅读。
