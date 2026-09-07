namespace k_config_center.Infrastructure;

/// <summary>配置变更事件总线（进程内单例）：发布/回滚/下线/软删除成功后，唤醒对应「命名空间+环境+配置组」
/// 通道上挂起的长轮询请求，使其立即重算组指纹并返回，替代原「每 2 秒轮询数据库」的探测方式。
/// 事件仅在单实例内传递；多实例部署时需引入跨实例广播（如 PostgreSQL LISTEN/NOTIFY），见变更日志后续规划。</summary>
public sealed class ConfigurationChangeNotifier
{
    private readonly object _gate = new();
    private readonly Dictionary<string, List<TaskCompletionSource>> _waitersByChannel = [];

    /// <summary>构造通道标识：分隔符选用不可见控制字符，避免与业务 key 内容冲突</summary>
    public static string ChannelOf(string namespaceKey, string environmentKey, string groupKey) =>
        $"{namespaceKey}\u0001{environmentKey}\u0001{groupKey}";

    /// <summary>挂起等待通道上的变更信号。<paramref name="cancellationToken"/> 取消（长轮询客户端断开或等待超时）时
    /// 以取消状态结束等待，由调用方区分处理；不阻塞线程池线程</summary>
    public Task WaitForChangeAsync(string channel, CancellationToken cancellationToken)
    {
        var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        lock (_gate)
        {
            if (!_waitersByChannel.TryGetValue(channel, out var waiters))
                _waitersByChannel[channel] = waiters = [];
            waiters.Add(completion);
        }
        cancellationToken.Register(() =>
        {
            lock (_gate)
            {
                if (_waitersByChannel.TryGetValue(channel, out var waiters))
                    waiters.Remove(completion);
            }
            completion.TrySetCanceled(cancellationToken);
        });
        return completion.Task;
    }

    /// <summary>通知通道变更：唤醒全部等待者后清空该通道（等待者被唤醒后按需重新挂起，不在此处复用）</summary>
    public void NotifyChanged(string channel)
    {
        lock (_gate)
        {
            if (!_waitersByChannel.Remove(channel, out var waiters))
                return;
            foreach (var completion in waiters)
                completion.TrySetResult();
        }
    }
}
