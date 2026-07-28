using k_config_center.Infrastructure;
using k_config_center.Services;
using Microsoft.AspNetCore.Mvc;

namespace k_config_center.Controllers;

/// <summary>客户端接口（后端方案 7.3，/api/client）：按业务 key（而非数据库 ID）读取已发布配置，
/// 只返回 status='PUBLISHED' 且未软删的配置；另提供长轮询变更探测</summary>
[ApiController]
[Route("api/client")]
public class ClientConfigurationController(ClientConfigurationService clientConfigurationService) : ControllerBase
{
    /// <summary>按组批量拉取已发布配置（key、content、format、md5、版本号）</summary>
    [HttpGet("configurations")]
    public async Task<object> List(string namespaceKey, string environmentKey, string groupKey) =>
        ApiResponse.Ok(await clientConfigurationService.ListAsync(namespaceKey, environmentKey, groupKey));

    /// <summary>拉取单个已发布配置</summary>
    [HttpGet("configurations/{configurationKey}")]
    public async Task<object> Get(string configurationKey, string namespaceKey, string environmentKey, string groupKey) =>
        ApiResponse.Ok(await clientConfigurationService.GetAsync(configurationKey, namespaceKey, environmentKey, groupKey));

    /// <summary>长轮询变更探测：携带客户端本地组指纹 md5，服务端不一致立即返回变更标记，
    /// 一致则挂起（最长 30 秒）直到变更或超时；客户端断开由 RequestAborted 取消挂起</summary>
    [HttpGet("notifications")]
    public async Task<object> WaitForChange(string namespaceKey, string environmentKey, string groupKey, string? md5) =>
        ApiResponse.Ok(await clientConfigurationService.WaitForChangeAsync(namespaceKey, environmentKey, groupKey, md5, HttpContext.RequestAborted));
}
