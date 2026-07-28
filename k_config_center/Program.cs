using k_config_center.Infrastructure;
using k_config_center.Repositories;
using k_config_center.Services;

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

        // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
        builder.Services.AddOpenApi();

        var app = builder.Build();

        // Configure the HTTP request pipeline.
        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
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
                await context.Response.WriteAsJsonAsync(ApiResponse.Fail(10000, "服务器内部错误"));
            }
        });

        app.UseHttpsRedirection();

        app.MapControllers();

        app.Run();
    }
}
