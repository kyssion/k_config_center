using System.Net;
using k_config_center.Infrastructure;
using k_config_center.Repositories;
using k_config_center.Services;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi;

namespace k_config_center;

public partial class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // Add services to the container.
        // 关闭 ApiController 的自动 400（ProblemDetails 响应）：校验失败统一走 ModelValidationFilter
        // 转 BusinessException(10003)，保持 { code, message, data } 契约、HTTP 恒 200（后端方案 7.1）
        builder.Services.Configure<ApiBehaviorOptions>(options => options.SuppressModelStateInvalidFilter = true);
        builder.Services.AddControllers(options => options.Filters.Add<ModelValidationFilter>());
        builder.Services.AddSqlSugarSetup(builder.Configuration);
        // Service 层通过 IHttpContextAccessor 获取当前请求（操作人/客户端 IP 提取）
        builder.Services.AddHttpContextAccessor();
        // 操作人上下文：每请求作用域从 HttpContext 提取一次，业务层只依赖这两个值，不耦合 Web 类型
        builder.Services.AddScoped<OperatorContext>(serviceProvider =>
        {
            var httpContext = serviceProvider.GetRequiredService<IHttpContextAccessor>().HttpContext;
            return httpContext == null
                ? new OperatorContext("system", null)
                : new OperatorContext(OperationHelper.GetOperator(httpContext.Request), OperationHelper.GetClientIpAddress(httpContext.Request));
        });
        // 数据访问层：唯一允许注入 ISqlSugarClient 与接触 Entities 的一层，按模块划分
        builder.Services.AddScoped<NamespaceRepository>();
        builder.Services.AddScoped<EnvironmentRepository>();
        builder.Services.AddScoped<ConfigurationGroupRepository>();
        builder.Services.AddScoped<ConfigurationRepository>();
        builder.Services.AddScoped<ConfigurationVersionRepository>();
        builder.Services.AddScoped<OperationLogRepository>();
        builder.Services.AddScoped<DatabaseTransactionRunner>();
        // 业务层：按模块严格拆分，一个 Service 只管一种资源
        builder.Services.AddScoped<NamespaceService>();
        builder.Services.AddScoped<EnvironmentService>();
        builder.Services.AddScoped<ConfigurationGroupService>();
        builder.Services.AddScoped<ConfigurationService>();
        builder.Services.AddScoped<PublishService>();
        builder.Services.AddScoped<ClientConfigurationService>();
        builder.Services.AddScoped<OperationLogService>();
        // 健康检查：/health/db 做真实数据库连接探测（失败 503，供编排器探针使用）
        builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");

        // Swagger（Swashbuckle）：接口文档由各 Controller / Models 的 XML 注释生成，仅开发/测试环境启用 UI
        builder.Services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "配置中心 API",
                Version = "v1",
                Description = """
                    配置中心后端接口（管理端 + 客户端读取）。

                    统一响应结构：{ code, message, data }，业务失败时 HTTP 仍返 200，错误由 code 表达（data 为 null）。

                    错误码分段（后端方案 7.1）：
                    - 0：成功
                    - 10000+：通用（10000 服务器内部错误、10001 业务状态非法、10002 资源不存在、10003 参数校验失败、10004 未授权）
                    - 20000+：基础维度（20001/20002/20003 三级 key 冲突、20004 存在未删除下级资源拒绝删除）
                    - 30000+：配置与发布（30001 配置 key 冲突、30002 无未发布变更、30003 回滚版本不存在、30004 发布并发冲突）
                    """
            });
            // 读取编译生成的 XML 注释文件（csproj 已开 GenerateDocumentationFile）
            options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, "k_config_center.xml"), includeControllerXmlComments: true);
            // 为所有操作补充 X-Api-Key、为写操作补充 X-Operator 请求头说明
            options.OperationFilter<SwaggerOperatorHeaderFilter>();
        });

        var app = builder.Build();

        // Configure the HTTP request pipeline.
        // 反向代理适配：优先采用 X-Forwarded-For / X-Forwarded-Proto（否则经 Nginx/网关转发后审计 IP 全是代理 IP）。
        // 默认只信任回环代理；上游代理不在本机时，在配置 ForwardedHeaders:KnownProxies（IP 数组）中登记
        var forwardedHeadersOptions = new ForwardedHeadersOptions
        {
            ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
        };
        foreach (var proxy in builder.Configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? [])
            forwardedHeadersOptions.KnownProxies.Add(IPAddress.Parse(proxy));
        app.UseForwardedHeaders(forwardedHeadersOptions);

        if (app.Environment.IsProduction())
        {
            // 生产启用 HSTS（HTTPS 强制），配合 UseHttpsRedirection
            app.UseHsts();
        }

        if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Testing"))
        {
            // Swagger UI 仅开发/测试环境暴露（生产不开），默认路径 /swagger
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        // 全局异常处理：BusinessException 统一转 { code, message, data: null }（HTTP 200，错误由 code 表达，后端方案 7.1）；
        // 客户端断开（长轮询取消）静默结束；其余异常按 10000 服务器内部错误返回，避免泄漏堆栈
        app.Use(async (context, next) =>
        {
            try { await next(); }
            catch (BusinessException exception)
            {
                context.Response.StatusCode = StatusCodes.Status200OK;
                await context.Response.WriteAsJsonAsync(ApiResponse.Fail(exception.Code, exception.Message));
            }
            catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
            {
                // 客户端已断开，无需写响应
            }
            catch (Exception exception)
            {
                // 非业务异常：先记结构化日志（含异常栈）便于排查，再返回统一 500 响应，不把内部细节透给客户端
                app.Logger.LogError(exception, "未处理异常：{Method} {Path}", context.Request.Method, context.Request.Path);
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                await context.Response.WriteAsJsonAsync(ApiResponse.Fail(ErrorCode.InternalServerError, "服务器内部错误"));
            }
        });

        // API Key 鉴权：Auth:Enabled=true 时所有 /api 请求须带一致的 X-Api-Key（缺省关闭，本地开发零负担）
        app.UseMiddleware<ApiKeyMiddleware>();

        app.UseHttpsRedirection();

        // 托管 wwwroot 下的前端构建产物；Vite 产物文件名带内容 hash 可长缓存，index.html 必须每次取最新
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = fileContext =>
            {
                if (!fileContext.File.Name.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
                    fileContext.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            }
        });

        // 探针健康检查（不走统一契约，按 HTTP 状态码表达）：
        // /health/live 仅确认进程存活；/health/db 含真实数据库连接检查，失败返回 503 让编排器摘流量
        app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
        app.MapHealthChecks("/health/db", new HealthCheckOptions());

        app.MapControllers();

        // /api 前缀不参与 SPA 兜底：未知 API 路径返回 404，避免 SDK/客户端把 index.html 当成功响应解析
        app.MapFallback("/api/{*path}", () => Results.NotFound());

        // 前端 SPA 路由兜底，直接访问前端路由时回落 index.html 由 react-router 接管
        app.MapFallbackToFile("index.html");

        app.Run();
    }
}

/// <summary>供 WebApplicationFactory 集成测试挂载入口（测试工程通过 partial 访问 Program）</summary>
/// <summary>供 WebApplicationFactory 集成测试挂载入口（测试工程通过 partial 访问 Program）</summary>
public partial class Program { }
