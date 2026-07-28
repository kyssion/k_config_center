using System.Security.Cryptography;
using System.Text;

namespace k_config_center.Infrastructure;

/// <summary>公共小工具：md5 计算、操作人/客户端 IP 提取、唯一冲突识别。
/// 审计日志的数据库写入已收口到 OperationLogRepository，本类不再接触数据库</summary>
public static class OperationHelper
{
    /// <summary>计算配置内容的 32 位小写 MD5（一律服务端计算，不信任前端传值）</summary>
    public static string ComputeMd5(string? content) =>
        Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(content ?? string.Empty))).ToLowerInvariant();

    /// <summary>操作人：阶段一无用户体系，从请求头 X-Operator 取，缺省 system</summary>
    public static string GetOperator(HttpRequest request) =>
        string.IsNullOrWhiteSpace(request.Headers["X-Operator"]) ? "system" : request.Headers["X-Operator"].ToString();

    /// <summary>客户端 IP：供审计日志记录来源（HttpRequest 是 Web 层类型，在 Service 层提取后以字符串传给 Repository）</summary>
    public static string? GetClientIpAddress(HttpRequest request) =>
        request.HttpContext.Connection.RemoteIpAddress?.ToString();

    /// <summary>识别 PostgreSQL 唯一约束冲突（SQLSTATE 23505），供各创建/发布接口转业务错误码</summary>
    public static bool IsUniqueViolation(Exception exception)
    {
        for (var current = exception; current != null; current = current.InnerException)
            if (current is Npgsql.PostgresException { SqlState: "23505" }) return true;
        return exception.Message.Contains("23505");
    }
}
