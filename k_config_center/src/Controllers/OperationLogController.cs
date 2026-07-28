using k_config_center.Infrastructure;
using k_config_center.Services;
using Microsoft.AspNetCore.Mvc;

namespace k_config_center.Controllers;

/// <summary>操作日志查询：多维度检索（分页），业务逻辑在 OperationLogService；日志只读，不提供删除能力</summary>
[ApiController]
[Route("api/operation-logs")]
public class OperationLogController(OperationLogService operationLogService) : ControllerBase
{
    /// <summary>日志分页列表：各过滤条件均可选，按时间倒序</summary>
    [HttpGet]
    public async Task<object> List(long? namespaceId, long? environmentId, long? groupId, long? configurationId,
        string? operation, DateTimeOffset? startTime, DateTimeOffset? endTime, int pageIndex = 1, int pageSize = 20) =>
        ApiResponse.Ok(await operationLogService.ListAsync(
            namespaceId, environmentId, groupId, configurationId, operation, startTime, endTime, pageIndex, pageSize));
}
