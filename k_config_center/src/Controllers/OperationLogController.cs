using k_config_center.Infrastructure;
using k_config_center.Services;
using Microsoft.AspNetCore.Mvc;

namespace k_config_center.Controllers;

/// <summary>操作日志查询：多维度检索（分页），业务逻辑在 OperationLogService；日志只读，不提供删除能力</summary>
[ApiController]
[Route("api/operation-logs")]
public class OperationLogController(OperationLogService operationLogService) : ControllerBase
{
    /// <summary>操作日志分页列表</summary>
    /// <remarks>各过滤条件均可选（可组合），按创建时间倒序；时间区间为闭开区间 [startTime, endTime)</remarks>
    /// <param name="namespaceId">按命名空间过滤（可选）</param>
    /// <param name="environmentId">按环境过滤（可选）</param>
    /// <param name="groupId">按配置组过滤（可选）</param>
    /// <param name="configurationId">按配置项过滤（可选）</param>
    /// <param name="operation">按操作类型过滤（可选）：CREATE / UPDATE / PUBLISH / ROLLBACK / OFFLINE / DELETE</param>
    /// <param name="operator">按操作人过滤（可选，模糊匹配）</param>
    /// <param name="startTime">起始时间（含，可选）</param>
    /// <param name="endTime">结束时间（不含，可选）</param>
    /// <param name="pageIndex">页码，从 1 开始</param>
    /// <param name="pageSize">每页条数</param>
    /// <returns>data 为分页结构 { items: OperationLogResponse[], total }</returns>
    [HttpGet]
    public async Task<object> List(long? namespaceId, long? environmentId, long? groupId, long? configurationId,
        string? operation, string? @operator, DateTimeOffset? startTime, DateTimeOffset? endTime, int pageIndex = 1, int pageSize = 20) =>
        ApiResponse.Ok(await operationLogService.ListAsync(
            namespaceId, environmentId, groupId, configurationId, operation, @operator, startTime, endTime, pageIndex, pageSize));
}
