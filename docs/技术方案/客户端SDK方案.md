# 客户端 SDK 方案（k_config_center.ClientSdk）

> 面向 .NET 业务应用的配置中心客户端（阶段三交付物）：本地缓存 + 长轮询热更新 + 快照兜底。
> 零依赖（仅 BCL：HttpClient + System.Text.Json），不引用后端工程，可打包 NuGet 分发或源码引用。

## 1. 解决什么问题

业务应用接入配置中心的标准姿势：

- **读配置走本地内存缓存**（`Get` / `GetContent`），读路径零网络开销；
- **配置变更热更新**：后台长轮询 `/api/client/notifications`，服务端写操作（发布/回滚/下线/组级发布/删除）事务提交后即时唤醒，变更秒级推达并触发 `Changed` 事件；
- **启动兜底**：每次成功拉取后原子写本地快照文件；启动时配置中心不可达（网络分区、中心重启）则加载快照继续启动，应用不被配置中心拖挂。

## 2. 用法

```csharp
using k_config_center.ClientSdk;

await using var client = new ConfigCenterClient(new ConfigCenterClientOptions
{
    BaseUrl = new Uri("http://config-center:9000"),
    NamespaceKey = "order-center",
    EnvironmentKey = "prod",
    GroupKey = "application",
    ApiKey = "your-api-key",                          // 服务端启用鉴权时必填
    SnapshotPath = "config-snapshot.json",            // 启动兜底快照，null 则不落盘
});
client.Changed += () => ReloadDerivedSettings();      // 变更回调（后台线程，自行保证线程安全）
await client.StartAsync();                            // 加载快照 → 拉取最新 → 后台长轮询开始

var timeout = client.GetContent("redis.timeout");     // 内存读取，null 表示不存在
```

宿主接入建议：封装为 `IHostedService`（启动时 `StartAsync`，停止时 `DisposeAsync`），配合 `IOptionsMonitor<T>` 或轻量静态门面按业务习惯暴露。

## 3. 行为契约

| 语义 | 行为 |
|------|------|
| 读 | `Get`/`GetContent`/`GetAll` 读内存缓存；未拉取到或不存在的 key 返回 null |
| 首次启动 | `StartAsync` = 加载快照（若有且维度 key 匹配）→ 尝试拉取最新（失败不抛，回退快照）→ 放行后台轮询 |
| 变更感知 | 长轮询携带本地组指纹；服务端判定变更返回 changed=true 后重新拉取、原子换缓存、写快照、触发 `Changed` |
| 故障退避 | 网络异常 / 业务失败码（如 10004）/ 超时，按 `RetryDelay`（缺省 2 秒）退避重试，期间缓存持续可用 |
| 组指纹 | 与服务端口径一致：组内配置按 key Ordinal 排序后 `"key=md5"` 以 `\n` 拼接求 MD5（小写十六进制）；空组取 MD5("")，两侧算法改动须同步 |
| 释放 | `DisposeAsync` 停止轮询并释放 HttpClient；可安全重复调用 |

## 4. 配置项（ConfigCenterClientOptions）

| 属性 | 必填 | 缺省 | 说明 |
|------|------|------|------|
| BaseUrl | 是 | — | 配置中心基址，SDK 请求 `{BaseUrl}/api/client/*` |
| NamespaceKey / EnvironmentKey / GroupKey | 是 | — | 三级业务 key，锁定要订阅的配置组 |
| ApiKey | 否 | null | 服务端 `Auth:Enabled=true` 时随 `X-Api-Key` 发送 |
| SnapshotPath | 否 | null | 快照文件路径；null 不落盘（无启动兜底） |
| LongPollingTimeout | 否 | 40 秒 | 客户端请求超时，应大于服务端挂起上限（缺省 30 秒） |
| RetryDelay | 否 | 2 秒 | 轮询异常后的退避间隔 |

## 5. 测试

`k_config_center.Tests/ConfigCenterClientTests.cs`：假 HttpMessageHandler 模拟服务端，覆盖启动拉取与快照落盘、服务端不可达时快照兜底、变更通知热更新与事件触发、组指纹算法与已知向量锁定。

## 6. 演进

- 灰度发布（阶段二遗留）：SDK 需扩展客户端标签上报，配合服务端灰度规则命中灰度版本；
- 多实例部署：服务端集中通知（ReleaseMessage 表 / 消息总线）后，SDK 无需改动（长轮询契约不变）；
- 如需打 NuGet 包：csproj 加包信息即可，当前以源码工程随仓分发。
