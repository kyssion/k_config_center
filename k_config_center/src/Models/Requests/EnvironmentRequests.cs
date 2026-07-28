namespace k_config_center.Models.Requests;

/// <summary>创建环境请求</summary>
/// <param name="NamespaceId">所属命名空间 id</param>
/// <param name="EnvironmentKey">环境标识，同命名空间内唯一，创建后不可改</param>
/// <param name="EnvironmentName">环境显示名称</param>
/// <param name="Description">描述，可空</param>
/// <param name="SortOrder">排序值，列表按此升序展示</param>
public record EnvironmentCreateRequest(long NamespaceId, string EnvironmentKey, string EnvironmentName, string? Description, int SortOrder);

/// <summary>更新环境请求：key 与所属命名空间不可改，仅名称/描述/排序/状态</summary>
/// <param name="EnvironmentName">环境显示名称</param>
/// <param name="Description">描述，可空</param>
/// <param name="SortOrder">排序值，列表按此升序展示</param>
/// <param name="Status">状态：1=启用，0=禁用</param>
public record EnvironmentUpdateRequest(string EnvironmentName, string? Description, int SortOrder, short Status);
