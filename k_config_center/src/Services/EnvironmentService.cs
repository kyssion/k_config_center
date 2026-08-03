using k_config_center.Infrastructure;
using k_config_center.Models.Domain;
using k_config_center.Models.Requests;
using k_config_center.Models.Responses;
using k_config_center.Repositories;

namespace k_config_center.Services;

/// <summary>环境业务逻辑：只负责 environment 模块（模块边界约定）。
/// 删除前的级联检查需要读取下级配置组，通过注入配置组模块的 ConfigurationGroupRepository 完成</summary>
public class EnvironmentService(
    EnvironmentRepository environmentRepository,
    ConfigurationGroupRepository configurationGroupRepository,
    OperationLogRepository operationLogRepository,
    IHttpContextAccessor httpContextAccessor)
{
    /// <summary>当前请求对象：供操作人与客户端 IP 提取</summary>
    private HttpRequest Request => httpContextAccessor.HttpContext!.Request;

    /// <summary>环境列表：命名空间过滤可选，按 sort_order 再按创建时间排序（后端方案 7.2）</summary>
    public async Task<List<EnvironmentResponse>> ListAsync(long? namespaceId) =>
        (await environmentRepository.ListByNamespaceAsync(namespaceId)).Select(EnvironmentResponse.From).ToList();

    /// <summary>创建环境：同命名空间内 environment_key 唯一冲突转业务错误码 20002</summary>
    public async Task<EnvironmentResponse> CreateAsync(EnvironmentCreateRequest request)
    {
        var data = new EnvironmentData(0, request.NamespaceId, request.EnvironmentKey, request.EnvironmentName,
            request.Description, request.SortOrder, Status: 1,
            CreatedAt: DateTimeOffset.UtcNow, UpdatedAt: DateTimeOffset.UtcNow);
        try { data = await environmentRepository.InsertAsync(data); }
        catch (Exception exception) when (OperationHelper.IsUniqueViolation(exception))
        { throw new BusinessException(ErrorCode.EnvironmentKeyConflict, $"环境 key 在命名空间内已存在：{request.EnvironmentKey}"); }
        await WriteLogAsync("CREATE", new { resource = "environment", request.EnvironmentKey },
            namespaceId: data.NamespaceId, environmentId: data.Id);
        return EnvironmentResponse.From(data);
    }

    /// <summary>更新环境名称/描述/排序/状态：key 与所属命名空间不可改；
    /// 先经带软删过滤器的查询确认存在（Updateable 不走全局过滤器）</summary>
    public async Task UpdateAsync(long id, EnvironmentUpdateRequest request)
    {
        var existing = await environmentRepository.GetByIdAsync(id)
            ?? throw new BusinessException(ErrorCode.ResourceNotFound, "环境不存在");
        await environmentRepository.UpdateAsync(id, request.EnvironmentName, request.Description, request.SortOrder, request.Status);
        // 审计日志维度带全：上级命名空间 id 从既有记录取，避免日志只挂环境导致审计页缺失命名空间信息
        await WriteLogAsync("UPDATE", new { resource = "environment", request.EnvironmentName },
            namespaceId: existing.NamespaceId, environmentId: id);
    }

    /// <summary>软删除环境：存在未删除的下级配置组时拒绝（20004）</summary>
    public async Task DeleteAsync(long id)
    {
        var existing = await environmentRepository.GetByIdAsync(id)
            ?? throw new BusinessException(ErrorCode.ResourceNotFound, "环境不存在");
        if (await configurationGroupRepository.ExistsByEnvironmentIdAsync(id))
            throw new BusinessException(ErrorCode.CascadeDeleteConflict, "存在未删除的下级配置组，拒绝删除");
        await environmentRepository.SoftDeleteAsync(id);
        await WriteLogAsync("DELETE", new { resource = "environment", id },
            namespaceId: existing.NamespaceId, environmentId: id);
    }

    /// <summary>写审计日志：操作人/客户端 IP 从当前请求提取后交给日志模块的 Repository</summary>
    private Task WriteLogAsync(string operation, object detail, long? namespaceId = null, long? environmentId = null) =>
        operationLogRepository.InsertAsync(operation, detail,
            OperationHelper.GetOperator(Request), OperationHelper.GetClientIpAddress(Request), namespaceId, environmentId);
}
