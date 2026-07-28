using SqlSugar;

namespace k_config_center.Entities;

/// <summary>命名空间表：配置中心顶层隔离单元</summary>
[SugarTable("config_center_namespace")]
public class ConfigCenterNamespace
{
    [SugarColumn(ColumnName = "id", IsPrimaryKey = true, IsIdentity = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnName = "namespace_key", Length = 128)]
    public string NamespaceKey { get; set; } = "public";

    [SugarColumn(ColumnName = "namespace_name", Length = 128)]
    public string NamespaceName { get; set; } = string.Empty;

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
