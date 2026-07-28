using k_config_center.Infrastructure;
using k_config_center.Models.Responses;
using k_config_center.Repositories;

namespace k_config_center.Services;

/// <summary>客户端读取业务逻辑：按业务 key 批量/单个拉取已发布配置与长轮询变更探测（后端方案 7.3，模块边界约定）。
/// 只读模块，不写审计日志；五表联查收口在 ConfigurationRepository（联查主体是配置）</summary>
public class ClientConfigurationService(ConfigurationRepository configurationRepository)
{
    /// <summary>按业务 key 批量拉取已发布配置：只返回 status='PUBLISHED' 且未软删的配置，
    /// 内容取 published_version_id 指向的版本快照（保证读到已发布内容而非编辑中的草稿）</summary>
    public async Task<List<ClientConfigurationResponse>> ListAsync(
        string namespaceKey, string environmentKey, string groupKey, string? configurationKey = null) =>
        (await configurationRepository.ListPublishedByBusinessKeysAsync(namespaceKey, environmentKey, groupKey, configurationKey))
        .Select(it => new ClientConfigurationResponse(it.ConfigurationKey, it.Content, it.Format, it.Md5, it.VersionNumber))
        .ToList();

    /// <summary>拉取单个已发布配置：未发布/已删除/不存在统一按 10002 处理，客户端无需区分</summary>
    public async Task<ClientConfigurationResponse> GetAsync(
        string configurationKey, string namespaceKey, string environmentKey, string groupKey)
    {
        var items = await ListAsync(namespaceKey, environmentKey, groupKey, configurationKey);
        return items.FirstOrDefault() ?? throw new BusinessException(10002, $"已发布配置不存在：{configurationKey}");
    }

    /// <summary>长轮询变更探测（阶段一简单轮询式实现，后端方案 7.3 明确允许）：
    /// 客户端携带上次拿到的组指纹 md5，服务端周期性重算比对——不一致立即返回 changed=true，
    /// 一致则挂起最长 30 秒后返回 changed=false；挂起靠 Task.Delay + CancellationToken，不阻塞线程池线程。
    /// 组指纹 = 组内全部已发布配置按 key 排序后 "key=md5" 拼接串的 MD5，任一配置发布/回滚/下线/删除都会改变指纹</summary>
    public async Task<ClientNotificationResponse> WaitForChangeAsync(
        string namespaceKey, string environmentKey, string groupKey, string? md5, CancellationToken cancellationToken)
    {
        var deadline = DateTimeOffset.UtcNow.AddSeconds(30); // 挂起上限 30 秒（文档默认 30~60 秒取下限）
        while (true)
        {
            var fingerprint = await ComputeGroupFingerprintAsync(namespaceKey, environmentKey, groupKey);
            if (fingerprint != md5)
                return new ClientNotificationResponse(true, fingerprint);
            if (DateTimeOffset.UtcNow >= deadline)
                return new ClientNotificationResponse(false, fingerprint);
            await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken); // 客户端断开时由 token 取消，立即结束挂起
        }
    }

    /// <summary>计算组指纹：读取组内已发布配置的 key 与生效版本 md5，按 key 排序拼接后整体求 MD5。
    /// 空组也有确定指纹（空串的 MD5），保证「组内最后一个配置被删除」同样能触发变更通知</summary>
    private async Task<string> ComputeGroupFingerprintAsync(string namespaceKey, string environmentKey, string groupKey)
    {
        var items = await configurationRepository.ListPublishedByBusinessKeysAsync(namespaceKey, environmentKey, groupKey);
        var joined = string.Join("\n", items.OrderBy(it => it.ConfigurationKey, StringComparer.Ordinal)
            .Select(it => $"{it.ConfigurationKey}={it.Md5}"));
        return OperationHelper.ComputeMd5(joined);
    }
}
