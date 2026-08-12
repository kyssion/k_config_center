---
kind: dependency_management
name: 前后端双栈依赖管理（NuGet + npm）
category: dependency_management
scope:
    - '**'
source_files:
    - k_config_center/k_config_center.csproj
    - web/package.json
    - web/package-lock.json
    - .gitignore
---

## 1. 使用的系统/工具

本仓库为全栈项目，包含两个独立的后端与前端子工程，各自使用其生态的标准依赖管理方案：

- **后端（ASP.NET Core）**：使用 `.csproj` 中的 `<PackageReference>` 声明 NuGet 包，目标框架 `net10.0`，由 MSBuild / dotnet CLI 解析并还原。
- **前端（React + Vite）**：使用 `web/package.json` 声明 `dependencies` 与 `devDependencies`，并通过 `web/package-lock.json`（lockfileVersion 3）锁定精确版本；构建脚本通过 `vite build`、`tsc --noEmit` 触发安装与编译。

## 2. 关键文件

| 文件 | 作用 |
|---|---|
| `k_config_center/k_config_center.csproj` | 后端 NuGet 包清单，声明运行时依赖 |
| `web/package.json` | 前端 npm 包清单（含 scripts、依赖、开发依赖） |
| `web/package-lock.json` | npm 锁文件，锁定所有直接/间接依赖的精确版本与完整性校验哈希 |
| `.gitignore` | 忽略 `bin/`、`obj/`、`node_modules/`，不提交二进制产物与本地缓存 |

## 3. 架构与约定

### 后端 NuGet 依赖
- 仅声明 4 个顶层包：`Npgsql`、`SqlSugarCore`、`SQLitePCLRaw.lib.e_sqlite3`、`Swashbuckle.AspNetCore`。没有 `Directory.Packages.props` 等中央版本管理文件，版本号直接写在 `<PackageReference Include="..." Version="..." />` 中。
- 对 `SQLitePCLRaw.lib.e_sqlite3` 的引入是**显式覆盖传递依赖漏洞**：注释明确说明“顶替 SqlSugarCore 传递引用的漏洞版本 2.1.11（NU1903 / CVE-2025-6965），项目并不使用 SQLite”，属于安全补丁策略。
- 未启用 `CentralPackageManagement`，因此不存在集中式版本约束文件。

### 前端 npm 依赖
- 依赖范围清晰划分：运行期依赖（antd、axios、react、zustand 等）放入 `dependencies`，构建期依赖（typescript、vite、@types/*、@vitejs/plugin-react）放入 `devDependencies`。
- 所有版本均使用 `^` 前缀的语义化版本范围（如 `^18.3.1`、`^5.4.8`），允许小版本自动升级；具体落盘版本由 `package-lock.json` 锁定。
- `scripts.build` 先执行 `tsc --noEmit` 做类型检查，再执行 `vite build` 产出静态资源；`web/wwwroot` 下已存在构建产物（`assets/index-BJiDLSIW.js`、`index.html`），表明前端被打包后作为 ASP.NET Core 的静态内容托管。

### 私有源/镜像
- `package-lock.json` 中包的 `resolved` 字段指向 `https://registry.npmmirror.com/...`，说明当前环境使用了 **npm 镜像源（npmmirror）** 进行下载，但 `package.json` 中未配置 `.npmrc` 或 registry 字段，该镜像行为应来自全局 npm 配置而非仓库内配置。
- 后端未配置 `nuget.config`，默认使用 nuget.org 源。

## 4. 约定与约束

- **不提交构建产物与依赖缓存**：`.gitignore` 忽略 `bin/`、`obj/`、`node_modules/`，保证仓库只保留源码与声明式清单。
- **NuGet 包版本内联声明**：每个 `<PackageReference>` 都附带显式 `Version` 属性，无通配符；新增包需同时指定版本。
- **安全补丁优先于传递依赖**：对已知漏洞的传递依赖（CVE-2025-6965）采用显式覆盖方式修复，并在代码注释中记录原因，形成可审计的变更依据。
- **前端依赖范围严格区分**：生产依赖与开发依赖分属不同 section，避免将构建工具混入最终产物。
- **锁文件纳入版本控制**：`package-lock.json` 随仓库提交，确保跨机器/CI 构建的可重现性。
- **无 vendoring**：后端未使用 `packages/` 目录或 `dotnet pack` 产物；前端未使用 pnpm/yarn workspace 或 monorepo 结构，全部依赖通过包管理器在线还原。

## 5. 适用性说明

本仓库确实存在依赖管理实践，但规模较小、结构简单：后端仅 4 个 NuGet 包，前端仅 11 个直接依赖，且未引入私有 NuGet/NPM 源、未使用 Central Package Management 或 monorepo 工具链。因此该类别**适用**，但复杂度较低。