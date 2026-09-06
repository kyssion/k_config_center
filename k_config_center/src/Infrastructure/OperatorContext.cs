namespace k_config_center.Infrastructure;

/// <summary>当前请求的操作人上下文：注册时从 HttpContext 提取一次（X-Operator 头 + 客户端 IP），
/// 业务层只依赖这两个值而不接触 HttpRequest/Web 类型，便于脱离 Web 宿主做单元测试</summary>
public record OperatorContext(string Operator, string? ClientIpAddress);
