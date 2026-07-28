using k_config_center.Infrastructure;
using k_config_center.Models.Requests;
using k_config_center.Services;
using Microsoft.AspNetCore.Mvc;

namespace k_config_center.Controllers;

/// <summary>命名空间管理：仅做参数接收 + 调 Service + 包装 ApiResponse，业务逻辑在 NamespaceService</summary>
[ApiController]
[Route("api/namespaces")]
public class NamespaceController(NamespaceService namespaceService) : ControllerBase
{
    /// <summary>命名空间列表</summary>
    [HttpGet]
    public async Task<object> List() => ApiResponse.Ok(await namespaceService.ListAsync());

    /// <summary>创建命名空间</summary>
    [HttpPost]
    public async Task<object> Create(NamespaceCreateRequest request) =>
        ApiResponse.Ok(await namespaceService.CreateAsync(request));

    /// <summary>更新名称 / 描述 / 状态</summary>
    [HttpPut("{id:long}")]
    public async Task<object> Update(long id, NamespaceUpdateRequest request)
    {
        await namespaceService.UpdateAsync(id, request);
        return ApiResponse.Ok();
    }

    /// <summary>软删除（存在未删除的下级环境时拒绝，20004）</summary>
    [HttpDelete("{id:long}")]
    public async Task<object> Delete(long id)
    {
        await namespaceService.DeleteAsync(id);
        return ApiResponse.Ok();
    }
}
