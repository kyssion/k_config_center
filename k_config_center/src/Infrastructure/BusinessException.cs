namespace k_config_center.Infrastructure;

/// <summary>业务异常：携带业务错误码（后端方案 7.1 分段约定），由全局异常处理中间件
/// 统一转为 { code, message, data: null } 响应（HTTP 仍返 200，错误由 code 表达）</summary>
public class BusinessException(int code, string message) : Exception(message)
{
    public BusinessException(ErrorCode code, string message) : this((int)code, message) { }

    public int Code { get; } = code;
}
