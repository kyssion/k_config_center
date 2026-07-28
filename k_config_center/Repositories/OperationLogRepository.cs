using System.Text.Json;
using k_config_center.Entities;
using k_config_center.Models.Domain;
using SqlSugar;

namespace k_config_center.Repositories;

/// <summary>操作日志数据访问：写入（各业务 Service 调用）与分页检索收口于此。
/// 日志只插入不修改、不设软删除；HttpRequest 等 Web 类型不进本层，操作人/客户端 IP 由 Service 提取后传入</summary>
public class OperationLogRepository(ISqlSugarClient database)
{
    /// <summary>写操作审计日志：detail 序列化为 JSONB 摘要。用原生 SQL 并对 jsonb 与可空 bigint 参数显式 CAST，
    /// 规避 null 参数被 Npgsql 推断为 text 的类型问题（42804）；在事务内调用则随事务同生共死</summary>
    public Task InsertAsync(string operation, object detail, string operatorName, string? clientIpAddress,
        long? namespaceId = null, long? environmentId = null, long? groupId = null, long? configurationId = null) =>
        database.Ado.ExecuteCommandAsync(
            "INSERT INTO config_center_operation_log (namespace_id, environment_id, group_id, configuration_id, operation, detail, operator, client_ip_address) " +
            "VALUES (CAST(@namespaceId AS bigint), CAST(@environmentId AS bigint), CAST(@groupId AS bigint), CAST(@configurationId AS bigint), @operation, CAST(@detail AS jsonb), @operator, @clientIpAddress)",
            new
            {
                namespaceId, environmentId, groupId, configurationId, operation,
                detail = JsonSerializer.Serialize(detail),
                @operator = operatorName,
                clientIpAddress
            });

    /// <summary>日志分页检索：各过滤条件均可选，时间区间为闭开区间 [startTime, endTime)，按时间倒序</summary>
    public async Task<(List<OperationLogData> Items, int Total)> ListPageAsync(
        long? namespaceId, long? environmentId, long? groupId, long? configurationId,
        string? operation, DateTimeOffset? startTime, DateTimeOffset? endTime, int pageIndex, int pageSize)
    {
        RefAsync<int> total = 0;
        var entities = await database.Queryable<ConfigCenterOperationLog>()
            .WhereIF(namespaceId != null, it => it.NamespaceId == namespaceId)
            .WhereIF(environmentId != null, it => it.EnvironmentId == environmentId)
            .WhereIF(groupId != null, it => it.GroupId == groupId)
            .WhereIF(configurationId != null, it => it.ConfigurationId == configurationId)
            .WhereIF(!string.IsNullOrEmpty(operation), it => it.Operation == operation)
            .WhereIF(startTime != null, it => it.CreatedAt >= startTime)
            .WhereIF(endTime != null, it => it.CreatedAt < endTime)
            .OrderByDescending(it => it.CreatedAt)
            .ToPageListAsync(pageIndex, pageSize, total);
        return (entities.Select(From).ToList(), total);
    }

    /// <summary>实体 → 业务数据（实体不出本层）</summary>
    private static OperationLogData From(ConfigCenterOperationLog entity) =>
        new(entity.Id, entity.NamespaceId, entity.EnvironmentId, entity.GroupId, entity.ConfigurationId,
            entity.Operation, entity.Detail, entity.Operator, entity.ClientIpAddress, entity.CreatedAt);
}
