namespace k_config_center.Infrastructure;

/// <summary>统一响应包裹 { code, message, data }：HTTP 一律 200，业务失败由 code 表达（后端方案 7.1）</summary>
public static class ApiResponse
{
    public static object Ok(object? data = null) => new { code = 0, message = "success", data };
    public static object Fail(int code, string message) => new { code, message, data = (object?)null };
}
