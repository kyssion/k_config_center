using k_config_center.Entities;
using k_config_center.Models.Domain;
using SqlSugar;

namespace k_config_center.Repositories;

/// <summary>配置项数据访问：当前态表的读写与客户端五表联查收口于此，对外只出入业务数据。
/// 含发布流程需要的原子操作（版本号自增、生效指针切换），事务边界由 Service 层通过 DatabaseTransactionRunner 编排</summary>
public class ConfigurationRepository(ISqlSugarClient database)
{
    /// <summary>配置列表：组/命名空间/环境/状态/关键字过滤均可选（实体含 NamespaceId/EnvironmentId 冗余列，单表过滤无需联表），按创建时间排序。
    /// LeftJoin 命名空间/环境/配置组表带出冗余名称与业务 key（联表显式带 deleted_at 条件，不依赖全局过滤器在联表中的行为，关联不到为 null）</summary>
    public async Task<List<ConfigurationData>> ListAsync(long? groupId, long? namespaceId, long? environmentId, string? status, string? keyword) =>
        (await database.Queryable<ConfigCenterConfiguration>()
            .LeftJoin<ConfigCenterNamespace>((it, ns) => it.NamespaceId == ns.Id && ns.DeletedAt == null)
            .LeftJoin<ConfigCenterEnvironment>((it, ns, env) => it.EnvironmentId == env.Id && env.DeletedAt == null)
            .LeftJoin<ConfigCenterConfigurationGroup>((it, ns, env, grp) => it.GroupId == grp.Id && grp.DeletedAt == null)
            .WhereIF(groupId != null, it => it.GroupId == groupId)
            .WhereIF(namespaceId != null, it => it.NamespaceId == namespaceId)
            .WhereIF(environmentId != null, it => it.EnvironmentId == environmentId)
            .WhereIF(!string.IsNullOrEmpty(status), it => it.Status == status)
            .WhereIF(!string.IsNullOrEmpty(keyword), it => it.ConfigurationKey.Contains(keyword!))
            .OrderBy(it => it.CreatedAt)
            .Select((it, ns, env, grp) => new
            { Entity = it, ns.NamespaceName, env.EnvironmentName, grp.GroupName, ns.NamespaceKey, env.EnvironmentKey, grp.GroupKey }).ToListAsync())
        .Select(row => From(row.Entity) with
        {
            NamespaceName = row.NamespaceName, EnvironmentName = row.EnvironmentName, GroupName = row.GroupName,
            NamespaceKey = row.NamespaceKey, EnvironmentKey = row.EnvironmentKey, GroupKey = row.GroupKey
        }).ToList();

    /// <summary>按 id 查单条（已软删返回 null）：LeftJoin 带出三个维度的冗余名称与业务 key，与列表同口径</summary>
    public async Task<ConfigurationData?> GetByIdAsync(long id)
    {
        var row = await database.Queryable<ConfigCenterConfiguration>()
            .LeftJoin<ConfigCenterNamespace>((it, ns) => it.NamespaceId == ns.Id && ns.DeletedAt == null)
            .LeftJoin<ConfigCenterEnvironment>((it, ns, env) => it.EnvironmentId == env.Id && env.DeletedAt == null)
            .LeftJoin<ConfigCenterConfigurationGroup>((it, ns, env, grp) => it.GroupId == grp.Id && grp.DeletedAt == null)
            .Where(it => it.Id == id)
            .Select((it, ns, env, grp) => new
            { Entity = it, ns.NamespaceName, env.EnvironmentName, grp.GroupName, ns.NamespaceKey, env.EnvironmentKey, grp.GroupKey }).FirstAsync();
        return row == null ? null
            : From(row.Entity) with
            {
                NamespaceName = row.NamespaceName, EnvironmentName = row.EnvironmentName, GroupName = row.GroupName,
                NamespaceKey = row.NamespaceKey, EnvironmentKey = row.EnvironmentKey, GroupKey = row.GroupKey
            };
    }

    /// <summary>组内是否存在未删除的配置项：供配置组删除前的级联检查</summary>
    public Task<bool> ExistsByGroupIdAsync(long groupId) =>
        database.Queryable<ConfigCenterConfiguration>().AnyAsync(it => it.GroupId == groupId);

    /// <summary>插入：id 由数据库生成后回填；唯一冲突原样抛出，由 Service 转业务错误码</summary>
    public async Task<ConfigurationData> InsertAsync(ConfigurationData data)
    {
        var entity = To(data);
        var id = await database.Insertable(entity).ExecuteReturnBigIdentityAsync();
        return data with { Id = id };
    }

    /// <summary>保存草稿：只更新当前态内容字段，不动 status / 版本号 / 生效指针（后端方案 8.1）</summary>
    public Task UpdateDraftAsync(long id, string? content, string format, string? md5, string? description, string? tags, string? updatedBy) =>
        database.Updateable<ConfigCenterConfiguration>()
            .SetColumns(it => new ConfigCenterConfiguration
            { Content = content, Format = format, Md5 = md5, Description = description, Tags = tags, UpdatedBy = updatedBy })
            .Where(it => it.Id == id).ExecuteCommandAsync();

    /// <summary>软删除：仅置 deleted_at</summary>
    public Task SoftDeleteAsync(long id) =>
        database.Updateable<ConfigCenterConfiguration>()
            .SetColumns(it => new ConfigCenterConfiguration { DeletedAt = DateTimeOffset.UtcNow })
            .Where(it => it.Id == id).ExecuteCommandAsync();

