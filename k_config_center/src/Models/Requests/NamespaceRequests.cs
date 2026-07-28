namespace k_config_center.Models.Requests;

/// <summary>创建命名空间请求</summary>
/// <param name="NamespaceKey">命名空间标识，全局唯一（软删除后可重建同名），创建后不可改</param>
/// <param name="NamespaceName">命名空间显示名称</param>
/// <param name="Description">描述，可空</param>
public record NamespaceCreateRequest(string NamespaceKey, string NamespaceName, string? Description);

/// <summary>更新命名空间请求：key 不可改，仅名称/描述/状态</summary>
/// <param name="NamespaceName">命名空间显示名称</param>
/// <param name="Description">描述，可空</param>
/// <param name="Status">状态：1=启用，0=禁用</param>
public record NamespaceUpdateRequest(string NamespaceName, string? Description, short Status);
