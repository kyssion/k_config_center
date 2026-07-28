namespace k_config_center.Models.Requests;

/// <summary>创建配置组请求</summary>
/// <param name="NamespaceId">所属命名空间 id，须与环境的命名空间一致</param>
/// <param name="EnvironmentId">所属环境 id</param>
/// <param name="GroupKey">配置组标识，同环境内唯一，创建后不可改</param>
/// <param name="GroupName">配置组显示名称</param>
/// <param name="Description">描述，可空</param>
public record ConfigurationGroupCreateRequest(long NamespaceId, long EnvironmentId, string GroupKey, string GroupName, string? Description);

/// <summary>更新配置组请求：key 与所属环境不可改，仅名称/描述/状态</summary>
/// <param name="GroupName">配置组显示名称</param>
/// <param name="Description">描述，可空</param>
/// <param name="Status">状态：1=启用，0=禁用</param>
public record ConfigurationGroupUpdateRequest(string GroupName, string? Description, short Status);