    /// <summary>版本号原子递增：数据库侧 UPDATE ... RETURNING，并发发布在行锁上串行化各自拿到不同版本号，
    /// 避免「先读后写」竞态（后端方案第 9 章）；返回 null 表示行不存在或已软删</summary>
    public async Task<long?> IncrementLatestVersionNumberAsync(long id)
    {
        var versionNumberScalar = await database.Ado.GetScalarAsync(
            "UPDATE config_center_configuration SET latest_version_number = latest_version_number + 1 WHERE id = @id AND deleted_at IS NULL RETURNING latest_version_number",
            new { id });
        return versionNumberScalar is null or DBNull ? null : Convert.ToInt64(versionNumberScalar);
    }

    /// <summary>发布后切换生效指针：published_version_id 指向新快照，status 置 PUBLISHED</summary>
    public Task UpdatePublishStateAsync(long id, long publishedVersionId) =>
        database.Updateable<ConfigCenterConfiguration>()
            .SetColumns(it => new ConfigCenterConfiguration
            { PublishedVersionId = publishedVersionId, Status = "PUBLISHED", PublishedAt = DateTimeOffset.UtcNow })
            .Where(it => it.Id == id).ExecuteCommandAsync();

    /// <summary>回滚后更新：当前态内容同步为历史版本值，并切换生效指针（后端方案 8.3 第 3 步）</summary>
    public Task UpdateRollbackStateAsync(long id, string? content, string format, string? md5, long publishedVersionId) =>
        database.Updateable<ConfigCenterConfiguration>()
            .SetColumns(it => new ConfigCenterConfiguration
            { Content = content, Format = format, Md5 = md5, PublishedVersionId = publishedVersionId, Status = "PUBLISHED", PublishedAt = DateTimeOffset.UtcNow })
            .Where(it => it.Id == id).ExecuteCommandAsync();

    /// <summary>下线：仅置 status=OFFLINE，版本与生效指针保留（重新发布可恢复）</summary>
    public Task UpdateOfflineStateAsync(long id, string? updatedBy) =>
        database.Updateable<ConfigCenterConfiguration>()
            .SetColumns(it => new ConfigCenterConfiguration { Status = "OFFLINE", UpdatedBy = updatedBy })
            .Where(it => it.Id == id).ExecuteCommandAsync();

    /// <summary>客户端读取的五表联查：按业务 key 定位组，只取 status='PUBLISHED' 且未软删的配置，
    /// 内容取 published_version_id 指向的版本快照；联表显式带 deleted_at 条件，不依赖全局过滤器在联表中的行为</summary>
    public async Task<List<ClientConfigurationData>> ListPublishedByBusinessKeysAsync(
        string namespaceKey, string environmentKey, string groupKey, string? configurationKey = null)
    {
        var rows = await database.Queryable<ConfigCenterNamespace, ConfigCenterEnvironment, ConfigCenterConfigurationGroup, ConfigCenterConfiguration, ConfigCenterConfigurationVersion>(
                (n, e, g, c, v) => new JoinQueryInfos(
                    JoinType.Inner, e.NamespaceId == n.Id,
                    JoinType.Inner, g.EnvironmentId == e.Id,
                    JoinType.Inner, c.GroupId == g.Id,
                    JoinType.Inner, v.Id == c.PublishedVersionId))
            .Where((n, e, g, c) => n.NamespaceKey == namespaceKey && e.EnvironmentKey == environmentKey && g.GroupKey == groupKey
                && c.Status == "PUBLISHED"
                && n.DeletedAt == null && e.DeletedAt == null && g.DeletedAt == null && c.DeletedAt == null)
            .WhereIF(!string.IsNullOrEmpty(configurationKey), (n, e, g, c) => c.ConfigurationKey == configurationKey)
            .Select((n, e, g, c, v) => new
            { configurationKey = c.ConfigurationKey, content = v.Content, format = v.Format, md5 = v.Md5, versionNumber = v.VersionNumber })
            .ToListAsync();
        return rows.Select(it => new ClientConfigurationData(it.configurationKey, it.content, it.format, it.md5, it.versionNumber)).ToList();
    }

    /// <summary>实体 → 业务数据（实体不出本层）</summary>
    private static ConfigurationData From(ConfigCenterConfiguration entity) =>
        new(entity.Id, entity.GroupId, entity.NamespaceId, entity.EnvironmentId, entity.ConfigurationKey,
            entity.Content, entity.Format, entity.Md5, entity.Description, entity.Tags, entity.Status,
            entity.PublishedVersionId, entity.LatestVersionNumber, entity.PublishedAt,
            entity.CreatedBy, entity.UpdatedBy, entity.CreatedAt, entity.UpdatedAt);

    /// <summary>业务数据 → 实体（Id 不赋值：GENERATED ALWAYS 列由数据库生成）</summary>
    private static ConfigCenterConfiguration To(ConfigurationData data) => new()
    {
        GroupId = data.GroupId,
        NamespaceId = data.NamespaceId,
        EnvironmentId = data.EnvironmentId,
        ConfigurationKey = data.ConfigurationKey,
        Content = data.Content,
        Format = data.Format,
        Md5 = data.Md5,
        Description = data.Description,
        Tags = data.Tags,
        Status = data.Status,
        PublishedVersionId = data.PublishedVersionId,
        LatestVersionNumber = data.LatestVersionNumber,
        PublishedAt = data.PublishedAt,
        CreatedBy = data.CreatedBy,
        UpdatedBy = data.UpdatedBy,
        CreatedAt = data.CreatedAt,
        UpdatedAt = data.UpdatedAt
    };
}
