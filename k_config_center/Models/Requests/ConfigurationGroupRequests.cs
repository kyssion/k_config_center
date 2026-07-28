namespace k_config_center.Models.Requests;

/// <summary>创建配置组请求</summary>
public record ConfigurationGroupCreateRequest(long NamespaceId, long EnvironmentId, string GroupKey, string GroupName, string? Description);

/// <summary>更新配置组请求：key 与所属环境不可改，仅名称/描述/状态</summary>
public record ConfigurationGroupUpdateRequest(string GroupName, string? Description, short Status);
