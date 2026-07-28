using k_config_center.Entities;
using k_config_center.Models.Domain;
using SqlSugar;

namespace k_config_center.Repositories;

/// <summary>配置版本快照数据访问：版本表不可变（只插入不更新）、不设软删除，全量保留可追溯</summary>
public class ConfigurationVersionRepository(ISqlSugarClient database)
{
    /// <summary>按快照 id 查单条：供详情页展示生效版本、发布前 md5 比对</summary>
    public async Task<ConfigurationVersionData?> GetByIdAsync(long id)
    {
        var entity = await database.Queryable<ConfigCenterConfigurationVersion>().InSingleAsync(id);
        return entity == null ? null : From(entity);
    }

    /// <summary>按配置 id + 版本号查单条：供单版本快照查询与回滚目标定位</summary>
    public async Task<ConfigurationVersionData?> GetByVersionNumberAsync(long configurationId, long versionNumber)
    {
        var entity = await database.Queryable<ConfigCenterConfigurationVersion>()
            .FirstAsync(it => it.ConfigurationId == configurationId && it.VersionNumber == versionNumber);
        return entity == null ? null : From(entity);
    }

    /// <summary>版本历史分页：按版本号倒序，返回当前页与总数</summary>
    public async Task<(List<ConfigurationVersionData> Items, int Total)> ListPageAsync(long configurationId, int pageIndex, int pageSize)
    {
        RefAsync<int> total = 0;
        var entities = await database.Queryable<ConfigCenterConfigurationVersion>()
            .Where(it => it.ConfigurationId == configurationId)
            .OrderByDescending(it => it.VersionNumber)
            .ToPageListAsync(pageIndex, pageSize, total);
        return (entities.Select(From).ToList(), total);
    }

    /// <summary>批量取生效版本 md5：一次查回供列表接口内存比对「有未发布变更」，避免逐条回查</summary>
    public async Task<Dictionary<long, string?>> GetMd5ByIdsAsync(List<long> ids) =>
        (await database.Queryable<ConfigCenterConfigurationVersion>().In(ids).ToListAsync())
        .ToDictionary(it => it.Id, it => it.Md5);

    /// <summary>插入版本快照，返回数据库生成的快照 id；
    /// UNIQUE(configuration_id, version_number) 冲突原样抛出，由 Service 转发布并发冲突（30004）</summary>
    public Task<long> InsertAsync(ConfigurationVersionData data) =>
        database.Insertable(To(data)).ExecuteReturnBigIdentityAsync();

    /// <summary>实体 → 业务数据（实体不出本层）</summary>
    private static ConfigurationVersionData From(ConfigCenterConfigurationVersion entity) =>
        new(entity.Id, entity.ConfigurationId, entity.VersionNumber, entity.Content, entity.Format,
            entity.Md5, entity.ChangeType, entity.ChangeRemark, entity.CreatedBy, entity.CreatedAt);

    /// <summary>业务数据 → 实体（Id 不赋值：GENERATED ALWAYS 列由数据库生成）</summary>
    private static ConfigCenterConfigurationVersion To(ConfigurationVersionData data) => new()
    {
        ConfigurationId = data.ConfigurationId,
        VersionNumber = data.VersionNumber,
        Content = data.Content,
        Format = data.Format,
        Md5 = data.Md5,
        ChangeType = data.ChangeType,
        ChangeRemark = data.ChangeRemark,
        CreatedBy = data.CreatedBy,
        CreatedAt = data.CreatedAt
    };
}
