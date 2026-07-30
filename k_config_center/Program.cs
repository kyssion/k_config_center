using k_config_center.Infrastructure;
using k_config_center.Repositories;
using k_config_center.Services;
using Microsoft.OpenApi;

namespace k_config_center;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // Add services to the container.
        builder.Services.AddControllers();
        builder.Services.AddSqlSugarSetup(builder.Configuration);
        // Service 层通过 IHttpContextAccessor 获取当前请求（操作人/客户端 IP 提取）
        builder.Services.AddHttpContextAccessor();
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

        // Swagger（Swashbuckle）：接口文档由各 Controller / Models 的 XML 注释生成，仅 Development 环境启用 UI
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
                    - 10000+：通用（10000 服务器内部错误、10001 参数校验失败、10002 资源不存在）
                    - 20000+：基础维度（20001/20002/20003 三级 key 冲突、20004 存在未删除下级资源拒绝删除）
                    - 30000+：配置与发布（30001 配置 key 冲突、30002 无未发布变更、30003 回滚版本不存在、30004 发布并发冲突）
                    """
            });
            // 读取编译生成的 XML 注释文件（csproj 已开 GenerateDocumentationFile）
            options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, "k_config_center.xml"), includeControllerXmlComments: true);
            // 为所有写操作补充 X-Operator 请求头说明
            options.OperationFilter<SwaggerOperatorHeaderFilter>();
        });

        var app = builder.Build();

        // Configure the HTTP request pipeline.
        if (app.Environment.IsDevelopment())
        {
            // Swagger UI 仅开发环境暴露（生产不开），默认路径 /swagger
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

        app.UseHttpsRedirection();

        // 托管 wwwroot 下的前端构建产物
        app.UseStaticFiles();

        app.MapControllers();

        // /api 前缀不参与 SPA 兜底：未知 API 路径返回 404，避免 SDK/客户端把 index.html 当成功响应解析
        app.MapFallback("/api/{*path}", () => Results.NotFound());

        // 前端 SPA 路由兜底，直接访问前端路由时回落 index.html 由 react-router 接管
        app.MapFallbackToFile("index.html");

        app.Run();
    }
}
