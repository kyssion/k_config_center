using k_config_center.Infrastructure;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace k_config_center.Tests;

/// <summary>组指纹缓存单元测试（纯内存，不依赖数据库）：命中不重算、组间隔离、InvalidateAll 后旧条目失效</summary>
public class GroupFingerprintCacheTests
{
    /// <summary>构造独立的缓存实例，避免用例间串味</summary>
    private static GroupFingerprintCache CreateCache() =>
        new(new MemoryCache(Options.Create(new MemoryCacheOptions())));

    [Fact]
    public async Task 同组重复获取_只计算一次并命中缓存值()
    {
        var cache = CreateCache();
        var computeCount = 0;

        var first = await cache.GetOrComputeAsync("ns", "env", "grp", () => { computeCount++; return Task.FromResult("fp-a"); });
        var second = await cache.GetOrComputeAsync("ns", "env", "grp", () => { computeCount++; return Task.FromResult("fp-b"); });

        Assert.Equal("fp-a", first);
        Assert.Equal("fp-a", second); // 命中缓存，第二次 compute 不执行
        Assert.Equal(1, computeCount);
    }

    [Fact]
    public async Task 不同组的指纹互不串味()
    {
        var cache = CreateCache();

        var first = await cache.GetOrComputeAsync("ns", "env", "grp-1", () => Task.FromResult("fp-1"));
        var second = await cache.GetOrComputeAsync("ns", "env", "grp-2", () => Task.FromResult("fp-2"));

        Assert.Equal("fp-1", first);
        Assert.Equal("fp-2", second);
    }

    [Fact]
    public async Task InvalidateAll后_旧条目失效并重新计算()
    {
        var cache = CreateCache();

        await cache.GetOrComputeAsync("ns", "env", "grp", () => Task.FromResult("old"));
        cache.InvalidateAll();
        var after = await cache.GetOrComputeAsync("ns", "env", "grp", () => Task.FromResult("new"));

        Assert.Equal("new", after);
    }
}
