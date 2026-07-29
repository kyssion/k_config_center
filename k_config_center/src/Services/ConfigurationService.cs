using k_config_center.Infrastructure;
using k_config_center.Models.Domain;
using k_config_center.Models.Requests;
using k_config_center.Models.Responses;
using k_config_center.Repositories;

namespace k_config_center.Services;

/// <summary>配置项业务逻辑：只负责配置的编辑保存（草稿）、详情与版本查询（模块边界约定）。
/// 发布/回滚/下线属事务型操作划归 PublishService；客户端读取划归 ClientConfigurationService。
/// 关键语义：保存编辑只更新当前态字段、不产生版本；md5 一律由服务端计算，不信任前端传值；
/// 「有未发布变更」= 当前 md5 与 published_version_id 指向版本的 md5 不一致，或从未发布。</summary>
public class ConfigurationService(
    ConfigurationRepository configurationRepository,
    ConfigurationVersionRepository configurationVersionRepository,
    ConfigurationGroupRepository configurationGroupRepository,
    OperationLogRepository operationLogRepository,
    IHttpContextAccessor httpContextAccessor)
{
    /// <summary>当前请求对象：供操作人与客户端 IP 提取</summary>
    private HttpRequest Request => httpContextAccessor.HttpContext!.Request;

    /// <summary>配置项列表（组/命名空间/环境/状态/关键字过滤均可选）：附「有未发布变更」标记，前端不做 md5 对比。
    /// 一次性取出全部生效版本的 md5 做内存比对，避免逐条回查数据库</summary>
    public async Task<List<ConfigurationResponse>> ListAsync(long? groupId, long? namespaceId, long? environmentId, string? status, string? keyword)
    {
        var configurations = await configurationRepository.ListAsync(groupId, namespaceId, environmentId, status, keyword);
        var publishedVersionIds = configurations.Where(it => it.PublishedVersionId != null).Select(it => it.PublishedVersionId!.Value).ToList();
        var publishedMd5ById = await configurationVersionRepository.GetMd5ByIdsAsync(publishedVersionIds);
        return configurations.Select(it => ConfigurationResponse.From(it,
            hasUnpublishedChange: it.PublishedVersionId == null || publishedMd5ById.GetValueOrDefault(it.PublishedVersionId.Value) != it.Md5)).ToList();
    }

    /// <summary>配置详情：当前编辑态 + 生效版本快照（从未发布则为 null），供编辑页与 Diff 对比使用</summary>
    public async Task<ConfigurationDetailResponse> GetAsync(long id)
    {
        var configuration = await configurationRepository.GetByIdAsync(id)
            ?? throw new BusinessException(10002, "配置不存在");
        var publishedVersion = configuration.PublishedVersionId == null ? null
            : await configurationVersionRepository.GetByIdAsync(configuration.PublishedVersionId.Value);
        return new ConfigurationDetailResponse(
            ConfigurationResponse.From(configuration, hasUnpublishedChange: publishedVersion == null || publishedVersion.Md5 != configuration.Md5),
            publishedVersion == null ? null : ConfigurationVersionResponse.From(publishedVersion));
    }

    /// <summary>新建配置：DRAFT 状态、版本号从 0 起（发布时才 +1 产生版本）；
    /// 冗余的 namespace/environment id 从所属配置组带出（跨模块只读，注入配置组 Repository）；
    /// 组内 key 撞唯一索引转业务错误码 30001</summary>
    public async Task<ConfigurationResponse> CreateAsync(ConfigurationCreateRequest request)
    {
        var group = await configurationGroupRepository.GetByIdAsync(request.GroupId)
            ?? throw new BusinessException(10002, "配置组不存在");
        var data = new ConfigurationData(0, group.Id, group.NamespaceId, group.EnvironmentId, request.ConfigurationKey,
            request.Content, request.Format, OperationHelper.ComputeMd5(request.Content), request.Description, request.Tags,
            Status: "DRAFT", PublishedVersionId: null, LatestVersionNumber: 0, PublishedAt: null,
            CreatedBy: OperationHelper.GetOperator(Request), UpdatedBy: null,
            CreatedAt: DateTimeOffset.UtcNow, UpdatedAt: DateTimeOffset.UtcNow);
        try { data = await configurationRepository.InsertAsync(data); }
        catch (Exception exception) when (OperationHelper.IsUniqueViolation(exception))
        { throw new BusinessException(30001, $"配置 key 在组内已存在：{request.ConfigurationKey}"); }
        await WriteLogAsync("CREATE", new { resource = "configuration", request.ConfigurationKey },
            data.NamespaceId, data.EnvironmentId, data.GroupId, data.Id);
        return ConfigurationResponse.From(data, hasUnpublishedChange: true); // 新建即未发布，必有未发布变更
    }

    /// <summary>保存编辑（草稿）：只更新 content/format/md5/description/tags，不产生版本、不改 status（文档 8.1）；
    /// updated_at 由数据库触发器自动刷新；先经带软删过滤器的查询确认存在（Updateable 不走全局过滤器）</summary>
    public async Task UpdateAsync(long id, ConfigurationUpdateRequest request)
    {
        var existing = await configurationRepository.GetByIdAsync(id)
            ?? throw new BusinessException(10002, "配置不存在");
        var md5 = OperationHelper.ComputeMd5(request.Content);
        await configurationRepository.UpdateDraftAsync(id, request.Content, request.Format, md5,
            request.Description, request.Tags, OperationHelper.GetOperator(Request));
        await WriteLogAsync("UPDATE", new { resource = "configuration", existing.ConfigurationKey, md5 },
            existing.NamespaceId, existing.EnvironmentId, existing.GroupId, id);
    }

    /// <summary>软删除：置 deleted_at；配置是叶子资源，无级联检查。版本与日志保留可审计</summary>
    public async Task DeleteAsync(long id)
    {
        var existing = await configurationRepository.GetByIdAsync(id)
            ?? throw new BusinessException(10002, "配置不存在");
        await configurationRepository.SoftDeleteAsync(id);
        await WriteLogAsync("DELETE", new { resource = "configuration", existing.ConfigurationKey },
            existing.NamespaceId, existing.EnvironmentId, existing.GroupId, id);
    }

    /// <summary>版本历史列表：按版本号倒序分页（版本表不设软删除，全量可追溯）</summary>
    public async Task<PageResponse<ConfigurationVersionResponse>> ListVersionsAsync(long id, int pageIndex, int pageSize)
    {
        var (items, total) = await configurationVersionRepository.ListPageAsync(id, pageIndex, pageSize);
        return new PageResponse<ConfigurationVersionResponse>(items.Select(ConfigurationVersionResponse.From).ToList(), total);
    }

    /// <summary>单个版本快照：供 Diff 取数（文档端点表 GET /versions/{versionNumber}）</summary>
    public async Task<ConfigurationVersionResponse> GetVersionAsync(long id, long versionNumber)
    {
        var version = await configurationVersionRepository.GetByVersionNumberAsync(id, versionNumber)
            ?? throw new BusinessException(10002, $"版本不存在：v{versionNumber}");
        return ConfigurationVersionResponse.From(version);
    }

    /// <summary>写审计日志：操作人/客户端 IP 从当前请求提取后交给日志模块的 Repository</summary>
    private Task WriteLogAsync(string operation, object detail, long? namespaceId, long? environmentId, long? groupId, long? configurationId) =>
        operationLogRepository.InsertAsync(operation, detail,
            OperationHelper.GetOperator(Request), OperationHelper.GetClientIpAddress(Request),
            namespaceId, environmentId, groupId, configurationId);
}
