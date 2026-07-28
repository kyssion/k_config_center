namespace k_config_center.Models.Domain;

/// <summary>配置项业务数据（当前编辑态）：Repository 对外的数据形态</summary>
public record ConfigurationData(long Id, long GroupId, long NamespaceId, long EnvironmentId, string ConfigurationKey,
    string? Content, string Format, string? Md5, string? Description, string? Tags, string Status,
    long? PublishedVersionId, long LatestVersionNumber, DateTimeOffset? PublishedAt,
    string? CreatedBy, string? UpdatedBy, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

/// <summary>配置版本快照业务数据（版本表不可变、不设软删除）</summary>
public record ConfigurationVersionData(long Id, long ConfigurationId, long VersionNumber, string? Content, string? Format,
    string? Md5, string ChangeType, string? ChangeRemark, string? CreatedBy, DateTimeOffset CreatedAt);
