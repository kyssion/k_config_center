using k_config_center.Models.Domain;

namespace k_config_center.Models.Responses;

/// <summary>分页结构：遵循后端方案 7.1 的 data: { items, total }</summary>
/// <param name="Items">当前页数据列表</param>
/// <param name="Total">满足条件的总条数（非当前页条数）</param>
public record PageResponse<T>(List<T> Items, int Total);

/// <summary>客户端读取响应：已发布版本快照的内容与 md5（非编辑中的草稿）</summary>
/// <param name="ConfigurationKey">配置标识</param>
/// <param name="Content">已发布的内容快照，可空</param>
/// <param name="Format">内容格式，可空</param>
/// <param name="Md5">快照内容的 md5，供客户端本地缓存比对，可空</param>
/// <param name="VersionNumber">快照对应的版本号</param>
public record ClientConfigurationResponse(string ConfigurationKey, string? Content, string? Format, string? Md5, long VersionNumber);

/// <summary>长轮询变更探测响应：changed=true 时客户端应重新拉取配置；md5 为组内已发布配置的整体指纹</summary>
/// <param name="Changed">组内已发布配置相对客户端持有指纹是否有变化</param>
/// <param name="Md5">组内已发布配置的整体指纹，下次轮询时回传</param>
public record ClientNotificationResponse(bool Changed, string Md5);

/// <summary>操作日志响应模型</summary>
/// <param name="Id">日志 id</param>
/// <param name="NamespaceId">关联命名空间 id，可空</param>
/// <param name="EnvironmentId">关联环境 id，可空</param>
/// <param name="GroupId">关联配置组 id，可空</param>
/// <param name="ConfigurationId">关联配置 id，可空</param>
/// <param name="Operation">操作类型，如 CREATE/UPDATE/DELETE/PUBLISH/ROLLBACK/OFFLINE</param>
/// <param name="Detail">操作详情（JSON 文本），可空</param>
/// <param name="Operator">操作人，缺省 system</param>
/// <param name="ClientIpAddress">操作来源 IP，可空</param>
/// <param name="CreatedAt">操作时间（UTC）</param>
public record OperationLogResponse(long Id, long? NamespaceId, long? EnvironmentId, long? GroupId, long? ConfigurationId,
    string Operation, string? Detail, string? Operator, string? ClientIpAddress, DateTimeOffset CreatedAt)
{
    public static OperationLogResponse From(OperationLogData data) =>
        new(data.Id, data.NamespaceId, data.EnvironmentId, data.GroupId, data.ConfigurationId,
            data.Operation, data.Detail, data.Operator, data.ClientIpAddress, data.CreatedAt);
}
