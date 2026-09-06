using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace k_config_center.Infrastructure;

/// <summary>参数校验过滤器：Program.cs 已关闭 ApiController 的自动 400（ProblemDetails 响应），
/// 校验失败统一在这里转 BusinessException(10003)，走全局异常中间件保持 { code, message, data } 契约（HTTP 恒 200）</summary>
public class ModelValidationFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (context.ModelState.IsValid)
        {
            await next();
            return;
        }
        // 取第一条校验错误给出可读信息；异常型错误（如 JSON 解析失败）ErrorMessage 可能为空，回退到异常消息
        var error = context.ModelState.Values
            .SelectMany(value => value.Errors)
            .Select(modelError => !string.IsNullOrEmpty(modelError.ErrorMessage) ? modelError.ErrorMessage : modelError.Exception?.Message)
            .FirstOrDefault(message => !string.IsNullOrEmpty(message));
        throw new BusinessException(ErrorCode.InvalidParameter, $"参数校验失败：{error ?? "请求体不合法"}");
    }
}
