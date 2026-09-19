using k_config_center.Infrastructure;
using k_config_center.Models.Domain;
using k_config_center.Models.Requests;
using k_config_center.Models.Responses;
using k_config_center.Repositories;

namespace k_config_center.Services;

/// <summary>发布业务逻辑：单条发布 / 组级发布 / 回滚 / 下线（后端方案 8.2、8.3、8.6，模块边界约定）。
/// 发布与回滚为事务操作，事务内顺序执行「版本号原子递增（UPDATE 取行锁）→ 重读最新状态并校验 → 写不可变快照 → 切换生效指针 → 写日志」，
/// 任一步失败整体回滚，保证版本号、快照、指针、日志四者一致；
/// 事务提交后失效组指纹缓存并广播变更唤醒，长轮询客户端即时感知。
/// 事务编排：Service 不接触 ISqlSugarClient，经 Repository 层的 DatabaseTransactionRunner 执行；
/// SqlSugarScope 单例保证事务内各 Repository 的操作自动参与同一环境事务（后端方案第 9 章）。</summary>
public class PublishService(
    ConfigurationRepository configurationRepository,
    ConfigurationVersionRepository configurationVersionRepository,
    ConfigurationGroupRepository configurationGroupRepository,
    OperationLogRepository operationLogRepository,
    DatabaseTransactionRunner transactionRunner,
    GroupFingerprintCache fingerprintCache,
    GroupChangeNotifier changeNotifier,
    OperatorContext operatorContext)
{
    /// <summary>发布：把当前编辑态内容固化为新版本并切换生效指针（文档 8.2）。
    /// 全流程在同一事务内，顺序为「版本号原子递增（UPDATE 取行锁）→ 重读最新状态 → 无变更校验 → 写快照 → 切指针 → 写日志」：
    /// 行锁之后重读的一定是最新已提交内容，消除「事务外读取 → 并发保存草稿 → 快照定格旧内容」的窗口；
    /// 已是发布态且内容与生效版本一致（无未发布变更）时拒绝重复发布（30002，事务回滚不留版本号空洞）；
    /// OFFLINE 状态允许直接发布以恢复上线（状态机 OFFLINE → publish → PUBLISHED）</summary>
    public async Task<PublishResponse> PublishAsync(long id, PublishRequest request)
    {
        PublishResponse response = null!;
        await ExecutePublishTransactionAsync(async () =>
        {
            var versionNumber = await IncrementVersionNumberAsync(id);
            var configuration = await configurationRepository.GetByIdAsync(id)
                ?? throw new BusinessException(ErrorCode.ResourceNotFound, "配置不存在或已被删除");
            if (configuration.Status == "PUBLISHED" && configuration.PublishedVersionId != null)
            {
                // 「无未发布变更」判定：当前 md5 与生效版本 md5 一致，重复发布只会产生完全相同的版本，拒绝
                var publishedVersion = await configurationVersionRepository.GetByIdAsync(configuration.PublishedVersionId.Value);
                if (publishedVersion?.Md5 == configuration.Md5)
                    throw new BusinessException(ErrorCode.NoUnpublishedChanges, "无未发布变更，无需重复发布");
            }
            var version = new ConfigurationVersionData(0, id, versionNumber,
                configuration.Content, configuration.Format, configuration.Md5,
                ChangeType: configuration.PublishedVersionId == null ? "CREATE" : "UPDATE", // 首发 CREATE，之后 UPDATE
                request.ChangeRemark, operatorContext.Operator, DateTimeOffset.UtcNow);
            var versionId = await configurationVersionRepository.InsertAsync(version);
            await configurationRepository.UpdatePublishStateAsync(id, versionId);
            // 日志与业务变更同事务，同生共死（文档 8.5：事务型操作日志在 PublishService 事务内直接写）
            await WriteLogAsync("PUBLISH", new { versionNumber, request.ChangeRemark }, configuration, id);
            response = new PublishResponse(versionId, versionNumber);
        });
        // 已发布内容变化：失效组指纹缓存并广播唤醒，长轮询客户端即时感知（事务提交后执行）
        fingerprintCache.InvalidateAll();
        changeNotifier.NotifyAll();
        return response;
    }

    /// <summary>回滚：不回退版本号，而是以目标历史版本内容生成新版本重新发布（change_type=ROLLBACK），
    /// 保持版本线性递增、历史可追溯（文档 8.3）；当前态内容同步为该历史版本值</summary>
    public async Task<PublishResponse> RollbackAsync(long id, RollbackRequest request)
    {
        var configuration = await configurationRepository.GetByIdAsync(id)
            ?? throw new BusinessException(ErrorCode.ResourceNotFound, "配置不存在");
        var target = await configurationVersionRepository.GetByVersionNumberAsync(id, request.VersionNumber)
            ?? throw new BusinessException(ErrorCode.RollbackVersionNotFound, $"目标回滚版本不存在：v{request.VersionNumber}");

        PublishResponse response = null!;
        await ExecutePublishTransactionAsync(async () =>
        {
            var versionNumber = await IncrementVersionNumberAsync(id);
            var version = new ConfigurationVersionData(0, id, versionNumber,
                target.Content, target.Format, target.Md5, ChangeType: "ROLLBACK",
                request.ChangeRemark ?? $"回滚自 v{target.VersionNumber}",
                operatorContext.Operator, DateTimeOffset.UtcNow);
            var versionId = await configurationVersionRepository.InsertAsync(version);
            // 当前态内容同步为历史版本值，并切换生效指针
            await configurationRepository.UpdateRollbackStateAsync(id, target.Content, target.Format ?? "text", target.Md5, versionId);
            await WriteLogAsync("ROLLBACK", new { versionNumber, rollbackFromVersionNumber = target.VersionNumber }, configuration, id);
            response = new PublishResponse(versionId, versionNumber);
        });
        // 已发布内容变化：失效组指纹缓存并广播唤醒，长轮询客户端即时感知（事务提交后执行）
        fingerprintCache.InvalidateAll();
        changeNotifier.NotifyAll();
        return response;
    }

    /// <summary>下线：status 置 OFFLINE，客户端立即不可见（客户端只读 PUBLISHED）；
    /// 不产生版本记录，published_version_id 保留，之后可通过发布恢复上线（状态机第 5 章）；
    /// 状态更新与审计日志同事务，日志写失败时整体回滚</summary>
    public async Task OfflineAsync(long id)
    {
        var configuration = await configurationRepository.GetByIdAsync(id)
            ?? throw new BusinessException(ErrorCode.ResourceNotFound, "配置不存在");
        if (configuration.Status != "PUBLISHED")
            throw new BusinessException(ErrorCode.InvalidBusinessState, "仅已发布状态的配置可下线");
        await transactionRunner.ExecuteAsync(async () =>
        {
            await configurationRepository.UpdateOfflineStateAsync(id, operatorContext.Operator);
            await WriteLogAsync("OFFLINE", new { resource = "configuration", configuration.ConfigurationKey }, configuration, id);
        });
        fingerprintCache.InvalidateAll(); // 已发布内容变化（下线即不可见）
        changeNotifier.NotifyAll();
    }

    /// <summary>组级发布：一个事务内把组内全部「有未发布变更且未下线」的配置逐条发布（阶段二）。
    /// 每条配置各自走「版本号原子递增（取行锁）→ 重读最新内容 → 写快照 → 切指针」的完整单条发布流程，
    /// 版本语义与单条发布完全一致；整组在同一事务内提交，客户端看到的组状态原子切换。
    /// 已下线配置不动（尊重显式下线决策），无未发布变更的配置跳过；
    /// 组内一条都不需要发布时返回空结果（不算错误），由调用方提示</summary>
    public async Task<GroupPublishResponse> GroupPublishAsync(long groupId, PublishRequest request)
    {
        var group = await configurationGroupRepository.GetByIdAsync(groupId)
            ?? throw new BusinessException(ErrorCode.ResourceNotFound, "配置组不存在");
        GroupPublishResponse response = null!;
        await ExecutePublishTransactionAsync(async () =>
        {
            var configurations = await configurationRepository.ListByGroupIdAsync(groupId);
            var publishedVersionIds = configurations.Where(it => it.PublishedVersionId != null).Select(it => it.PublishedVersionId!.Value).ToList();
            var publishedMd5ById = await configurationVersionRepository.GetMd5ByIdsAsync(publishedVersionIds);
            var items = new List<GroupPublishItemResponse>();
            foreach (var configuration in configurations)
            {
                if (configuration.Status == "OFFLINE") continue; // 已下线不复活
                if (configuration.PublishedVersionId != null && publishedMd5ById.GetValueOrDefault(configuration.PublishedVersionId.Value) == configuration.Md5)
                    continue; // 无未发布变更
                // 与单条发布同口径：递增取行锁后重读，快照定格行锁后的最新内容
                var versionNumber = await IncrementVersionNumberAsync(configuration.Id);
                var fresh = await configurationRepository.GetByIdAsync(configuration.Id)
                    ?? throw new BusinessException(ErrorCode.ResourceNotFound, $"配置不存在或已被删除：{configuration.ConfigurationKey}");
                var version = new ConfigurationVersionData(0, fresh.Id, versionNumber,
                    fresh.Content, fresh.Format, fresh.Md5,
                    ChangeType: fresh.PublishedVersionId == null ? "CREATE" : "UPDATE",
                    request.ChangeRemark, operatorContext.Operator, DateTimeOffset.UtcNow);
                var versionId = await configurationVersionRepository.InsertAsync(version);
                await configurationRepository.UpdatePublishStateAsync(fresh.Id, versionId);
                items.Add(new GroupPublishItemResponse(fresh.Id, fresh.ConfigurationKey, versionNumber));
            }
            // 一条组级审计日志汇总本次发布清单（configuration_id 为空，挂配置组维度）
            await WriteLogAsync("PUBLISH",
                new { scope = "group", request.ChangeRemark, items = items.Select(it => new { it.ConfigurationKey, it.VersionNumber }).ToList() },
                group.NamespaceId, group.EnvironmentId, groupId);
            response = new GroupPublishResponse(items, configurations.Count - items.Count);
        });
        fingerprintCache.InvalidateAll();
        changeNotifier.NotifyAll();
        return response;
    }

    /// <summary>版本号原子递增：Repository 内 UPDATE ... RETURNING，并发发布在行锁上串行化，
    /// 各自拿到不同版本号，避免「先读后写」竞态；行不存在或已软删则视为配置不存在</summary>
    private async Task<long> IncrementVersionNumberAsync(long id) =>
        await configurationRepository.IncrementLatestVersionNumberAsync(id)
        ?? throw new BusinessException(ErrorCode.ResourceNotFound, "配置不存在或已被删除");

    /// <summary>发布/回滚事务统一执行：业务异常原样抛出；UNIQUE(configuration_id, version_number) 冲突
    /// 转发布并发冲突（30004，唯一约束兜底，后端方案第 9 章）；其余异常原样抛给全局处理</summary>
    private async Task ExecutePublishTransactionAsync(Func<Task> action)
    {
        try { await transactionRunner.ExecuteAsync(action); }
        catch (BusinessException) { throw; }
        catch (Exception exception) when (OperationHelper.IsUniqueViolation(exception))
        { throw new BusinessException(ErrorCode.PublishConcurrencyConflict, "发布并发冲突，请重试"); }
    }

    /// <summary>写审计日志：归属维度取自配置的冗余 id，操作人/客户端 IP 取自 OperatorContext</summary>
    private Task WriteLogAsync(string operation, object detail, ConfigurationData configuration, long configurationId) =>
        operationLogRepository.InsertAsync(operation, detail,
            operatorContext.Operator, operatorContext.ClientIpAddress,
            configuration.NamespaceId, configuration.EnvironmentId, configuration.GroupId, configurationId);

    /// <summary>写审计日志（组级操作用）：维度 id 显式传入，configuration_id 为空</summary>
    private Task WriteLogAsync(string operation, object detail, long? namespaceId, long? environmentId, long? groupId) =>
        operationLogRepository.InsertAsync(operation, detail,
            operatorContext.Operator, operatorContext.ClientIpAddress, namespaceId, environmentId, groupId);
}
