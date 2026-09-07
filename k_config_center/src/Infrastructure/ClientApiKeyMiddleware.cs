using System.Security.Cryptography;
using System.Text;

namespace k_config_center.Infrastructure;

/// <summary>客户端读取接口的 API Key 认证（可选启用）：配置 ClientAuth:ApiKey 为非空值后，
/// /api/client/* 请求必须携带取值一致的 X-Api-Key 请求头；未配置时保持开放（开发环境零配置可用）。
/// 固定时间比较防时序侧信道；失败返回 HTTP 401 + 统一响应体（code=10004，复用管理端未授权码）。
/// 说明：认证失败属于协议层拒绝而非业务失败，故不走「业务错误 HTTP 200」约定</summary>
public sealed class ClientApiKeyMiddleware(RequestDelegate next)
{
    private const string HeaderName = "X-Api-Key";

    public async Task InvokeAsync(HttpContext context, IConfiguration configuration)
    {
        var expected = configuration["ClientAuth:ApiKey"];
        if (!string.IsNullOrEmpty(expected) && context.Request.Path.StartsWithSegments("/api/client"))
        {
            var provided = context.Request.Headers[HeaderName].ToString();
            if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(provided), Encoding.UTF8.GetBytes(expected)))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(
                    ApiResponse.Fail(ErrorCode.Unauthorized, "客户端认证失败：X-Api-Key 请求头缺失或不正确"));
                return;
            }
        }
        await next(context);
    }
}
