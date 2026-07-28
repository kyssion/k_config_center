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
    /// <summary>按组批量拉取已发布配置</summary>
    /// <remarks>只返回 status=PUBLISHED 且未软删除的配置，内容取自生效版本快照而非编辑中的草稿；三级 key 均为业务 key，客户端无需感知内部主键</remarks>
    /// <param name="namespaceKey">命名空间业务 key</param>
    /// <param name="environmentKey">环境业务 key</param>
    /// <param name="groupKey">配置组业务 key</param>
    /// <returns>data 为 ClientConfigurationResponse 数组（key、content、format、md5、versionNumber）</returns>
    [HttpGet("configurations")]
    public async Task<object> List(string namespaceKey, string environmentKey, string groupKey) =>
        ApiResponse.Ok(await clientConfigurationService.ListAsync(namespaceKey, environmentKey, groupKey));

    /// <summary>拉取单个已发布配置</summary>
    /// <remarks>同批量拉取的可见性规则（仅 PUBLISHED、读已发布快照）；配置不存在或未发布返回 10002</remarks>
    /// <param name="configurationKey">配置项业务 key</param>
    /// <param name="namespaceKey">命名空间业务 key</param>
    /// <param name="environmentKey">环境业务 key</param>
    /// <param name="groupKey">配置组业务 key</param>
    /// <returns>data 为 ClientConfigurationResponse</returns>
    [HttpGet("configurations/{configurationKey}")]
    public async Task<object> Get(string configurationKey, string namespaceKey, string environmentKey, string groupKey) =>
        ApiResponse.Ok(await clientConfigurationService.GetAsync(configurationKey, namespaceKey, environmentKey, groupKey));

    /// <summary>长轮询变更探测</summary>
    /// <remarks>客户端携带本地组指纹 md5（首次可不传）：服务端指纹不一致时立即返回 changed=true；
    /// 一致则挂起（**最长 30 秒**，期间每 2 秒对比一次）直到变更或超时返回 changed=false；
    /// changed=true 时客户端应重新拉取配置并用返回的 md5 作为新指纹</remarks>
    /// <param name="namespaceKey">命名空间业务 key</param>
    /// <param name="environmentKey">环境业务 key</param>
    /// <param name="groupKey">配置组业务 key</param>
    /// <param name="md5">客户端本地组指纹（可选，首次拉取前可不传）</param>
    /// <returns>data 为 ClientNotificationResponse（changed + 最新组指纹 md5）</returns>
    [HttpGet("notifications")]
    public async Task<object> WaitForChange(string namespaceKey, string environmentKey, string groupKey, string? md5) =>
        ApiResponse.Ok(await clientConfigurationService.WaitForChangeAsync(namespaceKey, environmentKey, groupKey, md5, HttpContext.RequestAborted));
}
