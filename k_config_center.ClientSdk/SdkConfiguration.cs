namespace k_config_center.ClientSdk;

/// <summary>一条已发布配置（来自配置中心的生效版本快照，非编辑中的草稿）</summary>
/// <param name="Key">配置 key</param>
/// <param name="Content">配置内容，可空</param>
/// <param name="Format">内容格式：text/json/yaml/properties/xml/toml</param>
/// <param name="Md5">内容 md5，可空</param>
/// <param name="VersionNumber">拉取时生效的版本号</param>
public sealed record SdkConfiguration(string Key, string? Content, string Format, string? Md5, long VersionNumber);
