using k_config_center.Infrastructure;
using k_config_center.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace k_config_center.Controllers;

/// <summary>健康检查：验证数据库连接与实体映射的连通性入口。
/// 数据库访问经 NamespaceRepository（分层规则：Controller 不接触 ISqlSugarClient 与 Entities）</summary>
[ApiController]
[Route("api/health")]
public class HealthController(NamespaceRepository namespaceRepository, ILogger<HealthController> logger) : ControllerBase
{
    /// <summary>数据库连通性检查：对 config_center_namespace 做一次轻量 Count 查询；
    /// 返回统一响应结构 { code, message, data }，失败时异常详情只记日志不透给客户端</summary>
    [HttpGet("database")]
    public async Task<IActionResult> CheckDatabase()
    {
        try
        {
            var namespaceCount = await namespaceRepository.CountAsync();
            return Ok(ApiResponse.Ok(new { canConnect = true, namespaceCount }));
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "健康检查：数据库连接失败");
            return Ok(ApiResponse.Fail(10000, "数据库连接失败"));
        }
    }
}
