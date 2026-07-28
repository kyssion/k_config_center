using SqlSugar;

namespace k_config_center.Entities;

/// <summary>环境表：命名空间下的环境（dev/test/staging/prod）</summary>
[SugarTable("config_center_environment")]
public class ConfigCenterEnvironment
{
    [SugarColumn(ColumnName = "id", IsPrimaryKey = true, IsIdentity = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnName = "namespace_id")]
    public long NamespaceId { get; set; }

    [SugarColumn(ColumnName = "environment_key", Length = 64)]
    public string EnvironmentKey { get; set; } = string.Empty;   // dev/test/staging/prod

    [SugarColumn(ColumnName = "environment_name", Length = 128)]
    public string EnvironmentName { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "description", Length = 512, IsNullable = true)]
    public string? Description { get; set; }

    [SugarColumn(ColumnName = "sort_order")]
    public int SortOrder { get; set; }

    [SugarColumn(ColumnName = "status")]
    public short Status { get; set; } = 1;

    [SugarColumn(ColumnName = "deleted_at", ColumnDataType = "timestamptz", IsNullable = true)]
    public DateTimeOffset? DeletedAt { get; set; } // 软删除标记

    [SugarColumn(ColumnName = "created_at", ColumnDataType = "timestamptz")]
    public DateTimeOffset CreatedAt { get; set; }

    [SugarColumn(ColumnName = "updated_at", ColumnDataType = "timestamptz")]
    public DateTimeOffset UpdatedAt { get; set; }
}
