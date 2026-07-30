namespace k_config_center.Infrastructure;

/// <summary>业务错误码枚举（后端方案 7.1 分段约定）：
/// 0 表示成功；10000+ 通用错误；20000+ 基础维度（命名空间/环境/配置组）错误；30000+ 配置与发布错误。
/// 码值即对外 JSON 契约中的 code 字段（int），新增错误码须按分段追加，禁止修改既有码值。</summary>
public enum ErrorCode
{
    /// <summary>成功（通用段 0）</summary>
    Success = 0,

    /// <summary>服务器内部错误（通用段 10000+）：未预期异常经全局异常处理兜底返回</summary>
    InternalServerError = 10000,

    /// <summary>业务状态非法（通用段 10000+）：当前资源状态不满足操作前置条件，如非已发布配置不可下线</summary>
    InvalidBusinessState = 10001,

    /// <summary>资源不存在（通用段 10000+）：按 id/key 查询的目标资源不存在或已被删除</summary>
    ResourceNotFound = 10002,

    /// <summary>命名空间 key 唯一冲突（基础维度段 20000+）</summary>
    NamespaceKeyConflict = 20001,

    /// <summary>环境 key 在命名空间内唯一冲突（基础维度段 20000+）</summary>
    EnvironmentKeyConflict = 20002,

    /// <summary>配置组 key 在环境内唯一冲突（基础维度段 20000+）</summary>
    GroupKeyConflict = 20003,

    /// <summary>级联删除约束冲突（基础维度段 20000+）：存在未删除的下级资源，拒绝删除</summary>
    CascadeDeleteConflict = 20004,

    /// <summary>配置 key 在组内唯一冲突（配置与发布段 30000+）</summary>
    ConfigurationKeyConflict = 30001,

    /// <summary>无未发布变更（配置与发布段 30000+）：内容未变化，拒绝重复发布</summary>
    NoUnpublishedChanges = 30002,

    /// <summary>目标回滚版本不存在（配置与发布段 30000+）</summary>
    RollbackVersionNotFound = 30003,

    /// <summary>发布并发冲突（配置与发布段 30000+）：版本号唯一约束触发，需重试</summary>
    PublishConcurrencyConflict = 30004,
}
