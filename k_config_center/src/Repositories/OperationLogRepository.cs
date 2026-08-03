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

    /// <summary>日志分页检索：各过滤条件均可选（操作人为模糊匹配），时间区间为闭开区间 [startTime, endTime)，按时间倒序。
    /// 分页后做维度回填：历史日志可能只记了下级维度 id（如仅 group_id），
    /// 由配置项 → 配置组 → 环境逐级反推补全上级 id，再批量带出各维度 key/名称供展示；
    /// 维度查询 ClearFilter 绕过全局软删过滤器（审计需回溯已删除资源，见 SqlSugarSetup 约定），关联不到为 null</summary>
    public async Task<(List<OperationLogData> Items, int Total)> ListPageAsync(
        long? namespaceId, long? environmentId, long? groupId, long? configurationId,
        string? operation, string? operatorName, DateTimeOffset? startTime, DateTimeOffset? endTime, int pageIndex, int pageSize)
    {
        RefAsync<int> total = 0;
        var logs = await database.Queryable<ConfigCenterOperationLog>()
            .WhereIF(namespaceId != null, it => it.NamespaceId == namespaceId)
            .WhereIF(environmentId != null, it => it.EnvironmentId == environmentId)
            .WhereIF(groupId != null, it => it.GroupId == groupId)
            .WhereIF(configurationId != null, it => it.ConfigurationId == configurationId)
            .WhereIF(!string.IsNullOrEmpty(operation), it => it.Operation == operation)
            .WhereIF(!string.IsNullOrWhiteSpace(operatorName), it => it.Operator!.Contains(operatorName!))
            .WhereIF(startTime != null, it => it.CreatedAt >= startTime)
            .WhereIF(endTime != null, it => it.CreatedAt < endTime)
            .OrderByDescending(it => it.CreatedAt)
            .ToPageListAsync(pageIndex, pageSize, total);

        // 维度回填：自下而上逐级补齐上级 id（回填顺序不可倒置：上一级补齐后才能取到再上一级的 id）
        var configurationById = await LoadByIdsAsync<ConfigCenterConfiguration>(CollectIds(logs.Select(it => it.ConfigurationId)), it => it.Id);
        foreach (var log in logs)
            if (log.ConfigurationId != null && configurationById.TryGetValue(log.ConfigurationId.Value, out var configuration))
            {
                log.GroupId ??= configuration.GroupId;
                log.EnvironmentId ??= configuration.EnvironmentId;
                log.NamespaceId ??= configuration.NamespaceId;
            }
        var groupById = await LoadByIdsAsync<ConfigCenterConfigurationGroup>(CollectIds(logs.Select(it => it.GroupId)), it => it.Id);
        foreach (var log in logs)
            if (log.GroupId != null && groupById.TryGetValue(log.GroupId.Value, out var group))
            {
                log.EnvironmentId ??= group.EnvironmentId;
                log.NamespaceId ??= group.NamespaceId;
            }
        var environmentById = await LoadByIdsAsync<ConfigCenterEnvironment>(CollectIds(logs.Select(it => it.EnvironmentId)), it => it.Id);
        foreach (var log in logs)
            if (log.EnvironmentId != null && environmentById.TryGetValue(log.EnvironmentId.Value, out var environment))
                log.NamespaceId ??= environment.NamespaceId;
        var namespaceById = await LoadByIdsAsync<ConfigCenterNamespace>(CollectIds(logs.Select(it => it.NamespaceId)), it => it.Id);

        return (logs.Select(log =>
        {
            var ns = log.NamespaceId == null ? null : namespaceById.GetValueOrDefault(log.NamespaceId.Value);
            var environment = log.EnvironmentId == null ? null : environmentById.GetValueOrDefault(log.EnvironmentId.Value);
            var group = log.GroupId == null ? null : groupById.GetValueOrDefault(log.GroupId.Value);
            var configuration = log.ConfigurationId == null ? null : configurationById.GetValueOrDefault(log.ConfigurationId.Value);
            return From(log) with
            {
                NamespaceKey = ns?.NamespaceKey, NamespaceName = ns?.NamespaceName,
                EnvironmentKey = environment?.EnvironmentKey, EnvironmentName = environment?.EnvironmentName,
                GroupKey = group?.GroupKey, GroupName = group?.GroupName,
                ConfigurationKey = configuration?.ConfigurationKey
            };
        }).ToList(), total);
    }

    /// <summary>收集非空维度 id 并去重，供批量回查</summary>
    private static List<long> CollectIds(IEnumerable<long?> source) =>
        source.Where(it => it != null).Select(it => it!.Value).Distinct().ToList();

    /// <summary>按主键批量加载维度记录（ClearFilter 含已软删），空 id 集合不发请求</summary>
    private async Task<Dictionary<long, TEntity>> LoadByIdsAsync<TEntity>(List<long> ids, Func<TEntity, long> idSelector) where TEntity : class, new()
    {
        if (ids.Count == 0) return [];
        var rows = await database.Queryable<TEntity>().ClearFilter().In(ids).ToListAsync();
        return rows.ToDictionary(idSelector);
    }

    /// <summary>实体 → 业务数据（实体不出本层）</summary>
    private static OperationLogData From(ConfigCenterOperationLog entity) =>
        new(entity.Id, entity.NamespaceId, entity.EnvironmentId, entity.GroupId, entity.ConfigurationId,
            entity.Operation, entity.Detail, entity.Operator, entity.ClientIpAddress, entity.CreatedAt);
}
