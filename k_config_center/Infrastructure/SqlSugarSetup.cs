using k_config_center.Entities;
using SqlSugar;

namespace k_config_center.Infrastructure;

/// <summary>
/// SqlSugar 客户端注册：PostgreSQL 连接、实体特性解析、全局软删除过滤器。
/// 实体仅做映射（DbFirst），禁用 CodeFirst 建表，DDL 由建表脚本手工执行。
/// </summary>
public static class SqlSugarSetup
{
    public static IServiceCollection AddSqlSugarSetup(this IServiceCollection services, IConfiguration configuration)
    {
        // 防御性约定：所有 Repository 必须经 DI 注入这里注册的同一个 SqlSugarScope 单例，
        // 不得自行 new SqlSugarClient——否则跨 Repository 的环境事务（DatabaseTransactionRunner.UseTranAsync）会失效
        services.AddSingleton<ISqlSugarClient>(serviceProvider =>
        {
            var connectionString = configuration.GetConnectionString("PostgreSQL")
                ?? throw new InvalidOperationException("缺少连接字符串配置 ConnectionStrings:PostgreSQL");

            var client = new SqlSugarScope(new ConnectionConfig
            {
                DbType = DbType.PostgreSQL,
                ConnectionString = connectionString,
                IsAutoCloseConnection = true,
                InitKeyType = InitKeyType.Attribute   // 按实体特性解析表名/列名/主键/自增（PascalCase 属性经 ColumnName 显式映射 snake_case 列）
            },
            database =>
            {
                // 全局软删除过滤器：含 DeletedAt 的实体默认过滤 deleted_at IS NULL，
                // 需要读取已删除记录的场景（如审计回溯）用 ClearFilter 临时绕过。
                database.QueryFilter.AddTableFilter<ConfigCenterNamespace>(it => it.DeletedAt == null);
                database.QueryFilter.AddTableFilter<ConfigCenterEnvironment>(it => it.DeletedAt == null);
                database.QueryFilter.AddTableFilter<ConfigCenterConfigurationGroup>(it => it.DeletedAt == null);
                database.QueryFilter.AddTableFilter<ConfigCenterConfiguration>(it => it.DeletedAt == null);
            });
            return client;
        });
        return services;
    }
}
