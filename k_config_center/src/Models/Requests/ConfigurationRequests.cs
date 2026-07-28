namespace k_config_center.Models.Requests;

/// <summary>新建配置请求：md5 由服务端计算，不信任前端传值</summary>
public record ConfigurationCreateRequest(long GroupId, string ConfigurationKey, string? Content, string Format = "text", string? Description = null, string? Tags = null);

/// <summary>保存编辑请求：只更新当前态字段，不产生版本</summary>
public record ConfigurationUpdateRequest(string? Content, string Format = "text", string? Description = null, string? Tags = null);

/// <summary>发布请求：变更备注</summary>
public record PublishRequest(string? ChangeRemark);

/// <summary>回滚请求：目标历史版本号 + 可选备注</summary>
public record RollbackRequest(long VersionNumber, string? ChangeRemark);
