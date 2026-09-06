using System.ComponentModel.DataAnnotations;

namespace k_config_center.Models.Requests;

/// <summary>创建配置组请求：校验长度与表结构对齐（group_key/group_name VARCHAR(128)）</summary>
/// <param name="NamespaceId">所属命名空间 id，须与环境的命名空间一致</param>
/// <param name="EnvironmentId">所属环境 id</param>
/// <param name="GroupKey">配置组标识，同环境内唯一，创建后不可改</param>
/// <param name="GroupName">配置组显示名称</param>
/// <param name="Description">描述，可空</param>
public record ConfigurationGroupCreateRequest(
    [Range(1, long.MaxValue)] long NamespaceId,
    [Range(1, long.MaxValue)] long EnvironmentId,
    [Required, StringLength(128)] string GroupKey,
    [Required, StringLength(128)] string GroupName,
    [StringLength(512)] string? Description);

/// <summary>更新配置组请求：key 与所属环境不可改，仅名称/描述/状态</summary>
/// <param name="GroupName">配置组显示名称</param>
/// <param name="Description">描述，可空</param>
/// <param name="Status">状态：1=启用，0=禁用</param>
public record ConfigurationGroupUpdateRequest(
    [Required, StringLength(128)] string GroupName,
    [StringLength(512)] string? Description,
    [Range(0, 1)] short Status);
