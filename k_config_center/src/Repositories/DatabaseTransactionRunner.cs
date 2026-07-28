using SqlSugar;

namespace k_config_center.Repositories;

/// <summary>Repository 层提供的事务入口：Service 不允许接触 ISqlSugarClient，
/// 发布/回滚这类跨表事务由 Service 传入委托、经本类执行。
/// ISqlSugarClient 注册为 SqlSugarScope 单例，同一异步上下文内各 Repository 的操作
/// 自动参与 UseTranAsync 开启的环境事务，无需显式传递事务对象——这是代码最少、可读性最好的编排方式</summary>
public class DatabaseTransactionRunner(ISqlSugarClient database)
{
    /// <summary>在数据库事务内执行 action：任一步抛异常整体回滚，并把原始异常原样抛出，
    /// 由 Service 转业务错误码或交给全局异常中间件处理</summary>
    public async Task ExecuteAsync(Func<Task> action)
    {
        var result = await database.Ado.UseTranAsync(action);
        if (!result.IsSuccess) throw result.ErrorException;
    }
}
