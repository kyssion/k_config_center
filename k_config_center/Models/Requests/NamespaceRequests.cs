namespace k_config_center.Models.Requests;

/// <summary>创建命名空间请求</summary>
public record NamespaceCreateRequest(string NamespaceKey, string NamespaceName, string? Description);

/// <summary>更新命名空间请求：key 不可改，仅名称/描述/状态</summary>
public record NamespaceUpdateRequest(string NamespaceName, string? Description, short Status);
