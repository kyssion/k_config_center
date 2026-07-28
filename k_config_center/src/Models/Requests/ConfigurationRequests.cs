namespace k_config_center.Models.Requests;

/// <summary>新建配置请求：md5 由服务端计算，不信任前端传值</summary>
/// <param name="GroupId">所属配置组 id</param>
/// <param name="ConfigurationKey">配置标识，同配置组内唯一，创建后不可改</param>
/// <param name="Content">配置内容，可空</param>
/// <param name="Format">内容格式：text/json/yaml/properties，缺省 text</param>
/// <param name="Description">描述，可空</param>
/// <param name="Tags">标签（逗号分隔），可空</param>
public record ConfigurationCreateRequest(long GroupId, string ConfigurationKey, string? Content, string Format = "text", string? Description = null, string? Tags = null);

/// <summary>保存编辑请求：只更新当前态字段，不产生版本</summary>
/// <param name="Content">配置内容，可空</param>
/// <param name="Format">内容格式：text/json/yaml/properties，缺省 text</param>
/// <param name="Description">描述，可空</param>
/// <param name="Tags">标签（逗号分隔），可空</param>
public record ConfigurationUpdateRequest(string? Content, string Format = "text", string? Description = null, string? Tags = null);

/// <summary>发布请求：变更备注</summary>
/// <param name="ChangeRemark">变更备注，写入版本快照，可空</param>
public record PublishRequest(string? ChangeRemark);

/// <summary>回滚请求：目标历史版本号 + 可选备注</summary>
/// <param name="VersionNumber">要回滚到的历史版本号，不存在时返回 30003</param>
/// <param name="ChangeRemark">变更备注，缺省自动生成“回滚自 vN”，可空</param>
public record RollbackRequest(long VersionNumber, string? ChangeRemark);
