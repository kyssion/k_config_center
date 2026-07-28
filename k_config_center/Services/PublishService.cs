using k_config_center.Infrastructure;
using k_config_center.Models.Domain;
using k_config_center.Models.Requests;
using k_config_center.Models.Responses;
using k_config_center.Repositories;

namespace k_config_center.Services;

/// <summary>发布业务逻辑：发布 / 回滚 / 下线（后端方案 8.2、8.3，模块边界约定）。
/// 发布与回滚为事务操作，事务内顺序执行「版本号原子递增 → 写不可变快照 → 切换生效指针 → 写日志」，
/// 任一步失败整体回滚，保证版本号、快照、指针、日志四者一致。
/// 事务编排：Service 不接触 ISqlSugarClient，经 Repository 层的 DatabaseTransactionRunner 执行；
/// SqlSugarScope 单例保证事务内各 Repository 的操作自动参与同一环境事务（后端方案第 9 章）。</summary>
public class PublishService(
    ConfigurationRepository configurationRepository,
    ConfigurationVersionRepository configurationVersionRepository,
    OperationLogRepository operationLogRepository,
    DatabaseTransactionRunner transactionRunner,
    IHttpContextAccessor httpContextAccessor)
{
    /// <summary>当前请求对象：供操作人与客户端 IP 提取</summary>
    private HttpRequest Request => httpContextAccessor.HttpContext!.Request;

    /// <summary>发布：把当前编辑态内容固化为新版本并切换生效指针（文档 8.2）。
    /// 已是发布态且内容与生效版本一致（无未发布变更）时拒绝重复发布（30002）；
    /// OFFLINE 状态允许直接发布以恢复上线（状态机 OFFLINE → publish → PUBLISHED）</summary>
    public async Task<PublishResponse> PublishAsync(long id, PublishRequest request)
    {
        var configuration = await configurationRepository.GetByIdAsync(id)
            ?? throw new BusinessException(10002, "配置不存在");
        if (configuration.Status == "PUBLISHED" && configuration.PublishedVersionId != null)
        {
            // 「无未发布变更」判定：当前 md5 与生效版本 md5 一致，重复发布只会产生完全相同的版本，拒绝
            var publishedVersion = await configurationVersionRepository.GetByIdAsync(configuration.PublishedVersionId.Value);
            if (publishedVersion?.Md5 == configuration.Md5)
                throw new BusinessException(30002, "无未发布变更，无需重复发布");
        }

        PublishResponse response = null!;
        await ExecutePublishTransactionAsync(async () =>
        {
            var versionNumber = await IncrementVersionNumberAsync(id);
            var version = new ConfigurationVersionData(0, id, versionNumber,
                configuration.Content, configuration.Format, configuration.Md5,
                ChangeType: configuration.PublishedVersionId == null ? "CREATE" : "UPDATE", // 首发 CREATE，之后 UPDATE
                request.ChangeRemark, OperationHelper.GetOperator(Request), DateTimeOffset.UtcNow);
            var versionId = await configurationVersionRepository.InsertAsync(version);
            await configurationRepository.UpdatePublishStateAsync(id, versionId);
            // 日志与业务变更同事务，同生共死（文档 8.5：事务型操作日志在 PublishService 事务内直接写）
            await WriteLogAsync("PUBLISH", new { versionNumber, request.ChangeRemark }, configuration, id);
            response = new PublishResponse(versionId, versionNumber);
        });
        return response;
    }

    /// <summary>回滚：不回退版本号，而是以目标历史版本内容生成新版本重新发布（change_type=ROLLBACK），
    /// 保持版本线性递增、历史可追溯（文档 8.3）；当前态内容同步为该历史版本值</summary>
    public async Task<PublishResponse> RollbackAsync(long id, RollbackRequest request)
    {
        var configuration = await configurationRepository.GetByIdAsync(id)
            ?? throw new BusinessException(10002, "配置不存在");
        var target = await configurationVersionRepository.GetByVersionNumberAsync(id, request.VersionNumber)
            ?? throw new BusinessException(30003, $"目标回滚版本不存在：v{request.VersionNumber}");

        PublishResponse response = null!;
        await ExecutePublishTransactionAsync(async () =>
        {
            var versionNumber = await IncrementVersionNumberAsync(id);
            var version = new ConfigurationVersionData(0, id, versionNumber,
                target.Content, target.Format, target.Md5, ChangeType: "ROLLBACK",
                request.ChangeRemark ?? $"回滚自 v{target.VersionNumber}",
                OperationHelper.GetOperator(Request), DateTimeOffset.UtcNow);
            var versionId = await configurationVersionRepository.InsertAsync(version);
            // 当前态内容同步为历史版本值，并切换生效指针
            await configurationRepository.UpdateRollbackStateAsync(id, target.Content, target.Format ?? "text", target.Md5, versionId);
            await WriteLogAsync("ROLLBACK", new { versionNumber, rollbackFromVersionNumber = target.VersionNumber }, configuration, id);
            response = new PublishResponse(versionId, versionNumber);
        });
        return response;
    }

    /// <summary>下线：status 置 OFFLINE，客户端立即不可见（客户端只读 PUBLISHED）；
    /// 不产生版本记录，published_version_id 保留，之后可通过发布恢复上线（状态机第 5 章）</summary>
    public async Task OfflineAsync(long id)
    {
        var configuration = await configurationRepository.GetByIdAsync(id)
            ?? throw new BusinessException(10002, "配置不存在");
        if (configuration.Status != "PUBLISHED")
            throw new BusinessException(10001, "仅已发布状态的配置可下线");
        await configurationRepository.UpdateOfflineStateAsync(id, OperationHelper.GetOperator(Request));
        await WriteLogAsync("OFFLINE", new { resource = "configuration", configuration.ConfigurationKey }, configuration, id);
    }

    /// <summary>版本号原子递增：Repository 内 UPDATE ... RETURNING，并发发布在行锁上串行化，
    /// 各自拿到不同版本号，避免「先读后写」竞态；行不存在或已软删则视为配置不存在</summary>
    private async Task<long> IncrementVersionNumberAsync(long id) =>
        await configurationRepository.IncrementLatestVersionNumberAsync(id)
        ?? throw new BusinessException(10002, "配置不存在或已被删除");

    /// <summary>发布/回滚事务统一执行：业务异常原样抛出；UNIQUE(configuration_id, version_number) 冲突
    /// 转发布并发冲突（30004，唯一约束兜底，后端方案第 9 章）；其余异常原样抛给全局处理</summary>
    private async Task ExecutePublishTransactionAsync(Func<Task> action)
    {
        try { await transactionRunner.ExecuteAsync(action); }
        catch (BusinessException) { throw; }
        catch (Exception exception) when (OperationHelper.IsUniqueViolation(exception))
        { throw new BusinessException(30004, "发布并发冲突，请重试"); }
    }

    /// <summary>写审计日志：归属维度取自配置的冗余 id，操作人/客户端 IP 从当前请求提取</summary>
    private Task WriteLogAsync(string operation, object detail, ConfigurationData configuration, long configurationId) =>
        operationLogRepository.InsertAsync(operation, detail,
            OperationHelper.GetOperator(Request), OperationHelper.GetClientIpAddress(Request),
            configuration.NamespaceId, configuration.EnvironmentId, configuration.GroupId, configurationId);
}
