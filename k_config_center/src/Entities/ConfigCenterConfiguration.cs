using SqlSugar;

namespace k_config_center.Entities;

/// <summary>配置表（当前态）：配置项最新内容与发布状态</summary>
[SugarTable("config_center_configuration")]
public class ConfigCenterConfiguration
{
    [SugarColumn(ColumnName = "id", IsPrimaryKey = true, IsIdentity = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnName = "group_id")]
    public long GroupId { get; set; }

    [SugarColumn(ColumnName = "namespace_id")]
    public long NamespaceId { get; set; }          // 冗余，避免 JOIN

    [SugarColumn(ColumnName = "environment_id")]
    public long EnvironmentId { get; set; }        // 冗余，避免 JOIN

    [SugarColumn(ColumnName = "configuration_key", Length = 256)]
    public string ConfigurationKey { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "content", ColumnDataType = "text", IsNullable = true)]
    public string? Content { get; set; }

    [SugarColumn(ColumnName = "format", Length = 16)]
    public string Format { get; set; } = "text";   // text/json/yaml/properties/xml/toml

    [SugarColumn(ColumnName = "md5", Length = 32, IsNullable = true)]
    public string? Md5 { get; set; }

    [SugarColumn(ColumnName = "description", Length = 512, IsNullable = true)]
    public string? Description { get; set; }

    [SugarColumn(ColumnName = "tags", Length = 256, IsNullable = true)]
    public string? Tags { get; set; }

    [SugarColumn(ColumnName = "status", Length = 16)]
    public string Status { get; set; } = "DRAFT";  // DRAFT/PUBLISHED/OFFLINE

    [SugarColumn(ColumnName = "published_version_id", IsNullable = true)]
    public long? PublishedVersionId { get; set; }

    [SugarColumn(ColumnName = "latest_version_number")]
    public long LatestVersionNumber { get; set; }

    [SugarColumn(ColumnName = "published_at", ColumnDataType = "timestamptz", IsNullable = true)]
    public DateTimeOffset? PublishedAt { get; set; }

    [SugarColumn(ColumnName = "deleted_at", ColumnDataType = "timestamptz", IsNullable = true)]
    public DateTimeOffset? DeletedAt { get; set; } // 软删除标记

    [SugarColumn(ColumnName = "created_by", Length = 64, IsNullable = true)]
    public string? CreatedBy { get; set; }

    [SugarColumn(ColumnName = "updated_by", Length = 64, IsNullable = true)]
    public string? UpdatedBy { get; set; }

    [SugarColumn(ColumnName = "created_at", ColumnDataType = "timestamptz")]
    public DateTimeOffset CreatedAt { get; set; }

    [SugarColumn(ColumnName = "updated_at", ColumnDataType = "timestamptz")]
    public DateTimeOffset UpdatedAt { get; set; }
}
