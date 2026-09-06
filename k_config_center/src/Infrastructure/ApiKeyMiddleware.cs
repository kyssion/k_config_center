namespace k_config_center.Infrastructure;

/// <summary>API Key 鉴权中间件（阶段一最小鉴权）：服务端配置 Auth:Enabled=true 后，
/// 所有 /api 前缀请求必须携带与 Auth:ApiKey 一致的 X-Api-Key 请求头，否则返回统一契约的 10004。
/// /health 前缀探针端点豁免（编排器不带 key）；未启用时直接放行，本地开发零负担</summary>
public class ApiKeyMiddleware(RequestDelegate next)
{
    /// <summary>逐请求读取配置而非构造时快照：集成测试可在工厂里按用例覆盖配置</summary>
    public async Task InvokeAsync(HttpContext context)
    {
        var configuration = context.RequestServices.GetRequiredService<IConfiguration>();
        if (!bool.TryParse(configuration["Auth:Enabled"], out var enabled) || !enabled)
        {
            await next(context);
            return;
        }
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            var expectedKey = configuration["Auth:ApiKey"];
            if (string.IsNullOrWhiteSpace(expectedKey) || context.Request.Headers["X-Api-Key"].ToString() != expectedKey)
            {
                context.Response.StatusCode = StatusCodes.Status200OK;
                await context.Response.WriteAsJsonAsync(ApiResponse.Fail(ErrorCode.Unauthorized, "未授权：X-Api-Key 缺失或无效"));
                return;
            }
        }
        await next(context);
    }
}
