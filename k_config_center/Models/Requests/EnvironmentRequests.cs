namespace k_config_center.Models.Requests;

/// <summary>创建环境请求</summary>
public record EnvironmentCreateRequest(long NamespaceId, string EnvironmentKey, string EnvironmentName, string? Description, int SortOrder);

/// <summary>更新环境请求：key 与所属命名空间不可改，仅名称/描述/排序/状态</summary>
public record EnvironmentUpdateRequest(string EnvironmentName, string? Description, int SortOrder, short Status);
