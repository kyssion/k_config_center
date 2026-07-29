using k_config_center.Entities;
using k_config_center.Models.Domain;
using SqlSugar;

namespace k_config_center.Repositories;

/// <summary>环境数据访问：本模块所有数据库读写收口于此，对外只出入 EnvironmentData 业务数据</summary>
public class EnvironmentRepository(ISqlSugarClient database)
{
    /// <summary>环境列表：命名空间过滤可选（不传返回全部），先按 sort_order 再按创建时间排序（后端方案 7.2）。
    /// LeftJoin 命名空间表带出冗余 key/名称（联表显式带 deleted_at 条件，不依赖全局过滤器在联表中的行为，关联不到为 null）</summary>
    public async Task<List<EnvironmentData>> ListByNamespaceAsync(long? namespaceId) =>
        (await database.Queryable<ConfigCenterEnvironment>()
            .LeftJoin<ConfigCenterNamespace>((it, ns) => it.NamespaceId == ns.Id && ns.DeletedAt == null)
            .WhereIF(namespaceId != null, it => it.NamespaceId == namespaceId)
            .OrderBy(it => it.SortOrder).OrderBy(it => it.CreatedAt)
            .Select((it, ns) => new { Entity = it, ns.NamespaceKey, ns.NamespaceName }).ToListAsync())
        .Select(row => From(row.Entity) with { NamespaceKey = row.NamespaceKey, NamespaceName = row.NamespaceName }).ToList();

    /// <summary>按 id 查单条（已软删返回 null）</summary>
    public async Task<EnvironmentData?> GetByIdAsync(long id)
    {
        var entity = await database.Queryable<ConfigCenterEnvironment>().InSingleAsync(id);
        return entity == null ? null : From(entity);
    }

    /// <summary>命名空间下是否存在未删除的环境：供命名空间删除前的级联检查（跨模块由对方 Service 调本方法）</summary>
    public Task<bool> ExistsByNamespaceIdAsync(long namespaceId) =>
        database.Queryable<ConfigCenterEnvironment>().AnyAsync(it => it.NamespaceId == namespaceId);

    /// <summary>插入：id 由数据库生成后回填；唯一冲突原样抛出，由 Service 转业务错误码</summary>
    public async Task<EnvironmentData> InsertAsync(EnvironmentData data)
    {
        var entity = To(data);
        var id = await database.Insertable(entity).ExecuteReturnBigIdentityAsync();
        return data with { Id = id };
    }

    /// <summary>更新名称/描述/排序/状态：key 与所属命名空间不可改</summary>
    public Task UpdateAsync(long id, string environmentName, string? description, int sortOrder, short status) =>
        database.Updateable<ConfigCenterEnvironment>()
            .SetColumns(it => new ConfigCenterEnvironment
            { EnvironmentName = environmentName, Description = description, SortOrder = sortOrder, Status = status })
            .Where(it => it.Id == id).ExecuteCommandAsync();

    /// <summary>软删除：仅置 deleted_at</summary>
    public Task SoftDeleteAsync(long id) =>
        database.Updateable<ConfigCenterEnvironment>()
            .SetColumns(it => new ConfigCenterEnvironment { DeletedAt = DateTimeOffset.UtcNow })
            .Where(it => it.Id == id).ExecuteCommandAsync();

    /// <summary>实体 → 业务数据（实体不出本层）</summary>
    private static EnvironmentData From(ConfigCenterEnvironment entity) =>
        new(entity.Id, entity.NamespaceId, entity.EnvironmentKey, entity.EnvironmentName, entity.Description,
            entity.SortOrder, entity.Status, entity.CreatedAt, entity.UpdatedAt);

    /// <summary>业务数据 → 实体（Id 不赋值：GENERATED ALWAYS 列由数据库生成）</summary>
    private static ConfigCenterEnvironment To(EnvironmentData data) => new()
    {
        NamespaceId = data.NamespaceId,
        EnvironmentKey = data.EnvironmentKey,
        EnvironmentName = data.EnvironmentName,
        Description = data.Description,
        SortOrder = data.SortOrder,
        Status = data.Status,
        CreatedAt = data.CreatedAt,
        UpdatedAt = data.UpdatedAt
    };
}
