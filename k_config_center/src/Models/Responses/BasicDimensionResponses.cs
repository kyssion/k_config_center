using k_config_center.Models.Domain;

namespace k_config_center.Models.Responses;

/// <summary>命名空间响应模型：由 Repository 输出的业务数据转换而来（实体不出 Repository 层）</summary>
public record NamespaceResponse(long Id, string NamespaceKey, string NamespaceName, string? Description, short Status,
    string? CreatedBy, string? UpdatedBy, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt)
{
    public static NamespaceResponse From(NamespaceData data) =>
        new(data.Id, data.NamespaceKey, data.NamespaceName, data.Description, data.Status,
            data.CreatedBy, data.UpdatedBy, data.CreatedAt, data.UpdatedAt);
}

/// <summary>环境响应模型</summary>
public record EnvironmentResponse(long Id, long NamespaceId, string EnvironmentKey, string EnvironmentName, string? Description,
    int SortOrder, short Status, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt)
{
    public static EnvironmentResponse From(EnvironmentData data) =>
        new(data.Id, data.NamespaceId, data.EnvironmentKey, data.EnvironmentName, data.Description,
            data.SortOrder, data.Status, data.CreatedAt, data.UpdatedAt);
}

/// <summary>配置组响应模型</summary>
public record ConfigurationGroupResponse(long Id, long NamespaceId, long EnvironmentId, string GroupKey, string GroupName,
    string? Description, short Status, string? CreatedBy, string? UpdatedBy, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt)
{
    public static ConfigurationGroupResponse From(ConfigurationGroupData data) =>
        new(data.Id, data.NamespaceId, data.EnvironmentId, data.GroupKey, data.GroupName,
            data.Description, data.Status, data.CreatedBy, data.UpdatedBy, data.CreatedAt, data.UpdatedAt);
}
