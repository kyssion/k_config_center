using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace k_config_center.ClientSdk;

/// <summary>统一响应信封（与后端 ApiResponse 契约对齐：业务失败 HTTP 仍 200，错误由 code 表达）</summary>
internal sealed record ApiEnvelope(int Code, string? Message, JsonElement Data);

/// <summary>客户端配置接口返回的单条配置</summary>
internal sealed record ConfigurationItemDto(string ConfigurationKey, string? Content, string Format, string? Md5, long VersionNumber);

/// <summary>长轮询通知接口返回</summary>
internal sealed record NotificationDto(bool Changed, string? Md5);

/// <summary>快照文件结构：记录归属维度 key（加载时校验，防止误读到其他组的快照）与全部配置</summary>
internal sealed class SnapshotFile
{
    public string NamespaceKey { get; set; } = string.Empty;
    public string EnvironmentKey { get; set; } = string.Empty;
    public string GroupKey { get; set; } = string.Empty;
    public DateTimeOffset SavedAt { get; set; }
    public List<ConfigurationItemDto> Configurations { get; set; } = [];
}

/// <summary>配置中心 .NET 客户端（阶段三 SDK）：本地缓存 + 长轮询热更新 + 快照兜底。
/// 用法：构造后 <see cref="StartAsync"/> 启动（加载快照 → 拉取最新 → 后台长轮询开始），
/// 业务代码经 <see cref="Get"/> / <see cref="GetContent"/> 读本地缓存（内存读取，无网络开销），
/// 配置变更由 <see cref="Changed"/> 事件通知；不再使用时 Dispose 停止后台轮询。
/// 容错语义：启动时配置中心不可达则回退本地快照（若有）；轮询中的网络异常按 RetryDelay 退避重试，期间缓存继续可用</summary>
public sealed class ConfigCenterClient : IAsyncDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
    private static readonly IReadOnlyDictionary<string, SdkConfiguration> EmptyCache = new Dictionary<string, SdkConfiguration>();

    private readonly ConfigCenterClientOptions _options;
    private readonly HttpClient _httpClient;
    private readonly CancellationTokenSource _stopping = new();
    // 启动闸门：后台轮询等首次加载（快照 + 拉取）完成后再开始请求，避免与 StartAsync 的初始化竞态
    private readonly TaskCompletionSource _ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly Task _pollingTask;
    private volatile IReadOnlyDictionary<string, SdkConfiguration> _cache = EmptyCache;
    private volatile string _fingerprint = string.Empty;
    private bool _started;

    /// <summary>配置发生变更并已应用到本地缓存时触发（后台线程回调，业务方自行做线程安全的响应，如刷新本地派生配置）</summary>
    public event Action? Changed;

    /// <summary>构造客户端（即创建后台轮询任务，但会等待 <see cref="StartAsync"/> 完成首次加载后才发起请求）</summary>
    public ConfigCenterClient(ConfigCenterClientOptions options) : this(options, new HttpClientHandler()) { }

    /// <summary>测试用构造：注入自定义 HttpMessageHandler 模拟服务端</summary>
    internal ConfigCenterClient(ConfigCenterClientOptions options, HttpMessageHandler handler)
    {
        _options = options;
        _httpClient = new HttpClient(handler, disposeHandler: true) { BaseAddress = options.BaseUrl, Timeout = options.LongPollingTimeout + TimeSpan.FromSeconds(10) };
        if (options.ApiKey != null) _httpClient.DefaultRequestHeaders.Add("X-Api-Key", options.ApiKey);
        _pollingTask = Task.Run(() => PollingLoopAsync(_stopping.Token));
    }

    /// <summary>启动：加载本地快照（若有）→ 尝试拉取最新配置（失败不抛，回退快照）→ 放行后台轮询。
    /// 重复调用无效果</summary>
    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        if (_started) return;
        _started = true;
        LoadSnapshot();
        try
        {
            await RefreshAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            // 配置中心不可达：保留快照数据继续启动，由后台轮询持续重试
        }
        finally
        {
            _ready.TrySetResult();
        }
    }

    /// <summary>取单条配置；不存在（或尚未拉取到）返回 null</summary>
    public SdkConfiguration? Get(string key) => _cache.GetValueOrDefault(key);

    /// <summary>取单条配置内容；不存在或内容为空返回 null——业务侧最常用的入口</summary>
    public string? GetContent(string key) => _cache.GetValueOrDefault(key)?.Content;

    /// <summary>当前缓存的全部配置快照</summary>
    public IReadOnlyList<SdkConfiguration> GetAll() => _cache.Values.ToList();

    /// <summary>停止后台轮询并释放资源</summary>
    public async ValueTask DisposeAsync()
    {
        _ready.TrySetResult(); // 从未 Start 也要能正常退出等待
        await _stopping.CancelAsync();
        try { await _pollingTask; }
        catch (OperationCanceledException) { }
        _httpClient.Dispose();
        _stopping.Dispose();
    }

    /// <summary>后台长轮询循环：挂起等待服务端变更通知，changed=true 时重新拉取并应用缓存；
    /// 异常按 RetryDelay 退避重试，只有 Dispose 能结束循环</summary>
    private async Task PollingLoopAsync(CancellationToken cancellationToken)
    {
        await _ready.Task.WaitAsync(cancellationToken);
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var changed = await WaitForServerChangeAsync(cancellationToken);
                if (changed) await RefreshAsync(cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
            {
                // 网络异常 / 业务失败码 / 请求超时：退避后重试，本地缓存继续可用
                try { await Task.Delay(_options.RetryDelay, cancellationToken); }
                catch (OperationCanceledException) { break; }
            }
        }
    }

    /// <summary>长轮询：携带本地指纹挂起等待，返回 true 表示服务端组指纹已变化、需要重新拉取。
    /// TaskCanceledException 兼作网络超时与取消两种语义，由调用方统一退避处理</summary>
    private async Task<bool> WaitForServerChangeAsync(CancellationToken cancellationToken)
    {
        var query = BuildDimensionQuery() + $"&md5={Uri.EscapeDataString(_fingerprint)}";
        var notification = await GetAsync<NotificationDto>($"/api/client/notifications?{query}", cancellationToken);
        return notification.Changed;
    }

    /// <summary>拉取组内全部已发布配置并原子替换本地缓存、写快照、触发 Changed 事件</summary>
    private async Task RefreshAsync(CancellationToken cancellationToken)
    {
        var items = await GetAsync<List<ConfigurationItemDto>>($"/api/client/configurations?{BuildDimensionQuery()}", cancellationToken);
        _cache = items.ToDictionary(it => it.ConfigurationKey, it => new SdkConfiguration(it.ConfigurationKey, it.Content, it.Format, it.Md5, it.VersionNumber));
        _fingerprint = ComputeFingerprint(items);
        SaveSnapshot(items);
        Changed?.Invoke();
    }

    /// <summary>三级业务 key 公共查询串</summary>
    private string BuildDimensionQuery() =>
        $"namespaceKey={Uri.EscapeDataString(_options.NamespaceKey)}" +
        $"&environmentKey={Uri.EscapeDataString(_options.EnvironmentKey)}" +
        $"&groupKey={Uri.EscapeDataString(_options.GroupKey)}";

    /// <summary>请求并解包统一响应：code != 0 视为业务失败（如 10004 鉴权失败），抛异常交由轮询退避</summary>
    private async Task<T> GetAsync<T>(string requestUri, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.GetAsync(requestUri, cancellationToken);
        response.EnsureSuccessStatusCode();
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope>(JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("配置中心响应不是合法的 JSON 信封");
        if (envelope.Code != 0)
            throw new HttpRequestException($"配置中心业务失败：code={envelope.Code} message={envelope.Message}");
        return envelope.Data.Deserialize<T>(JsonOptions)
            ?? throw new InvalidOperationException($"配置中心响应 data 无法反序列化为 {typeof(T).Name}");
    }

    /// <summary>加载本地快照兜底缓存：文件不存在、损坏或归属维度与本客户端不一致时静默忽略</summary>
    private void LoadSnapshot()
    {
        if (_options.SnapshotPath == null || !File.Exists(_options.SnapshotPath)) return;
        try
        {
            var snapshot = JsonSerializer.Deserialize<SnapshotFile>(File.ReadAllText(_options.SnapshotPath), JsonOptions);
            if (snapshot == null
                || snapshot.NamespaceKey != _options.NamespaceKey
                || snapshot.EnvironmentKey != _options.EnvironmentKey
                || snapshot.GroupKey != _options.GroupKey) return;
            _cache = snapshot.Configurations.ToDictionary(it => it.ConfigurationKey, it => new SdkConfiguration(it.ConfigurationKey, it.Content, it.Format, it.Md5, it.VersionNumber));
            _fingerprint = ComputeFingerprint(snapshot.Configurations);
        }
        catch (Exception exception) when (exception is IOException or JsonException)
        {
            // 快照损坏不阻断启动：丢弃，等首次拉取
        }
    }

    /// <summary>原子写快照（先写临时文件再覆盖），失败静默（快照只是兜底手段，不保证成功）</summary>
    private void SaveSnapshot(List<ConfigurationItemDto> items)
    {
        if (_options.SnapshotPath == null) return;
        try
        {
            var snapshot = new SnapshotFile
            {
                NamespaceKey = _options.NamespaceKey,
                EnvironmentKey = _options.EnvironmentKey,
                GroupKey = _options.GroupKey,
                SavedAt = DateTimeOffset.UtcNow,
                Configurations = items
            };
            var temporaryPath = _options.SnapshotPath + ".tmp";
            File.WriteAllText(temporaryPath, JsonSerializer.Serialize(snapshot, JsonOptions));
            File.Move(temporaryPath, _options.SnapshotPath, overwrite: true);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            // 快照写失败不影响运行
        }
    }

    /// <summary>组指纹：与服务端 ClientConfigurationService 的算法保持一致
    /// （组内配置按 key Ordinal 排序后 "key=md5" 以 \n 拼接，对拼接串求 MD5 小写十六进制），
    /// 服务端据此判断客户端是否落后</summary>
    internal static string ComputeFingerprint(List<ConfigurationItemDto> items)
    {
        var joined = string.Join("\n", items.OrderBy(it => it.ConfigurationKey, StringComparer.Ordinal)
            .Select(it => $"{it.ConfigurationKey}={it.Md5}"));
        return Convert.ToHexStringLower(MD5.HashData(Encoding.UTF8.GetBytes(joined)));
    }
}
