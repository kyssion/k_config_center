namespace k_config_center.Models.Domain;

/// <summary>命名空间业务数据：Repository 对外的数据形态，实体（Entities）不出 Repository 层。
/// Id 为 0 表示尚未落库（新建场景），插入后由 Repository 回填数据库生成的自增 id</summary>
public record NamespaceData(long Id, string NamespaceKey, string NamespaceName, string? Description, short Status,
    string? CreatedBy, string? UpdatedBy, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

/// <summary>环境业务数据（环境表无 created_by/updated_by 列，故无对应字段）</summary>
public record EnvironmentData(long Id, long NamespaceId, string EnvironmentKey, string EnvironmentName, string? Description,
    int SortOrder, short Status, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

/// <summary>配置组业务数据</summary>
public record ConfigurationGroupData(long Id, long NamespaceId, long EnvironmentId, string GroupKey, string GroupName,
    string? Description, short Status, string? CreatedBy, string? UpdatedBy, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
