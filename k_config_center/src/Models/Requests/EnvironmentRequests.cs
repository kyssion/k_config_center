using System.ComponentModel.DataAnnotations;

namespace k_config_center.Models.Requests;

/// <summary>创建环境请求：校验长度与表结构对齐（environment_key VARCHAR(64)、environment_name VARCHAR(128)）</summary>
/// <param name="NamespaceId">所属命名空间 id</param>
/// <param name="EnvironmentKey">环境标识，同命名空间内唯一，创建后不可改</param>
/// <param name="EnvironmentName">环境显示名称</param>
/// <param name="Description">描述，可空</param>
/// <param name="SortOrder">排序值，列表按此升序展示</param>
public record EnvironmentCreateRequest(
    [Range(1, long.MaxValue)] long NamespaceId,
    [Required, StringLength(64)] string EnvironmentKey,
    [Required, StringLength(128)] string EnvironmentName,
    [StringLength(512)] string? Description,
    [Range(0, int.MaxValue)] int SortOrder);

/// <summary>更新环境请求：key 与所属命名空间不可改，仅名称/描述/排序/状态</summary>
/// <param name="EnvironmentName">环境显示名称</param>
/// <param name="Description">描述，可空</param>
/// <param name="SortOrder">排序值，列表按此升序展示</param>
/// <param name="Status">状态：1=启用，0=禁用</param>
public record EnvironmentUpdateRequest(
    [Required, StringLength(128)] string EnvironmentName,
    [StringLength(512)] string? Description,
    [Range(0, int.MaxValue)] int SortOrder,
    [Range(0, 1)] short Status);
