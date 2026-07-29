namespace k_config_center.Models.Domain;

/// <summary>客户端读取业务数据：五表联查（namespace→environment→group→configuration→version）的结果投影，
/// content/format/md5/versionNumber 取自 published_version_id 指向的版本快照而非编辑中的草稿</summary>
public record ClientConfigurationData(string ConfigurationKey, string? Content, string? Format, string? Md5, long VersionNumber);

/// <summary>操作日志业务数据（日志只读、不设软删除）。
/// 各维度 key/名称为联表带出的冗余字段（含已软删记录，供审计回溯），非本表列，关联不到为 null</summary>
public record OperationLogData(long Id, long? NamespaceId, long? EnvironmentId, long? GroupId, long? ConfigurationId,
    string Operation, string? Detail, string? Operator, string? ClientIpAddress, DateTimeOffset CreatedAt,
    string? NamespaceKey = null, string? NamespaceName = null, string? EnvironmentKey = null, string? EnvironmentName = null,
    string? GroupKey = null, string? GroupName = null, string? ConfigurationKey = null);
