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
    /// <remarks>当前为全量列表（分页为后续演进项），已软删除的记录不返回</remarks>
    /// <returns>data 为 NamespaceResponse 数组</returns>
    [HttpGet]
    public async Task<object> List() => ApiResponse.Ok(await namespaceService.ListAsync());

    /// <summary>创建命名空间</summary>
    /// <remarks>namespaceKey 全局唯一（仅约束未软删除记录），重复返回 20001；创建后 key 不可改</remarks>
    /// <param name="request">创建参数：key、名称、描述</param>
    /// <returns>data 为新建的 NamespaceResponse（含数据库生成的 id）</returns>
    [HttpPost]
    public async Task<object> Create(NamespaceCreateRequest request) =>
        ApiResponse.Ok(await namespaceService.CreateAsync(request));

    /// <summary>更新命名空间（名称 / 描述 / 状态）</summary>
    /// <remarks>key 不可改；目标不存在或已软删除返回 10002</remarks>
    /// <param name="id">命名空间 id</param>
    /// <param name="request">更新参数：名称、描述、状态（1 启用 / 0 禁用）</param>
    /// <returns>data 为 null，code=0 表示成功</returns>
    [HttpPut("{id:long}")]
    public async Task<object> Update(long id, NamespaceUpdateRequest request)
    {
        await namespaceService.UpdateAsync(id, request);
        return ApiResponse.Ok();
    }

    /// <summary>删除命名空间（软删除）</summary>
    /// <remarks>只置 deleted_at，不做物理删除；存在未删除的下级环境时拒绝并返回 20004（需先自底向上清空）；软删除后同 key 可重建</remarks>
    /// <param name="id">命名空间 id</param>
    /// <returns>data 为 null，code=0 表示成功</returns>
    [HttpDelete("{id:long}")]
    public async Task<object> Delete(long id)
    {
        await namespaceService.DeleteAsync(id);
        return ApiResponse.Ok();
    }
}
