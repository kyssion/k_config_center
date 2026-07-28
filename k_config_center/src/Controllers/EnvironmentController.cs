using k_config_center.Infrastructure;
using k_config_center.Models.Requests;
using k_config_center.Services;
using Microsoft.AspNetCore.Mvc;

namespace k_config_center.Controllers;

/// <summary>环境管理：仅做参数接收 + 调 Service + 包装 ApiResponse，业务逻辑在 EnvironmentService</summary>
[ApiController]
[Route("api/environments")]
public class EnvironmentController(EnvironmentService environmentService) : ControllerBase
{
    /// <summary>命名空间下环境列表（按 sort_order 排序）</summary>
    [HttpGet]
    public async Task<object> List(long namespaceId) =>
        ApiResponse.Ok(await environmentService.ListAsync(namespaceId));

    /// <summary>创建环境</summary>
    [HttpPost]
    public async Task<object> Create(EnvironmentCreateRequest request) =>
        ApiResponse.Ok(await environmentService.CreateAsync(request));

    /// <summary>更新名称 / 描述 / 排序 / 状态</summary>
    [HttpPut("{id:long}")]
    public async Task<object> Update(long id, EnvironmentUpdateRequest request)
    {
        await environmentService.UpdateAsync(id, request);
        return ApiResponse.Ok();
    }

    /// <summary>软删除（存在未删除的下级配置组时拒绝，20004）</summary>
    [HttpDelete("{id:long}")]
    public async Task<object> Delete(long id)
    {
        await environmentService.DeleteAsync(id);
        return ApiResponse.Ok();
    }
}
