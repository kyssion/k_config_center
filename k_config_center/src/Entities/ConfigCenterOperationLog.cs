using SqlSugar;

namespace k_config_center.Entities;

/// <summary>操作日志表：配置中心操作审计记录</summary>
[SugarTable("config_center_operation_log")]
public class ConfigCenterOperationLog
{
    [SugarColumn(ColumnName = "id", IsPrimaryKey = true, IsIdentity = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnName = "namespace_id", IsNullable = true)]
    public long? NamespaceId { get; set; }

    [SugarColumn(ColumnName = "environment_id", IsNullable = true)]
    public long? EnvironmentId { get; set; }

    [SugarColumn(ColumnName = "group_id", IsNullable = true)]
    public long? GroupId { get; set; }

    [SugarColumn(ColumnName = "configuration_id", IsNullable = true)]
    public long? ConfigurationId { get; set; }

    [SugarColumn(ColumnName = "operation", Length = 32)]
    public string Operation { get; set; } = string.Empty; // CREATE/UPDATE/PUBLISH/ROLLBACK/OFFLINE/DELETE

    // JSONB 列：属性为 string 时仅指定 ColumnDataType；
    // 若改为强类型对象/Dictionary，则加 IsJson = true 由 SqlSugar 自动序列化。
    [SugarColumn(ColumnName = "detail", ColumnDataType = "jsonb", IsNullable = true)]
    public string? Detail { get; set; }

    [SugarColumn(ColumnName = "operator", Length = 64, IsNullable = true)]
    public string? Operator { get; set; }

    [SugarColumn(ColumnName = "client_ip_address", Length = 64, IsNullable = true)]
    public string? ClientIpAddress { get; set; }

    [SugarColumn(ColumnName = "created_at", ColumnDataType = "timestamptz")]
    public DateTimeOffset CreatedAt { get; set; }
}
