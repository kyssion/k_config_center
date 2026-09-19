namespace k_config_center.Infrastructure;

/// <summary>客户端接口配置（appsettings "Client" 节，未配置时用属性默认值）</summary>
public class ClientSettings
{
    /// <summary>长轮询挂起上限（秒），需小于反向代理的读超时</summary>
    public int LongPollingTimeoutSeconds { get; set; } = 30;

    /// <summary>长轮询挂起期间的重查间隔（秒）</summary>
    public int LongPollingIntervalSeconds { get; set; } = 2;
}
