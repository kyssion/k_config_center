using k_config_center.Infrastructure;
using k_config_center.Models.Domain;
using k_config_center.Models.Requests;
using k_config_center.Models.Responses;
using k_config_center.Repositories;

namespace k_config_center.Services;

/// <summary>配置组业务逻辑：只负责 group 模块（模块边界约定）。
/// 删除前的级联检查需要读取下级配置项，通过注入配置模块的 ConfigurationRepository 完成</summary>
public class ConfigurationGroupService(
    ConfigurationGroupRepository configurationGroupRepository,
    ConfigurationRepository configurationRepository,
    OperationLogRepository operationLogRepository,
    IHttpContextAccessor httpContextAccessor)
{
    /// <summary>当前请求对象：供操作人与客户端 IP 提取</summary>
    private HttpRequest Request => httpContextAccessor.HttpContext!.Request;

    /// <summary>配置组列表：命名空间/环境过滤均可选（后端方案端点表两参数并列），按创建时间排序</summary>
    public async Task<List<ConfigurationGroupResponse>> ListAsync(long? namespaceId, long? environmentId) =>
        (await configurationGroupRepository.ListAsync(namespaceId, environmentId))
        .Select(ConfigurationGroupResponse.From).ToList();

    /// <summary>创建配置组：同环境内 group_key 唯一冲突转业务错误码 20003</summary>
    public async Task<ConfigurationGroupResponse> CreateAsync(ConfigurationGroupCreateRequest request)
    {
        var data = new ConfigurationGroupData(0, request.NamespaceId, request.EnvironmentId, request.GroupKey,
            request.GroupName, request.Description, Status: 1,
            CreatedBy: OperationHelper.GetOperator(Request), UpdatedBy: null,
            CreatedAt: DateTimeOffset.UtcNow, UpdatedAt: DateTimeOffset.UtcNow);
        try { data = await configurationGroupRepository.InsertAsync(data); }
        catch (Exception exception) when (OperationHelper.IsUniqueViolation(exception))
        { throw new BusinessException(ErrorCode.GroupKeyConflict, $"配置组 key 在环境内已存在：{request.GroupKey}"); }
        await WriteLogAsync("CREATE", new { resource = "group", request.GroupKey },
            namespaceId: data.NamespaceId, environmentId: data.EnvironmentId, groupId: data.Id);
        return ConfigurationGroupResponse.From(data);
    }

    /// <summary>更新配置组名称/描述/状态：key 与所属环境不可改；
    /// 先经带软删过滤器的查询确认存在（Updateable 不走全局过滤器）</summary>
    public async Task UpdateAsync(long id, ConfigurationGroupUpdateRequest request)
    {
        var existing = await configurationGroupRepository.GetByIdAsync(id)
            ?? throw new BusinessException(ErrorCode.ResourceNotFound, "配置组不存在");
        await configurationGroupRepository.UpdateAsync(id, request.GroupName, request.Description, request.Status, OperationHelper.GetOperator(Request));
        // 审计日志维度带全：上级命名空间/环境 id 从既有记录取，避免日志只挂配置组导致审计页缺失上级维度信息
        await WriteLogAsync("UPDATE", new { resource = "group", request.GroupName },
            namespaceId: existing.NamespaceId, environmentId: existing.EnvironmentId, groupId: id);
    }

    /// <summary>软删除配置组：存在未删除的配置项时拒绝（20004）</summary>
    public async Task DeleteAsync(long id)
    {
        var existing = await configurationGroupRepository.GetByIdAsync(id)
            ?? throw new BusinessException(ErrorCode.ResourceNotFound, "配置组不存在");
        if (await configurationRepository.ExistsByGroupIdAsync(id))
            throw new BusinessException(ErrorCode.CascadeDeleteConflict, "存在未删除的配置项，拒绝删除");
        await configurationGroupRepository.SoftDeleteAsync(id);
        await WriteLogAsync("DELETE", new { resource = "group", id },
            namespaceId: existing.NamespaceId, environmentId: existing.EnvironmentId, groupId: id);
    }

    /// <summary>写审计日志：操作人/客户端 IP 从当前请求提取后交给日志模块的 Repository</summary>
    private Task WriteLogAsync(string operation, object detail, long? namespaceId = null, long? environmentId = null, long? groupId = null) =>
        operationLogRepository.InsertAsync(operation, detail,
            OperationHelper.GetOperator(Request), OperationHelper.GetClientIpAddress(Request), namespaceId, environmentId, groupId);
}
