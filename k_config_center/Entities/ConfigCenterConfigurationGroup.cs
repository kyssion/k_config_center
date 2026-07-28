using SqlSugar;

namespace k_config_center.Entities;

/// <summary>配置组表：环境下的配置分组</summary>
[SugarTable("config_center_configuration_group")]
public class ConfigCenterConfigurationGroup
{
    [SugarColumn(ColumnName = "id", IsPrimaryKey = true, IsIdentity = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnName = "namespace_id")]
    public long NamespaceId { get; set; }

    [SugarColumn(ColumnName = "environment_id")]
    public long EnvironmentId { get; set; }

    [SugarColumn(ColumnName = "group_key", Length = 128)]
    public string GroupKey { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "group_name", Length = 128)]
    public string GroupName { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "description", Length = 512, IsNullable = true)]
    public string? Description { get; set; }

    [SugarColumn(ColumnName = "status")]
    public short Status { get; set; } = 1;

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
