using SqlSugar;

namespace k_config_center.Entities;

/// <summary>配置版本表：发布历史快照，记录不可变</summary>
[SugarTable("config_center_configuration_version")]
public class ConfigCenterConfigurationVersion
{
    [SugarColumn(ColumnName = "id", IsPrimaryKey = true, IsIdentity = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnName = "configuration_id")]
    public long ConfigurationId { get; set; }

    [SugarColumn(ColumnName = "version_number")]
    public long VersionNumber { get; set; }

    [SugarColumn(ColumnName = "content", ColumnDataType = "text", IsNullable = true)]
    public string? Content { get; set; }

    [SugarColumn(ColumnName = "format", Length = 16, IsNullable = true)]
    public string? Format { get; set; }

    [SugarColumn(ColumnName = "md5", Length = 32, IsNullable = true)]
    public string? Md5 { get; set; }

    [SugarColumn(ColumnName = "change_type", Length = 16)]
    public string ChangeType { get; set; } = "UPDATE"; // CREATE/UPDATE/DELETE/ROLLBACK/IMPORT

    [SugarColumn(ColumnName = "change_remark", Length = 512, IsNullable = true)]
    public string? ChangeRemark { get; set; }

    [SugarColumn(ColumnName = "created_by", Length = 64, IsNullable = true)]
    public string? CreatedBy { get; set; }

    [SugarColumn(ColumnName = "created_at", ColumnDataType = "timestamptz")]
    public DateTimeOffset CreatedAt { get; set; }
}
