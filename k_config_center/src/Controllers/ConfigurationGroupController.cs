using k_config_center.Infrastructure;
using k_config_center.Models.Requests;
using k_config_center.Services;
using Microsoft.AspNetCore.Mvc;

namespace k_config_center.Controllers;

/// <summary>配置组管理：CRUD 走 ConfigurationGroupService，组级发布（事务型操作）走 PublishService；
/// 控制器只做参数接收 + 调 Service + 包装 ApiResponse</summary>
[ApiController]
[Route("api/configuration-groups")]
public class ConfigurationGroupController(ConfigurationGroupService configurationGroupService, PublishService publishService) : ControllerBase
{
    /// <summary>配置组列表</summary>
    /// <remarks>两个过滤条件均可选（可组合），已软删除的记录不返回</remarks>
    /// <param name="namespaceId">按命名空间过滤（可选）</param>
    /// <param name="environmentId">按环境过滤（可选）</param>
    /// <returns>data 为 ConfigurationGroupResponse 数组</returns>
    [HttpGet]
    public async Task<object> List(long? namespaceId, long? environmentId) =>
        ApiResponse.Ok(await configurationGroupService.ListAsync(namespaceId, environmentId));

    /// <summary>创建配置组</summary>
    /// <remarks>groupKey 在同环境内唯一（仅约束未软删除记录），重复返回 20003；创建后 key 与所属环境不可改</remarks>
    /// <param name="request">创建参数：命名空间 id、环境 id、key、名称、描述</param>
    /// <returns>data 为新建的 ConfigurationGroupResponse（含数据库生成的 id）</returns>
    [HttpPost]
    public async Task<object> Create(ConfigurationGroupCreateRequest request) =>
        ApiResponse.Ok(await configurationGroupService.CreateAsync(request));

    /// <summary>更新配置组（名称 / 描述 / 状态）</summary>
    /// <remarks>key 与所属环境不可改；目标不存在或已软删除返回 10002</remarks>
    /// <param name="id">配置组 id</param>
    /// <param name="request">更新参数：名称、描述、状态（1 启用 / 0 禁用）</param>
    /// <returns>data 为 null，code=0 表示成功</returns>
    [HttpPut("{id:long}")]
    public async Task<object> Update(long id, ConfigurationGroupUpdateRequest request)
    {
        await configurationGroupService.UpdateAsync(id, request);
        return ApiResponse.Ok();
    }

    /// <summary>组级发布</summary>
    /// <remarks>一个事务内把组内全部「有未发布变更且未下线」的配置逐条发布（每条各自递增版本号、生成快照、切换生效指针，
    /// 版本语义与单条发布一致，整组原子生效）；已下线配置不动（不复活），无变更配置跳过；
    /// 组不存在返回 10002；data 为 { items: [{ configurationId, configurationKey, versionNumber }], skippedCount }</remarks>
    /// <param name="id">配置组 id</param>
    /// <param name="request">发布参数：变更备注（可选，写入组内每条快照）</param>
    /// <returns>data 为 GroupPublishResponse（发布清单 + 跳过条数）</returns>
    [HttpPost("{id:long}/publish")]
    public async Task<object> Publish(long id, PublishRequest request) =>
        ApiResponse.Ok(await publishService.GroupPublishAsync(id, request));

    /// <summary>删除配置组（软删除）</summary>
    /// <remarks>只置 deleted_at，不做物理删除；存在未删除的配置项时拒绝并返回 20004；软删除后同 key 可重建</remarks>
    /// <param name="id">配置组 id</param>
    /// <returns>data 为 null，code=0 表示成功</returns>
    [HttpDelete("{id:long}")]
    public async Task<object> Delete(long id)
    {
        await configurationGroupService.DeleteAsync(id);
        return ApiResponse.Ok();
    }
}
