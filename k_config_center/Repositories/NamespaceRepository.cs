using k_config_center.Entities;
using k_config_center.Models.Domain;
using SqlSugar;

namespace k_config_center.Repositories;

/// <summary>命名空间数据访问：本模块所有数据库读写收口于此，对外只出入 NamespaceData 业务数据。
/// 读查询走全局软删过滤器（deleted_at IS NULL）；Updateable 不走过滤器，存在性校验由 Service 先经查询完成</summary>
public class NamespaceRepository(ISqlSugarClient database)
{
    /// <summary>命名空间总数：供健康检查做轻量连通性验证</summary>
    public Task<int> CountAsync() =>
        database.Queryable<ConfigCenterNamespace>().CountAsync();

    /// <summary>全部命名空间，按创建时间排序</summary>
    public async Task<List<NamespaceData>> ListAsync() =>
        (await database.Queryable<ConfigCenterNamespace>().OrderBy(it => it.CreatedAt).ToListAsync())
        .Select(From).ToList();

    /// <summary>按 id 查单条（已软删返回 null）</summary>
    public async Task<NamespaceData?> GetByIdAsync(long id)
    {
        var entity = await database.Queryable<ConfigCenterNamespace>().InSingleAsync(id);
        return entity == null ? null : From(entity);
    }

    /// <summary>插入：id 列为 GENERATED ALWAYS，不显式插入，由数据库生成后回填到返回值；
    /// namespace_key 撞部分唯一索引时原样抛出，由 Service 转业务错误码</summary>
    public async Task<NamespaceData> InsertAsync(NamespaceData data)
    {
        var entity = To(data);
        var id = await database.Insertable(entity).ExecuteReturnBigIdentityAsync();
        return data with { Id = id };
    }

    /// <summary>更新名称/描述/状态：key 不可改；updated_at 由数据库触发器维护，不在应用层赋值</summary>
    public Task UpdateAsync(long id, string namespaceName, string? description, short status, string? updatedBy) =>
        database.Updateable<ConfigCenterNamespace>()
            .SetColumns(it => new ConfigCenterNamespace
            { NamespaceName = namespaceName, Description = description, Status = status, UpdatedBy = updatedBy })
            .Where(it => it.Id == id).ExecuteCommandAsync();

    /// <summary>软删除：仅置 deleted_at，其他字段不变（全系统禁止物理删除）</summary>
    public Task SoftDeleteAsync(long id) =>
        database.Updateable<ConfigCenterNamespace>()
            .SetColumns(it => new ConfigCenterNamespace { DeletedAt = DateTimeOffset.UtcNow })
            .Where(it => it.Id == id).ExecuteCommandAsync();

    /// <summary>实体 → 业务数据（实体不出本层）</summary>
    private static NamespaceData From(ConfigCenterNamespace entity) =>
        new(entity.Id, entity.NamespaceKey, entity.NamespaceName, entity.Description, entity.Status,
            entity.CreatedBy, entity.UpdatedBy, entity.CreatedAt, entity.UpdatedAt);

    /// <summary>业务数据 → 实体（Id 不赋值：GENERATED ALWAYS 列由数据库生成）</summary>
    private static ConfigCenterNamespace To(NamespaceData data) => new()
    {
        NamespaceKey = data.NamespaceKey,
        NamespaceName = data.NamespaceName,
        Description = data.Description,
        Status = data.Status,
        CreatedBy = data.CreatedBy,
        UpdatedBy = data.UpdatedBy,
        CreatedAt = data.CreatedAt,
        UpdatedAt = data.UpdatedAt
    };
}
