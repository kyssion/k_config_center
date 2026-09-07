# syntax=docker/dockerfile:1
# k_config_center 镜像构建：多阶段构建
# 1) node 阶段构建前端，产物按 vite.config.ts 约定输出到 k_config_center/wwwroot
# 2) dotnet sdk 阶段发布后端（wwwroot 静态资源随发布产物内嵌）
# 3) aspnet 运行时镜像，仅包含发布产物
#
# 构建（在仓库根目录执行）：docker build -t k_config_center:latest .
# 运行（连接字符串经环境变量注入，覆盖 appsettings.json 中的占位符）：
#   docker run -d --name k_config_center -p 8080:8080 \
#     -e ConnectionStrings__PostgreSQL="Host=<host>;Port=5432;Database=k_config_center;Username=<user>;Password=<pwd>" \
#     k_config_center:latest

# ---------- 阶段 1：前端构建 ----------
FROM node:22-alpine AS web-build
WORKDIR /build/web
# 先只拷贝依赖清单，利用层缓存加速后续构建
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ .
# vite build（含 tsc --noEmit 类型检查），emptyOutDir 会清空输出目录
RUN npm run build

# ---------- 阶段 2：后端发布 ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src
COPY k_config_center/k_config_center.csproj k_config_center/
RUN dotnet restore k_config_center/k_config_center.csproj
COPY k_config_center/ k_config_center/
# 用前端阶段的构建产物覆盖源码中自带的旧 wwwroot，保证镜像内是最新前端
COPY --from=web-build /build/k_config_center/wwwroot/ k_config_center/wwwroot/
RUN dotnet publish k_config_center/k_config_center.csproj -c Release -o /app/publish

# ---------- 阶段 3：运行时 ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=api-build /app/publish .
# 容器内统一监听 8080（.NET 8+ 容器默认端口）；对外端口映射由 -p 决定
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production
# 以镜像内置的非 root 用户运行（UID 1654），应用不写磁盘、8080 为非特权端口，无需额外权限
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "k_config_center.dll"]
