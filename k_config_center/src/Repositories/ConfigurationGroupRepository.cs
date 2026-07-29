using k_config_center.Entities;
using k_config_center.Models.Domain;
using SqlSugar;

namespace k_config_center.Repositories;

/// <summary>配置组数据访问：本模块所有数据库读写收口于此，对外只出入 ConfigurationGroupData 业务数据</summary>
public class ConfigurationGroupRepository(ISqlSugarClient database)
{
    /// <summary>配置组列表：命名空间/环境过滤均可选（文档端点表两参数并列），按创建时间排序。
    /// LeftJoin 命名空间/环境表带出冗余 key/名称（联表显式带 deleted_at 条件，不依赖全局过滤器在联表中的行为，关联不到为 null）</summary>
    public async Task<List<ConfigurationGroupData>> ListAsync(long? namespaceId, long? environmentId) =>
        (await database.Queryable<ConfigCenterConfigurationGroup>()
            .LeftJoin<ConfigCenterNamespace>((it, ns) => it.NamespaceId == ns.Id && ns.DeletedAt == null)
            .LeftJoin<ConfigCenterEnvironment>((it, ns, env) => it.EnvironmentId == env.Id && env.DeletedAt == null)
            .WhereIF(namespaceId != null, it => it.NamespaceId == namespaceId)
            .WhereIF(environmentId != null, it => it.EnvironmentId == environmentId)
            .OrderBy(it => it.CreatedAt)
            .Select((it, ns, env) => new { Entity = it, ns.NamespaceKey, ns.NamespaceName, env.EnvironmentKey, env.EnvironmentName }).ToListAsync())
        .Select(row => From(row.Entity) with
        {
            NamespaceKey = row.NamespaceKey, NamespaceName = row.NamespaceName,
            EnvironmentKey = row.EnvironmentKey, EnvironmentName = row.EnvironmentName
        }).ToList();

    /// <summary>按 id 查单条（已软删返回 null）</summary>
    public async Task<ConfigurationGroupData?> GetByIdAsync(long id)
    {
        var entity = await database.Queryable<ConfigCenterConfigurationGroup>().InSingleAsync(id);
        return entity == null ? null : From(entity);
    }

    /// <summary>环境下是否存在未删除的配置组：供环境删除前的级联检查</summary>
    public Task<bool> ExistsByEnvironmentIdAsync(long environmentId) =>
        database.Queryable<ConfigCenterConfigurationGroup>().AnyAsync(it => it.EnvironmentId == environmentId);

    /// <summary>插入：id 由数据库生成后回填；唯一冲突原样抛出，由 Service 转业务错误码</summary>
    public async Task<ConfigurationGroupData> InsertAsync(ConfigurationGroupData data)
    {
        var entity = To(data);
        var id = await database.Insertable(entity).ExecuteReturnBigIdentityAsync();
        return data with { Id = id };
    }

    /// <summary>更新名称/描述/状态：key 与所属环境不可改</summary>
    public Task UpdateAsync(long id, string groupName, string? description, short status, string? updatedBy) =>
        database.Updateable<ConfigCenterConfigurationGroup>()
            .SetColumns(it => new ConfigCenterConfigurationGroup
            { GroupName = groupName, Description = description, Status = status, UpdatedBy = updatedBy })
            .Where(it => it.Id == id).ExecuteCommandAsync();

    /// <summary>软删除：仅置 deleted_at</summary>
    public Task SoftDeleteAsync(long id) =>
        database.Updateable<ConfigCenterConfigurationGroup>()
            .SetColumns(it => new ConfigCenterConfigurationGroup { DeletedAt = DateTimeOffset.UtcNow })
            .Where(it => it.Id == id).ExecuteCommandAsync();

    /// <summary>实体 → 业务数据（实体不出本层）</summary>
    private static ConfigurationGroupData From(ConfigCenterConfigurationGroup entity) =>
        new(entity.Id, entity.NamespaceId, entity.EnvironmentId, entity.GroupKey, entity.GroupName,
            entity.Description, entity.Status, entity.CreatedBy, entity.UpdatedBy, entity.CreatedAt, entity.UpdatedAt);

    /// <summary>业务数据 → 实体（Id 不赋值：GENERATED ALWAYS 列由数据库生成）</summary>
    private static ConfigCenterConfigurationGroup To(ConfigurationGroupData data) => new()
    {
        NamespaceId = data.NamespaceId,
        EnvironmentId = data.EnvironmentId,
        GroupKey = data.GroupKey,
        GroupName = data.GroupName,
        Description = data.Description,
        Status = data.Status,
        CreatedBy = data.CreatedBy,
        UpdatedBy = data.UpdatedBy,
        CreatedAt = data.CreatedAt,
        UpdatedAt = data.UpdatedAt
    };
}
