using k_config_center.Models.Domain;

namespace k_config_center.Models.Responses;

/// <summary>配置项响应模型（列表项/详情共用）：附「有未发布变更」标记，前端不做 md5 对比</summary>
/// <param name="Id">配置 id</param>
/// <param name="GroupId">所属配置组 id</param>
/// <param name="NamespaceId">所属命名空间 id</param>
/// <param name="EnvironmentId">所属环境 id</param>
/// <param name="ConfigurationKey">配置标识，同配置组内唯一</param>
/// <param name="Content">当前编辑态内容（草稿），可空</param>
/// <param name="Format">内容格式：text/json/yaml/properties</param>
/// <param name="Md5">当前内容的 md5，可空</param>
/// <param name="Description">描述，可空</param>
/// <param name="Tags">标签（逗号分隔），可空</param>
/// <param name="Status">状态：DRAFT/PUBLISHED/OFFLINE</param>
/// <param name="PublishedVersionId">当前生效的版本快照 id，未发布过为 null</param>
/// <param name="LatestVersionNumber">已分配的最大版本号，未发布过为 0</param>
/// <param name="PublishedAt">最近一次发布时间（UTC），未发布过为 null</param>
/// <param name="CreatedBy">创建人，可空</param>
/// <param name="UpdatedBy">最后更新人，可空</param>
/// <param name="CreatedAt">创建时间（UTC）</param>
/// <param name="UpdatedAt">最后更新时间（UTC）</param>
/// <param name="HasUnpublishedChange">当前内容与生效版本快照是否存在差异（含从未发布）</param>
/// <param name="NamespaceName">所属命名空间显示名称（联表冗余，关联不到为 null）</param>
/// <param name="EnvironmentName">所属环境显示名称（联表冗余，关联不到为 null）</param>
/// <param name="GroupName">所属配置组显示名称（联表冗余，关联不到为 null）</param>
/// <param name="NamespaceKey">所属命名空间业务 key（联表冗余，关联不到为 null）</param>
/// <param name="EnvironmentKey">所属环境业务 key（联表冗余，关联不到为 null）</param>
/// <param name="GroupKey">所属配置组业务 key（联表冗余，关联不到为 null）</param>
public record ConfigurationResponse(long Id, long GroupId, long NamespaceId, long EnvironmentId, string ConfigurationKey,
    string? Content, string Format, string? Md5, string? Description, string? Tags, string Status,
    long? PublishedVersionId, long LatestVersionNumber, DateTimeOffset? PublishedAt,
    string? CreatedBy, string? UpdatedBy, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, bool HasUnpublishedChange,
    string? NamespaceName = null, string? EnvironmentName = null, string? GroupName = null,
    string? NamespaceKey = null, string? EnvironmentKey = null, string? GroupKey = null)
{
    public static ConfigurationResponse From(ConfigurationData data, bool hasUnpublishedChange) =>
        new(data.Id, data.GroupId, data.NamespaceId, data.EnvironmentId, data.ConfigurationKey,
            data.Content, data.Format, data.Md5, data.Description, data.Tags, data.Status,
            data.PublishedVersionId, data.LatestVersionNumber, data.PublishedAt,
            data.CreatedBy, data.UpdatedBy, data.CreatedAt, data.UpdatedAt, hasUnpublishedChange,
            data.NamespaceName, data.EnvironmentName, data.GroupName,
            data.NamespaceKey, data.EnvironmentKey, data.GroupKey);
}

/// <summary>配置详情响应：当前编辑态 + 生效版本信息（未发布过则为 null）</summary>
/// <param name="Configuration">当前编辑态配置</param>
/// <param name="PublishedVersion">当前生效的版本快照，未发布过为 null</param>
public record ConfigurationDetailResponse(ConfigurationResponse Configuration, ConfigurationVersionResponse? PublishedVersion);

/// <summary>配置版本快照响应模型</summary>
/// <param name="Id">版本快照 id</param>
/// <param name="ConfigurationId">所属配置 id</param>
/// <param name="VersionNumber">版本号，同配置内单调递增</param>
/// <param name="Content">发布时定格的内容快照，可空</param>
/// <param name="Format">发布时的内容格式，可空</param>
/// <param name="Md5">快照内容的 md5，可空</param>
/// <param name="ChangeType">变更类型：CREATE/UPDATE/ROLLBACK</param>
/// <param name="ChangeRemark">变更备注，可空</param>
/// <param name="CreatedBy">发布人，可空</param>
/// <param name="CreatedAt">发布时间（UTC）</param>
public record ConfigurationVersionResponse(long Id, long ConfigurationId, long VersionNumber, string? Content, string? Format,
    string? Md5, string ChangeType, string? ChangeRemark, string? CreatedBy, DateTimeOffset CreatedAt)
{
    public static ConfigurationVersionResponse From(ConfigurationVersionData data) =>
        new(data.Id, data.ConfigurationId, data.VersionNumber, data.Content, data.Format,
            data.Md5, data.ChangeType, data.ChangeRemark, data.CreatedBy, data.CreatedAt);
}

/// <summary>发布/回滚结果：新生成的版本快照 id 与版本号</summary>
/// <param name="VersionId">新生成的版本快照 id</param>
/// <param name="VersionNumber">新生成的版本号</param>
public record PublishResponse(long VersionId, long VersionNumber);
