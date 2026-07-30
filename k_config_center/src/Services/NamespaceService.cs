using k_config_center.Infrastructure;
using k_config_center.Models.Domain;
using k_config_center.Models.Requests;
using k_config_center.Models.Responses;
using k_config_center.Repositories;

namespace k_config_center.Services;

/// <summary>命名空间业务逻辑：只负责 namespace 模块（模块边界约定）。
/// 统一规则：删除一律软删除；存在未删除下级环境时拒绝删除（20004）——级联检查属跨模块读取，
/// 通过注入环境模块的 EnvironmentRepository 完成（比注入对方 Service 依赖更浅、代码更少）；
/// 创建依赖数据库部分唯一索引兜底，捕获 23505 转对应业务错误码。</summary>
public class NamespaceService(
    NamespaceRepository namespaceRepository,
    EnvironmentRepository environmentRepository,
    OperationLogRepository operationLogRepository,
    IHttpContextAccessor httpContextAccessor)
{
    /// <summary>当前请求对象：供操作人与客户端 IP 提取</summary>
    private HttpRequest Request => httpContextAccessor.HttpContext!.Request;

    /// <summary>命名空间列表：软删过滤由 Repository 的查询（全局过滤器）保证，按创建时间排序</summary>
    public async Task<List<NamespaceResponse>> ListAsync() =>
        (await namespaceRepository.ListAsync()).Select(NamespaceResponse.From).ToList();

    /// <summary>创建命名空间：namespace_key 撞部分唯一索引时转业务错误码 20001</summary>
    public async Task<NamespaceResponse> CreateAsync(NamespaceCreateRequest request)
    {
        var data = new NamespaceData(0, request.NamespaceKey, request.NamespaceName, request.Description, Status: 1,
            CreatedBy: OperationHelper.GetOperator(Request), UpdatedBy: null,
            CreatedAt: DateTimeOffset.UtcNow, UpdatedAt: DateTimeOffset.UtcNow);
        try { data = await namespaceRepository.InsertAsync(data); }
        catch (Exception exception) when (OperationHelper.IsUniqueViolation(exception))
        { throw new BusinessException(ErrorCode.NamespaceKeyConflict, $"命名空间 key 已存在：{request.NamespaceKey}"); }
        await WriteLogAsync("CREATE", new { resource = "namespace", request.NamespaceKey }, namespaceId: data.Id);
        return NamespaceResponse.From(data);
    }

    /// <summary>更新命名空间名称/描述/状态：key 不可改；updated_at 由数据库触发器维护。
    /// 先经带软删过滤器的查询确认存在（Updateable 不走全局过滤器）</summary>
    public async Task UpdateAsync(long id, NamespaceUpdateRequest request)
    {
        if (await namespaceRepository.GetByIdAsync(id) == null)
            throw new BusinessException(ErrorCode.ResourceNotFound, "命名空间不存在");
        await namespaceRepository.UpdateAsync(id, request.NamespaceName, request.Description, request.Status, OperationHelper.GetOperator(Request));
        await WriteLogAsync("UPDATE", new { resource = "namespace", request.NamespaceName }, namespaceId: id);
    }

    /// <summary>软删除命名空间：存在未删除的下级环境时拒绝（20004），不做级联软删，需自底向上清空</summary>
    public async Task DeleteAsync(long id)
    {
        if (await namespaceRepository.GetByIdAsync(id) == null)
            throw new BusinessException(ErrorCode.ResourceNotFound, "命名空间不存在");
        if (await environmentRepository.ExistsByNamespaceIdAsync(id))
            throw new BusinessException(ErrorCode.CascadeDeleteConflict, "存在未删除的下级环境，拒绝删除");
        await namespaceRepository.SoftDeleteAsync(id);
        await WriteLogAsync("DELETE", new { resource = "namespace", id }, namespaceId: id);
    }

    /// <summary>写审计日志：操作人/客户端 IP 从当前请求提取后交给日志模块的 Repository</summary>
    private Task WriteLogAsync(string operation, object detail, long? namespaceId = null) =>
        operationLogRepository.InsertAsync(operation, detail,
            OperationHelper.GetOperator(Request), OperationHelper.GetClientIpAddress(Request), namespaceId);
}
