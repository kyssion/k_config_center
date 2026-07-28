using k_config_center.Models.Domain;

namespace k_config_center.Models.Responses;

/// <summary>命名空间响应模型：由 Repository 输出的业务数据转换而来（实体不出 Repository 层）</summary>
/// <param name="Id">命名空间 id</param>
/// <param name="NamespaceKey">命名空间标识，全局唯一</param>
/// <param name="NamespaceName">命名空间显示名称</param>
/// <param name="Description">描述，可空</param>
/// <param name="Status">状态：1=启用，0=禁用</param>
/// <param name="CreatedBy">创建人，可空</param>
/// <param name="UpdatedBy">最后更新人，可空</param>
/// <param name="CreatedAt">创建时间（UTC）</param>
/// <param name="UpdatedAt">最后更新时间（UTC）</param>
public record NamespaceResponse(long Id, string NamespaceKey, string NamespaceName, string? Description, short Status,
    string? CreatedBy, string? UpdatedBy, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt)
{
    public static NamespaceResponse From(NamespaceData data) =>
        new(data.Id, data.NamespaceKey, data.NamespaceName, data.Description, data.Status,
            data.CreatedBy, data.UpdatedBy, data.CreatedAt, data.UpdatedAt);
}

/// <summary>环境响应模型</summary>
/// <param name="Id">环境 id</param>
/// <param name="NamespaceId">所属命名空间 id</param>
/// <param name="EnvironmentKey">环境标识，同命名空间内唯一</param>
/// <param name="EnvironmentName">环境显示名称</param>
/// <param name="Description">描述，可空</param>
/// <param name="SortOrder">排序值，列表按此升序</param>
/// <param name="Status">状态：1=启用，0=禁用</param>
/// <param name="CreatedAt">创建时间（UTC）</param>
/// <param name="UpdatedAt">最后更新时间（UTC）</param>
public record EnvironmentResponse(long Id, long NamespaceId, string EnvironmentKey, string EnvironmentName, string? Description,
    int SortOrder, short Status, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt)
{
    public static EnvironmentResponse From(EnvironmentData data) =>
        new(data.Id, data.NamespaceId, data.EnvironmentKey, data.EnvironmentName, data.Description,
            data.SortOrder, data.Status, data.CreatedAt, data.UpdatedAt);
}

/// <summary>配置组响应模型</summary>
/// <param name="Id">配置组 id</param>
/// <param name="NamespaceId">所属命名空间 id</param>
/// <param name="EnvironmentId">所属环境 id</param>
/// <param name="GroupKey">配置组标识，同环境内唯一</param>
/// <param name="GroupName">配置组显示名称</param>
/// <param name="Description">描述，可空</param>
/// <param name="Status">状态：1=启用，0=禁用</param>
/// <param name="CreatedBy">创建人，可空</param>
/// <param name="UpdatedBy">最后更新人，可空</param>
/// <param name="CreatedAt">创建时间（UTC）</param>
/// <param name="UpdatedAt">最后更新时间（UTC）</param>
public record ConfigurationGroupResponse(long Id, long NamespaceId, long EnvironmentId, string GroupKey, string GroupName,
    string? Description, short Status, string? CreatedBy, string? UpdatedBy, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt)
{
    public static ConfigurationGroupResponse From(ConfigurationGroupData data) =>
        new(data.Id, data.NamespaceId, data.EnvironmentId, data.GroupKey, data.GroupName,
            data.Description, data.Status, data.CreatedBy, data.UpdatedBy, data.CreatedAt, data.UpdatedAt);
}
