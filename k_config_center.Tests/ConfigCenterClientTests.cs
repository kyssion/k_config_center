using System.Net;
using System.Text;
using System.Text.Json;
using k_config_center.ClientSdk;

namespace k_config_center.Tests;

/// <summary>客户端 SDK 单元测试（假 HttpMessageHandler 模拟服务端，不依赖真实配置中心）：
/// 启动拉取、快照兜底与落盘、变更通知热更新、组指纹算法与已知向量一致性</summary>
public class ConfigCenterClientTests : IDisposable
{
    /// <summary>按入队顺序应答、超出队列走兜底（延迟后的 changed=false，模拟服务端挂起返回，避免测试内忙轮询）</summary>
    private sealed class QueuedHttpHandler : HttpMessageHandler
    {
        private readonly Queue<Func<HttpResponseMessage>> _responders = new();

        public void Enqueue(HttpResponseMessage response) => _responders.Enqueue(() => response);

        public void Enqueue(Func<HttpResponseMessage> responder) => _responders.Enqueue(responder);

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (_responders.Count > 0) return _responders.Dequeue()();
            await Task.Delay(TimeSpan.FromMilliseconds(50), cancellationToken); // 模拟服务端挂起后再返回未变更
            return Json(new { code = 0, message = "ok", data = new { changed = false, md5 = "unchanged" } });
        }
    }

    private readonly string _snapshotPath;
    private readonly List<IAsyncDisposable> _disposables = [];

    public ConfigCenterClientTests()
    {
        _snapshotPath = Path.Combine(Path.GetTempPath(), $"kcc-snapshot-{Guid.NewGuid():N}.json");
    }

    public void Dispose()
    {
        foreach (var disposable in _disposables) disposable.DisposeAsync().AsTask().GetAwaiter().GetResult();
        if (File.Exists(_snapshotPath)) File.Delete(_snapshotPath);
    }

    /// <summary>构造客户端（用后自动 Dispose）</summary>
    private ConfigCenterClient CreateClient(QueuedHttpHandler handler, string? snapshotPath = null) =>
        Track(new ConfigCenterClient(new ConfigCenterClientOptions
        {
            BaseUrl = new Uri("http://test-config-center"),
            NamespaceKey = "ns",
            EnvironmentKey = "env",
            GroupKey = "grp",
            SnapshotPath = snapshotPath,
            LongPollingTimeout = TimeSpan.FromSeconds(2),
            RetryDelay = TimeSpan.FromMilliseconds(50),
        }, handler));

    private T Track<T>(T disposable) where T : IAsyncDisposable
    {
        _disposables.Add(disposable);
        return disposable;
    }

    /// <summary>统一契约成功响应（data 原样塞进 JSON）</summary>
    private static HttpResponseMessage Json(object data) => new(HttpStatusCode.OK)
    { Content = new StringContent(JsonSerializer.Serialize(data), Encoding.UTF8, "application/json") };

    private static HttpResponseMessage Configurations(params (string key, string content, string md5, long version)[] items) =>
        Json(new
        {
            code = 0,
            message = "ok",
            data = items.Select(it => new { configurationKey = it.key, content = it.content, format = "text", md5 = it.md5, versionNumber = it.version }),
        });

    [Fact]
    public async Task 启动拉取成功_缓存可读且快照落盘()
    {
        var handler = new QueuedHttpHandler();
        handler.Enqueue(Configurations(("k1", "v1", "m1", 3)));
        var client = CreateClient(handler, _snapshotPath);

        await client.StartAsync();

        Assert.Equal("v1", client.GetContent("k1"));
        Assert.Equal(3, client.Get("k1")?.VersionNumber);
        Assert.Null(client.Get("not-exist"));
        Assert.True(File.Exists(_snapshotPath)); // 成功拉取后快照已写盘，供下次启动兜底
        Assert.Contains("k1", File.ReadAllText(_snapshotPath));
    }

    [Fact]
    public async Task 启动时服务端不可达_回退本地快照()
    {
        // 先手工构造一份合法快照（维度 key 与客户端一致）
        File.WriteAllText(_snapshotPath, JsonSerializer.Serialize(new
        {
            namespaceKey = "ns",
            environmentKey = "env",
            groupKey = "grp",
            savedAt = DateTimeOffset.UtcNow,
            configurations = new[] { new { configurationKey = "k1", content = "snapshot-value", format = "text", md5 = "m0", versionNumber = 1 } },
        }));
        var handler = new QueuedHttpHandler();
        handler.Enqueue(() => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)); // 服务端一直不可达

        var client = CreateClient(handler, _snapshotPath);
        await client.StartAsync(); // 不可达不抛异常

        Assert.Equal("snapshot-value", client.GetContent("k1")); // 快照数据兜底
    }

    [Fact]
    public async Task 变更通知后_重新拉取更新缓存并触发事件()
    {
        var handler = new QueuedHttpHandler();
        handler.Enqueue(Configurations(("k1", "v1", "m1", 1))); // 启动拉取
        handler.Enqueue(Json(new { code = 0, message = "ok", data = new { changed = true, md5 = "server-new" } })); // 长轮询发现变更
        handler.Enqueue(Configurations(("k1", "v2", "m2", 2))); // 重新拉取
        var client = CreateClient(handler);

        var refreshed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        client.Changed += () =>
        {
            if (client.GetContent("k1") == "v2") refreshed.TrySetResult();
        };

        await client.StartAsync();
        Assert.Equal("v1", client.GetContent("k1"));

        await refreshed.Task.WaitAsync(TimeSpan.FromSeconds(10)); // 后台轮询收到变更通知后热更新
        Assert.Equal("v2", client.GetContent("k1"));
        Assert.Equal(2, client.Get("k1")?.VersionNumber);
    }

    [Fact]
    public void 组指纹算法_与服务端口径一致()
    {
        // 空组指纹 = MD5("")，已知向量；单条 "k1=m1" 的 MD5 由测试独立计算，锁定 SDK 与服务端算法不漂移
        Assert.Equal("d41d8cd98f00b204e9800998ecf8427e", ConfigCenterClient.ComputeFingerprint([]));

        var joined = "k1=m1";
        var expected = Convert.ToHexString(System.Security.Cryptography.MD5.HashData(Encoding.UTF8.GetBytes(joined))).ToLowerInvariant();
        Assert.Equal(expected, ConfigCenterClient.ComputeFingerprint([new("k1", null, "text", "m1", 1)]));
    }
}
