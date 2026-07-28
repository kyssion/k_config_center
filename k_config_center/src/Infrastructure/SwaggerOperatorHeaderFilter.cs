using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace k_config_center.Infrastructure;

/// <summary>Swagger 操作过滤器：为所有非 GET 操作（写操作）统一补充 X-Operator 请求头参数说明。
/// 操作人由 OperationHelper 从该请求头提取后写入审计日志（缺省 system）；
/// 集中在此声明一次即可覆盖全部写操作，无需逐 action 标注——最少代码的做法</summary>
public class SwaggerOperatorHeaderFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        // 只读操作（GET）不写审计日志，无需该请求头
        if (string.Equals(context.ApiDescription.HttpMethod, "GET", StringComparison.OrdinalIgnoreCase)) return;

        operation.Parameters ??= [];
        operation.Parameters.Add(new OpenApiParameter
        {
            Name = "X-Operator",
            In = ParameterLocation.Header,
            Required = false,
            Description = "操作人标识（写入审计日志 operator 字段），可选，缺省记为 system",
            Schema = new OpenApiSchema { Type = JsonSchemaType.String }
        });
    }
}
