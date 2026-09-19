namespace k_config_center.ClientSdk;

/// <summary>客户端配置。除 BaseUrl 与三级业务 key 外均有缺省值，按需覆盖</summary>
public sealed class ConfigCenterClientOptions
{
    /// <summary>配置中心基址（如 http://config-center:9000），SDK 请求 {BaseUrl}/api/client/*</summary>
    public required Uri BaseUrl { get; init; }

    /// <summary>命名空间业务 key</summary>
    public required string NamespaceKey { get; init; }

    /// <summary>环境业务 key</summary>
    public required string EnvironmentKey { get; init; }

    /// <summary>配置组业务 key</summary>
    public required string GroupKey { get; init; }

    /// <summary>API Key（服务端启用 Auth:Enabled 时必填，随 X-Api-Key 请求头发送）</summary>
    public string? ApiKey { get; init; }

    /// <summary>本地快照文件路径：每次成功拉取后原子写入，启动时配置中心不可达则用快照兜底；null 表示不落盘</summary>
    public string? SnapshotPath { get; init; }

    /// <summary>长轮询挂起上限（应不小于服务端 Client:LongPollingTimeoutSeconds，避免 SDK 提前超时重连）</summary>
    public TimeSpan LongPollingTimeout { get; init; } = TimeSpan.FromSeconds(40);

    /// <summary>轮询异常后的重试间隔（网络抖动 / 服务端 5xx 时退避）</summary>
    public TimeSpan RetryDelay { get; init; } = TimeSpan.FromSeconds(2);
}
