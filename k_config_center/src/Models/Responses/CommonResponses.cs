using k_config_center.Models.Domain;

namespace k_config_center.Models.Responses;

/// <summary>分页结构：遵循后端方案 7.1 的 data: { items, total }</summary>
public record PageResponse<T>(List<T> Items, int Total);

/// <summary>客户端读取响应：已发布版本快照的内容与 md5（非编辑中的草稿）</summary>
public record ClientConfigurationResponse(string ConfigurationKey, string? Content, string? Format, string? Md5, long VersionNumber);

/// <summary>长轮询变更探测响应：changed=true 时客户端应重新拉取配置；md5 为组内已发布配置的整体指纹</summary>
public record ClientNotificationResponse(bool Changed, string Md5);

/// <summary>操作日志响应模型</summary>
public record OperationLogResponse(long Id, long? NamespaceId, long? EnvironmentId, long? GroupId, long? ConfigurationId,
    string Operation, string? Detail, string? Operator, string? ClientIpAddress, DateTimeOffset CreatedAt)
{
    public static OperationLogResponse From(OperationLogData data) =>
        new(data.Id, data.NamespaceId, data.EnvironmentId, data.GroupId, data.ConfigurationId,
            data.Operation, data.Detail, data.Operator, data.ClientIpAddress, data.CreatedAt);
}
