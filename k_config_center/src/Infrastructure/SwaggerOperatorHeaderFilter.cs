using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace k_config_center.Infrastructure;

/// <summary>Swagger 操作过滤器：集中补齐两个横切请求头声明，无需逐 action 标注——最少代码的做法。
/// X-Api-Key：所有操作（服务端启用 Auth:Enabled 后必填，见 ApiKeyMiddleware）；
/// X-Operator：仅写操作（操作人写审计日志，缺省 system）</summary>
public class SwaggerOperatorHeaderFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        operation.Parameters ??= [];
        operation.Parameters.Add(new OpenApiParameter
        {
            Name = "X-Api-Key",
            In = ParameterLocation.Header,
            Required = false,
            Description = "服务端启用 API Key 鉴权（Auth:Enabled=true）时必填，否则返回 10004",
            Schema = new OpenApiSchema { Type = JsonSchemaType.String }
        });

        // 只读操作（GET）不写审计日志，无需操作人请求头
        if (string.Equals(context.ApiDescription.HttpMethod, "GET", StringComparison.OrdinalIgnoreCase)) return;

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
