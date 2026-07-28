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
    /// <summary>命名空间下环境列表</summary>
    /// <remarks>按 sort_order 升序排列，已软删除的记录不返回</remarks>
    /// <param name="namespaceId">所属命名空间 id（必填）</param>
    /// <returns>data 为 EnvironmentResponse 数组</returns>
    [HttpGet]
    public async Task<object> List(long namespaceId) =>
        ApiResponse.Ok(await environmentService.ListAsync(namespaceId));

    /// <summary>创建环境</summary>
    /// <remarks>environmentKey 在同命名空间内唯一（仅约束未软删除记录），重复返回 20002；创建后 key 与所属命名空间不可改</remarks>
    /// <param name="request">创建参数：命名空间 id、key、名称、描述、排序</param>
    /// <returns>data 为新建的 EnvironmentResponse（含数据库生成的 id）</returns>
    [HttpPost]
    public async Task<object> Create(EnvironmentCreateRequest request) =>
        ApiResponse.Ok(await environmentService.CreateAsync(request));

    /// <summary>更新环境（名称 / 描述 / 排序 / 状态）</summary>
    /// <remarks>key 与所属命名空间不可改；目标不存在或已软删除返回 10002</remarks>
    /// <param name="id">环境 id</param>
    /// <param name="request">更新参数：名称、描述、排序、状态（1 启用 / 0 禁用）</param>
    /// <returns>data 为 null，code=0 表示成功</returns>
    [HttpPut("{id:long}")]
    public async Task<object> Update(long id, EnvironmentUpdateRequest request)
    {
        await environmentService.UpdateAsync(id, request);
        return ApiResponse.Ok();
    }

    /// <summary>删除环境（软删除）</summary>
    /// <remarks>只置 deleted_at，不做物理删除；存在未删除的下级配置组时拒绝并返回 20004；软删除后同 key 可重建</remarks>
    /// <param name="id">环境 id</param>
    /// <returns>data 为 null，code=0 表示成功</returns>
    [HttpDelete("{id:long}")]
    public async Task<object> Delete(long id)
    {
        await environmentService.DeleteAsync(id);
        return ApiResponse.Ok();
    }
}
