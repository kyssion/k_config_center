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
    /// <summary>配置项列表</summary>
    /// <remarks>返回当前编辑态，附「有未发布变更」hasUnpublishedChange 标记（服务端算好，前端不做 md5 对比）；已软删除的记录不返回</remarks>
    /// <param name="groupId">所属配置组 id（可选）</param>
    /// <param name="namespaceId">所属命名空间 id（可选）</param>
    /// <param name="environmentId">所属环境 id（可选）</param>
    /// <param name="status">按状态过滤（可选）：DRAFT / PUBLISHED / OFFLINE</param>
    /// <param name="keyword">按 key 模糊匹配（可选）</param>
    /// <returns>data 为 ConfigurationResponse 数组；各过滤参数可任意组合，全不传返回全量</returns>
    [HttpGet]
    public async Task<object> List(long? groupId, long? namespaceId, long? environmentId, string? status, string? keyword) =>
        ApiResponse.Ok(await configurationService.ListAsync(groupId, namespaceId, environmentId, status, keyword));

    /// <summary>配置详情</summary>
    /// <remarks>返回当前编辑态 + 生效版本快照（从未发布过则 publishedVersion 为 null）；不存在或已软删除返回 10002</remarks>
    /// <param name="id">配置项 id</param>
    /// <returns>data 为 ConfigurationDetailResponse（configuration + publishedVersion）</returns>
    [HttpGet("{id:long}")]
    public async Task<object> Get(long id) =>
        ApiResponse.Ok(await configurationService.GetAsync(id));

    /// <summary>新建配置</summary>
    /// <remarks>初始状态 DRAFT、版本号 0；md5 由服务端按内容计算，不信任前端传值；configurationKey 在同组内唯一，重复返回 30001</remarks>
    /// <param name="request">创建参数：配置组 id、key、内容、格式（text/json/yaml 等，默认 text）、描述、标签</param>
    /// <returns>data 为新建的 ConfigurationResponse（含数据库生成的 id）</returns>
    [HttpPost]
    public async Task<object> Create(ConfigurationCreateRequest request) =>
        ApiResponse.Ok(await configurationService.CreateAsync(request));

    /// <summary>保存编辑（草稿）</summary>
    /// <remarks>只更新当前态 content / format / md5 / 描述 / 标签，**不产生版本、不改变 status**，需发布后客户端才能读到；目标不存在返回 10002</remarks>
    /// <param name="id">配置项 id</param>
    /// <param name="request">编辑参数：内容、格式、描述、标签</param>
    /// <returns>data 为 null，code=0 表示成功</returns>
    [HttpPut("{id:long}")]
    public async Task<object> Update(long id, ConfigurationUpdateRequest request)
    {
        await configurationService.UpdateAsync(id, request);
        return ApiResponse.Ok();
    }

    /// <summary>删除配置（软删除）</summary>
    /// <remarks>只置 deleted_at，不做物理删除；版本快照与操作日志保留可审计；软删除后同 key 可重建</remarks>
    /// <param name="id">配置项 id</param>
    /// <returns>data 为 null，code=0 表示成功</returns>
    [HttpDelete("{id:long}")]
    public async Task<object> Delete(long id)
    {
        await configurationService.DeleteAsync(id);
        return ApiResponse.Ok();
    }

    /// <summary>发布配置</summary>
    /// <remarks>事务内：版本号原子 +1 → 写版本快照 → 更新生效指针（status 置 PUBLISHED）→ 写审计日志；
    /// 无未发布变更时拒绝重复发布返回 30002；并发发布冲突返回 30004（可重试）</remarks>
    /// <param name="id">配置项 id</param>
    /// <param name="request">发布参数：变更备注（可选）</param>
    /// <returns>data 为 PublishResponse（新快照 versionId 与 versionNumber）</returns>
    [HttpPost("{id:long}/publish")]
    public async Task<object> Publish(long id, PublishRequest request) =>
        ApiResponse.Ok(await publishService.PublishAsync(id, request));

    /// <summary>回滚配置</summary>
    /// <remarks>以目标历史版本内容重新发布，**不回退版本号**（生成 change_type=ROLLBACK 的新版本，保持线性递增可追溯）；
    /// 目标版本不存在返回 30003</remarks>
    /// <param name="id">配置项 id</param>
    /// <param name="request">回滚参数：目标历史版本号、备注（可选）</param>
    /// <returns>data 为 PublishResponse（新快照 versionId 与 versionNumber）</returns>
    [HttpPost("{id:long}/rollback")]
    public async Task<object> Rollback(long id, RollbackRequest request) =>
        ApiResponse.Ok(await publishService.RollbackAsync(id, request));

    /// <summary>下线配置</summary>
    /// <remarks>status 置 OFFLINE，客户端不再能读到；仅 PUBLISHED 状态可下线，否则返回 10001</remarks>
    /// <param name="id">配置项 id</param>
    /// <returns>data 为 null，code=0 表示成功</returns>
    [HttpPost("{id:long}/offline")]
    public async Task<object> Offline(long id)
    {
        await publishService.OfflineAsync(id);
        return ApiResponse.Ok();
    }

    /// <summary>版本历史列表</summary>
    /// <remarks>按 version_number 倒序分页；版本快照不可变、不提供删除能力</remarks>
    /// <param name="id">配置项 id</param>
    /// <param name="pageIndex">页码，从 1 开始</param>
    /// <param name="pageSize">每页条数</param>
    /// <returns>data 为分页结构 { items: ConfigurationVersionResponse[], total }</returns>
    [HttpGet("{id:long}/versions")]
    public async Task<object> ListVersions(long id, int pageIndex = 1, int pageSize = 20) =>
        ApiResponse.Ok(await configurationService.ListVersionsAsync(id, pageIndex, pageSize));

    /// <summary>单个版本快照</summary>
    /// <remarks>返回指定版本号的完整快照内容（供 Diff 取数）；版本不存在返回 10002</remarks>
    /// <param name="id">配置项 id</param>
    /// <param name="versionNumber">目标版本号</param>
    /// <returns>data 为 ConfigurationVersionResponse</returns>
    [HttpGet("{id:long}/versions/{versionNumber:long}")]
    public async Task<object> GetVersion(long id, long versionNumber) =>
        ApiResponse.Ok(await configurationService.GetVersionAsync(id, versionNumber));
}
