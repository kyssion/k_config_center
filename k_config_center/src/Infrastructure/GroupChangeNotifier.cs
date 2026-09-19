namespace k_config_center.Infrastructure;

/// <summary>长轮询变更唤醒信号（进程内广播）。
/// 写操作（发布/回滚/下线/组级发布/删除配置）完成事务后调用 NotifyAll，
/// 挂起中的长轮询立即醒来重查组指纹——变更感知延迟从「下一个重查周期」降为即时。
/// 等待方各自比对指纹，未受影响的组指纹不变、继续挂起，因此无需按组精确投递；
/// 按间隔超时的周期性重查仍保留，兜底覆盖进程重启与未来多实例部署</summary>
public class GroupChangeNotifier
{
    private readonly object _gate = new();
    private TaskCompletionSource _wake = CreateSource();

    /// <summary>等待下一次变更信号、超时或取消（任一先到即返回）</summary>
    public Task WaitNextAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        TaskCompletionSource current;
        lock (_gate) current = _wake;
        return current.Task.WaitAsync(timeout, cancellationToken);
    }

    /// <summary>广播变更：唤醒全部挂起中的等待方（换新信号源，旧信号一次性燃尽）</summary>
    public void NotifyAll()
    {
        TaskCompletionSource previous;
        lock (_gate)
        {
            previous = _wake;
            _wake = CreateSource();
        }
        previous.TrySetResult();
    }

    /// <summary>RunContinuationsAsynchronously：唤醒的延续不在持锁线程上同步执行，避免惊群阻塞 NotifyAll 调用方</summary>
    private static TaskCompletionSource CreateSource() => new(TaskCreationOptions.RunContinuationsAsynchronously);
}
