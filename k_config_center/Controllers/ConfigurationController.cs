using k_config_center.Infrastructure;
using k_config_center.Models.Requests;
using k_config_center.Services;
using Microsoft.AspNetCore.Mvc;

namespace k_config_center.Controllers;

/// <summary>配置项管理：编辑（草稿）/详情/版本历史走 ConfigurationService，
/// 发布/回滚/下线（事务型操作）走 PublishService；控制器只做参数接收与响应包装</summary>
[ApiController]
[Route("api/configurations")]
public class ConfigurationController(ConfigurationService configurationService, PublishService publishService) : ControllerBase
{
    /// <summary>配置项列表（含「有未发布变更」标记，status / keyword 过滤可选）</summary>
    [HttpGet]
    public async Task<object> List(long groupId, string? status, string? keyword) =>
        ApiResponse.Ok(await configurationService.ListAsync(groupId, status, keyword));

    /// <summary>配置详情（当前编辑态 + 生效版本信息）</summary>
    [HttpGet("{id:long}")]
    public async Task<object> Get(long id) =>
        ApiResponse.Ok(await configurationService.GetAsync(id));

    /// <summary>新建配置（DRAFT，md5 服务端计算）</summary>
    [HttpPost]
    public async Task<object> Create(ConfigurationCreateRequest request) =>
        ApiResponse.Ok(await configurationService.CreateAsync(request));

    /// <summary>保存编辑（更新 content / format / md5，不产生版本）</summary>
    [HttpPut("{id:long}")]
    public async Task<object> Update(long id, ConfigurationUpdateRequest request)
    {
        await configurationService.UpdateAsync(id, request);
        return ApiResponse.Ok();
    }

    /// <summary>软删除（置 deleted_at，不做物理删除）</summary>
    [HttpDelete("{id:long}")]
    public async Task<object> Delete(long id)
    {
        await configurationService.DeleteAsync(id);
        return ApiResponse.Ok();
    }

    /// <summary>发布：版本号 +1、写快照、更新生效指针</summary>
    [HttpPost("{id:long}/publish")]
    public async Task<object> Publish(long id, PublishRequest request) =>
        ApiResponse.Ok(await publishService.PublishAsync(id, request));

    /// <summary>回滚：以目标 versionNumber 的内容重新发布</summary>
    [HttpPost("{id:long}/rollback")]
    public async Task<object> Rollback(long id, RollbackRequest request) =>
        ApiResponse.Ok(await publishService.RollbackAsync(id, request));

    /// <summary>下线：status 置 OFFLINE</summary>
    [HttpPost("{id:long}/offline")]
    public async Task<object> Offline(long id)
    {
        await publishService.OfflineAsync(id);
        return ApiResponse.Ok();
    }

    /// <summary>版本历史列表（按 version_number 倒序分页）</summary>
    [HttpGet("{id:long}/versions")]
    public async Task<object> ListVersions(long id, int pageIndex = 1, int pageSize = 20) =>
        ApiResponse.Ok(await configurationService.ListVersionsAsync(id, pageIndex, pageSize));

    /// <summary>单个版本快照内容（供 Diff 取数）</summary>
    [HttpGet("{id:long}/versions/{versionNumber:long}")]
    public async Task<object> GetVersion(long id, long versionNumber) =>
        ApiResponse.Ok(await configurationService.GetVersionAsync(id, versionNumber));
}
