using k_config_center.Models.Domain;

namespace k_config_center.Models.Responses;

/// <summary>配置项响应模型（列表项/详情共用）：附「有未发布变更」标记，前端不做 md5 对比</summary>
public record ConfigurationResponse(long Id, long GroupId, long NamespaceId, long EnvironmentId, string ConfigurationKey,
    string? Content, string Format, string? Md5, string? Description, string? Tags, string Status,
    long? PublishedVersionId, long LatestVersionNumber, DateTimeOffset? PublishedAt,
    string? CreatedBy, string? UpdatedBy, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, bool HasUnpublishedChange)
{
    public static ConfigurationResponse From(ConfigurationData data, bool hasUnpublishedChange) =>
        new(data.Id, data.GroupId, data.NamespaceId, data.EnvironmentId, data.ConfigurationKey,
            data.Content, data.Format, data.Md5, data.Description, data.Tags, data.Status,
            data.PublishedVersionId, data.LatestVersionNumber, data.PublishedAt,
            data.CreatedBy, data.UpdatedBy, data.CreatedAt, data.UpdatedAt, hasUnpublishedChange);
}

/// <summary>配置详情响应：当前编辑态 + 生效版本信息（未发布过则为 null）</summary>
public record ConfigurationDetailResponse(ConfigurationResponse Configuration, ConfigurationVersionResponse? PublishedVersion);

/// <summary>配置版本快照响应模型</summary>
public record ConfigurationVersionResponse(long Id, long ConfigurationId, long VersionNumber, string? Content, string? Format,
    string? Md5, string ChangeType, string? ChangeRemark, string? CreatedBy, DateTimeOffset CreatedAt)
{
    public static ConfigurationVersionResponse From(ConfigurationVersionData data) =>
        new(data.Id, data.ConfigurationId, data.VersionNumber, data.Content, data.Format,
            data.Md5, data.ChangeType, data.ChangeRemark, data.CreatedBy, data.CreatedAt);
}

/// <summary>发布/回滚结果：新生成的版本快照 id 与版本号</summary>
public record PublishResponse(long VersionId, long VersionNumber);
