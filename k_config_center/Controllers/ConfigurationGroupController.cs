using k_config_center.Infrastructure;
using k_config_center.Models.Requests;
using k_config_center.Services;
using Microsoft.AspNetCore.Mvc;

namespace k_config_center.Controllers;

/// <summary>配置组管理：仅做参数接收 + 调 Service + 包装 ApiResponse，业务逻辑在 ConfigurationGroupService</summary>
[ApiController]
[Route("api/configuration-groups")]
public class ConfigurationGroupController(ConfigurationGroupService configurationGroupService) : ControllerBase
{
    /// <summary>环境下配置组列表（namespaceId / environmentId 过滤均可选）</summary>
    [HttpGet]
    public async Task<object> List(long? namespaceId, long? environmentId) =>
        ApiResponse.Ok(await configurationGroupService.ListAsync(namespaceId, environmentId));

    /// <summary>创建配置组</summary>
    [HttpPost]
    public async Task<object> Create(ConfigurationGroupCreateRequest request) =>
        ApiResponse.Ok(await configurationGroupService.CreateAsync(request));

    /// <summary>更新名称 / 描述 / 状态</summary>
    [HttpPut("{id:long}")]
    public async Task<object> Update(long id, ConfigurationGroupUpdateRequest request)
    {
        await configurationGroupService.UpdateAsync(id, request);
        return ApiResponse.Ok();
    }

    /// <summary>软删除（存在未删除的配置项时拒绝，20004）</summary>
    [HttpDelete("{id:long}")]
    public async Task<object> Delete(long id)
    {
        await configurationGroupService.DeleteAsync(id);
        return ApiResponse.Ok();
    }
}
