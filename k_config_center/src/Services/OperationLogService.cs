using k_config_center.Models.Responses;
using k_config_center.Repositories;

namespace k_config_center.Services;

/// <summary>操作日志查询逻辑：多维度可选过滤 + 时间区间，按时间倒序分页（后端方案 7.2 操作审计，模块边界约定）。
/// 日志只读、不设软删除，不提供任何修改/删除能力；写入由各业务 Service 调 OperationLogRepository 完成</summary>
public class OperationLogService(OperationLogRepository operationLogRepository)
{
    /// <summary>日志分页检索：各过滤条件均可选（操作人为模糊匹配），时间区间为闭开区间 [startTime, endTime)</summary>
    public async Task<PageResponse<OperationLogResponse>> ListAsync(
        long? namespaceId, long? environmentId, long? groupId, long? configurationId,
        string? operation, string? operatorName, DateTimeOffset? startTime, DateTimeOffset? endTime, int pageIndex, int pageSize)
    {
        var (items, total) = await operationLogRepository.ListPageAsync(
            namespaceId, environmentId, groupId, configurationId, operation, operatorName, startTime, endTime, pageIndex, pageSize);
        return new PageResponse<OperationLogResponse>(items.Select(OperationLogResponse.From).ToList(), total);
    }
}
