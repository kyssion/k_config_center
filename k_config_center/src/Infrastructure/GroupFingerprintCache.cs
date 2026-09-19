using Microsoft.Extensions.Caching.Memory;

namespace k_config_center.Infrastructure;

/// <summary>组指纹进程内缓存（长轮询读路径的减压层）。
/// 长轮询挂起期间每个客户端每 2 秒都要组指纹，直接查库意味着「N 个客户端 × 每 2 秒」次五表联查；
/// 缓存后同一组的并发探测共享同一次查询，数据库代价降为「每组至多每 TTL 一次」。
/// 阶段一单进程部署，进程内缓存即可；多实例部署时需换成集中失效（见架构文档演进路线阶段三）。
/// 失效用整体代次递增实现：影响已发布内容可见性的写操作（发布/回滚/下线/删除配置）后调用
/// InvalidateAll，旧代条目的键不再命中、随 TTL 自然淘汰；即使遗漏失效点，客户端感知变更最多延迟一个 TTL</summary>
public class GroupFingerprintCache(IMemoryCache cache)
{
    /// <summary>条目存活时间：既是同组查库频率上界，也是失效遗漏时变更感知延迟的上界</summary>
    private static readonly TimeSpan TimeToLive = TimeSpan.FromSeconds(5);

    /// <summary>缓存代次：InvalidateAll 递增后旧条目不再命中</summary>
    private int _generation;

    /// <summary>取组指纹：命中直接返回，未命中执行 compute 查库并缓存</summary>
    public async Task<string> GetOrComputeAsync(string namespaceKey, string environmentKey, string groupKey, Func<Task<string>> compute)
    {
        var cacheKey = $"group-fingerprint:{_generation}:{namespaceKey}:{environmentKey}:{groupKey}";
        return (await cache.GetOrCreateAsync(cacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeToLive;
            return compute();
        }))!;
    }

    /// <summary>整体失效：发布/回滚/下线/删除配置后调用（草稿新建/保存不影响已发布内容，无需失效）</summary>
    public void InvalidateAll() => Interlocked.Increment(ref _generation);
}
