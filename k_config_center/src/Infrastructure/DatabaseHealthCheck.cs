using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace k_config_center.Infrastructure;

/// <summary>数据库健康检查：对 PostgreSQL 建立一次真实连接，供 /health/db 探针端点使用。
/// 连接失败抛出异常由 HealthCheck 框架判为 Unhealthy → HTTP 503，让编排器正确摘除/重启实例
/// （区别于业务健康接口：业务侧错误在响应体 code 里表达，探针只认 HTTP 状态码）</summary>
public class DatabaseHealthCheck(IConfiguration configuration) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var connectionString = configuration.GetConnectionString("PostgreSQL")
            ?? throw new InvalidOperationException("缺少连接字符串配置 ConnectionStrings:PostgreSQL");
        // 故意不用 DI 里的 ISqlSugarClient：健康检查要在 ORM 之外独立验证数据库可达性
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        return HealthCheckResult.Healthy("PostgreSQL 连接正常");
    }
}
