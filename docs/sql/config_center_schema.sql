-- ============================================================================
-- 配置中心（Config Center）PostgreSQL 建表脚本
-- ----------------------------------------------------------------------------
-- 用途    ：初始化配置中心数据库表结构（namespace → env → group → config，
--           含版本快照与操作日志）。
-- 数据库  ：PostgreSQL 14+
-- 执行方式：psql -U <user> -d <database> -f config_center_schema.sql
-- 幂等说明：如需重复执行，请取消下方 DROP TABLE 注释块（会级联删除数据，慎用！）；
--           或自行改造为 CREATE TABLE IF NOT EXISTS。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 可选：清库重建（危险操作，默认注释；仅在开发环境重建时打开）
-- ----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS cc_operation_log CASCADE;
-- DROP TABLE IF EXISTS cc_config_version CASCADE;
-- DROP TABLE IF EXISTS cc_config CASCADE;
-- DROP TABLE IF EXISTS cc_config_group CASCADE;
-- DROP TABLE IF EXISTS cc_env CASCADE;
-- DROP TABLE IF EXISTS cc_namespace CASCADE;

-- ============================================================================
-- 1. cc_namespace 命名空间表
--    顶层隔离单元，如按业务线/团队划分；默认内置 public 命名空间。
-- ============================================================================
CREATE TABLE cc_namespace (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    namespace_id VARCHAR(128) NOT NULL DEFAULT 'public',
    name         VARCHAR(128) NOT NULL,
    description  VARCHAR(512),
    status       SMALLINT     NOT NULL DEFAULT 1,
    created_by   VARCHAR(64),
    updated_by   VARCHAR(64),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uk_namespace_id UNIQUE (namespace_id)
);

COMMENT ON TABLE  cc_namespace              IS '命名空间表：配置中心顶层隔离单元';
COMMENT ON COLUMN cc_namespace.id           IS '自增主键';
COMMENT ON COLUMN cc_namespace.namespace_id IS '命名空间业务标识，全局唯一，默认 public';
COMMENT ON COLUMN cc_namespace.name         IS '命名空间显示名称';
COMMENT ON COLUMN cc_namespace.description  IS '描述';
COMMENT ON COLUMN cc_namespace.status       IS '状态：1=启用，0=禁用';
COMMENT ON COLUMN cc_namespace.created_by   IS '创建人';
COMMENT ON COLUMN cc_namespace.updated_by   IS '最后修改人';
COMMENT ON COLUMN cc_namespace.created_at   IS '创建时间（含时区）';
COMMENT ON COLUMN cc_namespace.updated_at   IS '更新时间（含时区）';

-- ============================================================================
-- 2. cc_env 环境表
--    隶属于命名空间的环境维度，如 dev / test / staging / prod。
-- ============================================================================
CREATE TABLE cc_env (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    namespace_id BIGINT       NOT NULL,
    env_code     VARCHAR(64)  NOT NULL,
    name         VARCHAR(128) NOT NULL,
    description  VARCHAR(512),
    sort_order   INT          NOT NULL DEFAULT 0,
    status       SMALLINT     NOT NULL DEFAULT 1,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT fk_env_namespace FOREIGN KEY (namespace_id) REFERENCES cc_namespace (id),
    CONSTRAINT uk_env_ns_code UNIQUE (namespace_id, env_code)
);

COMMENT ON TABLE  cc_env              IS '环境表：命名空间下的环境（dev/test/staging/prod）';
COMMENT ON COLUMN cc_env.id           IS '自增主键';
COMMENT ON COLUMN cc_env.namespace_id IS '所属命名空间，外键 → cc_namespace(id)';
COMMENT ON COLUMN cc_env.env_code     IS '环境编码，如 dev/test/staging/prod，命名空间内唯一';
COMMENT ON COLUMN cc_env.name         IS '环境显示名称';
COMMENT ON COLUMN cc_env.description  IS '描述';
COMMENT ON COLUMN cc_env.sort_order   IS '排序值，越小越靠前';
COMMENT ON COLUMN cc_env.status       IS '状态：1=启用，0=禁用';
COMMENT ON COLUMN cc_env.created_at   IS '创建时间（含时区）';
COMMENT ON COLUMN cc_env.updated_at   IS '更新时间（含时区）';

-- ============================================================================
-- 3. cc_config_group 配置组表
--    环境下的配置分组（类似 Nacos 的 Group / Apollo 的 Namespace 文件）。
-- ============================================================================
CREATE TABLE cc_config_group (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    namespace_id BIGINT       NOT NULL,
    env_id       BIGINT       NOT NULL,
    group_name   VARCHAR(128) NOT NULL,
    description  VARCHAR(512),
    status       SMALLINT     NOT NULL DEFAULT 1,
    created_by   VARCHAR(64),
    updated_by   VARCHAR(64),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT fk_group_namespace FOREIGN KEY (namespace_id) REFERENCES cc_namespace (id),
    CONSTRAINT fk_group_env FOREIGN KEY (env_id) REFERENCES cc_env (id),
    CONSTRAINT uk_group_env_name UNIQUE (env_id, group_name)
);

CREATE INDEX idx_group_ns_env ON cc_config_group (namespace_id, env_id);

COMMENT ON TABLE  cc_config_group              IS '配置组表：环境下的配置分组';
COMMENT ON COLUMN cc_config_group.id           IS '自增主键';
COMMENT ON COLUMN cc_config_group.namespace_id IS '所属命名空间，外键 → cc_namespace(id)';
COMMENT ON COLUMN cc_config_group.env_id       IS '所属环境，外键 → cc_env(id)';
COMMENT ON COLUMN cc_config_group.group_name   IS '配置组名称，同一环境内唯一';
COMMENT ON COLUMN cc_config_group.description  IS '描述';
COMMENT ON COLUMN cc_config_group.status       IS '状态：1=启用，0=禁用';
COMMENT ON COLUMN cc_config_group.created_by   IS '创建人';
COMMENT ON COLUMN cc_config_group.updated_by   IS '最后修改人';
COMMENT ON COLUMN cc_config_group.created_at   IS '创建时间（含时区）';
COMMENT ON COLUMN cc_config_group.updated_at   IS '更新时间（含时区）';

-- ============================================================================
-- 4. cc_config 配置表（当前态）
--    每条记录代表一个配置项的最新状态；历史内容由 cc_config_version 保存。
--    冗余 namespace_id / env_id 以支撑高频读取时避免多表 JOIN。
-- ============================================================================
CREATE TABLE cc_config (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id             BIGINT       NOT NULL,
    namespace_id         BIGINT       NOT NULL,
    env_id               BIGINT       NOT NULL,
    config_key           VARCHAR(256) NOT NULL,
    content              TEXT,
    format               VARCHAR(16)  NOT NULL DEFAULT 'text',
    md5                  CHAR(32),
    description          VARCHAR(512),
    tags                 VARCHAR(256),
    status               VARCHAR(16)  NOT NULL DEFAULT 'DRAFT',
    published_version_id BIGINT,
    latest_version_no    BIGINT       NOT NULL DEFAULT 0,
    published_at         TIMESTAMPTZ,
    deleted_at           TIMESTAMPTZ,
    created_by           VARCHAR(64),
    updated_by           VARCHAR(64),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT fk_config_group FOREIGN KEY (group_id) REFERENCES cc_config_group (id),
    CONSTRAINT ck_config_format CHECK (format IN ('text', 'json', 'yaml', 'properties', 'xml', 'toml')),
    CONSTRAINT ck_config_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'OFFLINE'))
);

-- 部分唯一索引：仅约束未软删除的记录，同一组内 config_key 唯一
CREATE UNIQUE INDEX uk_config_key ON cc_config (group_id, config_key) WHERE deleted_at IS NULL;

CREATE INDEX idx_config_ns_env ON cc_config (namespace_id, env_id, status);

COMMENT ON TABLE  cc_config                      IS '配置表（当前态）：配置项最新内容与发布状态';
COMMENT ON COLUMN cc_config.id                   IS '自增主键';
COMMENT ON COLUMN cc_config.group_id             IS '所属配置组，外键 → cc_config_group(id)';
COMMENT ON COLUMN cc_config.namespace_id         IS '冗余命名空间 ID，高频读避免 JOIN';
COMMENT ON COLUMN cc_config.env_id               IS '冗余环境 ID，高频读避免 JOIN';
COMMENT ON COLUMN cc_config.config_key           IS '配置键，组内唯一（未软删除范围）';
COMMENT ON COLUMN cc_config.content              IS '配置内容（当前编辑态最新内容）';
COMMENT ON COLUMN cc_config.format               IS '内容格式：text/json/yaml/properties/xml/toml';
COMMENT ON COLUMN cc_config.md5                  IS '当前内容的 MD5，用于变更探测与未发布变更判断';
COMMENT ON COLUMN cc_config.description          IS '描述';
COMMENT ON COLUMN cc_config.tags                 IS '标签，逗号分隔';
COMMENT ON COLUMN cc_config.status               IS '状态：DRAFT=草稿，PUBLISHED=已发布，OFFLINE=已下线';
COMMENT ON COLUMN cc_config.published_version_id IS '当前生效版本，外键 → cc_config_version(id)（延迟建立）';
COMMENT ON COLUMN cc_config.latest_version_no    IS '最新版本号（发布时自增），0 表示从未发布';
COMMENT ON COLUMN cc_config.published_at         IS '最近一次发布时间';
COMMENT ON COLUMN cc_config.deleted_at           IS '软删除时间，NULL 表示未删除';
COMMENT ON COLUMN cc_config.created_by           IS '创建人';
COMMENT ON COLUMN cc_config.updated_by           IS '最后修改人';
COMMENT ON COLUMN cc_config.created_at           IS '创建时间（含时区）';
COMMENT ON COLUMN cc_config.updated_at           IS '更新时间（含时区）';

-- ============================================================================
-- 5. cc_config_version 配置版本表（历史快照，不可变）
--    每次发布/回滚/删除等操作写入一条不可变快照，版本号线性递增。
-- ============================================================================
CREATE TABLE cc_config_version (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    config_id     BIGINT      NOT NULL,
    version_no    BIGINT      NOT NULL,
    content       TEXT,
    format        VARCHAR(16),
    md5           CHAR(32),
    change_type   VARCHAR(16) NOT NULL,
    change_remark VARCHAR(512),
    created_by    VARCHAR(64),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_version_config FOREIGN KEY (config_id) REFERENCES cc_config (id),
    CONSTRAINT ck_version_change_type CHECK (change_type IN ('CREATE', 'UPDATE', 'DELETE', 'ROLLBACK', 'IMPORT')),
    CONSTRAINT uk_version_config_no UNIQUE (config_id, version_no)
);

CREATE INDEX idx_version_config ON cc_config_version (config_id, version_no DESC);

COMMENT ON TABLE  cc_config_version               IS '配置版本表：发布历史快照，记录不可变';
COMMENT ON COLUMN cc_config_version.id            IS '自增主键';
COMMENT ON COLUMN cc_config_version.config_id     IS '所属配置项，外键 → cc_config(id)';
COMMENT ON COLUMN cc_config_version.version_no    IS '版本号，配置项内线性递增';
COMMENT ON COLUMN cc_config_version.content       IS '该版本的配置内容快照';
COMMENT ON COLUMN cc_config_version.format        IS '该版本的内容格式';
COMMENT ON COLUMN cc_config_version.md5           IS '该版本内容的 MD5';
COMMENT ON COLUMN cc_config_version.change_type   IS '变更类型：CREATE/UPDATE/DELETE/ROLLBACK/IMPORT';
COMMENT ON COLUMN cc_config_version.change_remark IS '变更备注';
COMMENT ON COLUMN cc_config_version.created_by    IS '操作人';
COMMENT ON COLUMN cc_config_version.created_at    IS '创建时间（含时区）';

-- 延迟建立 cc_config → cc_config_version 的外键，避免建表时的循环依赖
ALTER TABLE cc_config
    ADD CONSTRAINT fk_published_version
    FOREIGN KEY (published_version_id) REFERENCES cc_config_version (id);

-- ============================================================================
-- 6. cc_operation_log 操作日志表
--    审计用途，仅记录 ID 不加外键约束，避免影响主表删除与写入性能。
-- ============================================================================
CREATE TABLE cc_operation_log (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    namespace_id BIGINT,
    env_id       BIGINT,
    group_id     BIGINT,
    config_id    BIGINT,
    operation    VARCHAR(32) NOT NULL,
    detail       JSONB,
    operator     VARCHAR(64),
    client_ip    VARCHAR(64),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oplog_config ON cc_operation_log (config_id, created_at DESC);

COMMENT ON TABLE  cc_operation_log              IS '操作日志表：配置中心操作审计记录';
COMMENT ON COLUMN cc_operation_log.id           IS '自增主键';
COMMENT ON COLUMN cc_operation_log.namespace_id IS '命名空间 ID（无外键约束）';
COMMENT ON COLUMN cc_operation_log.env_id       IS '环境 ID（无外键约束）';
COMMENT ON COLUMN cc_operation_log.group_id     IS '配置组 ID（无外键约束）';
COMMENT ON COLUMN cc_operation_log.config_id    IS '配置项 ID（无外键约束）';
COMMENT ON COLUMN cc_operation_log.operation    IS '操作类型：CREATE/UPDATE/PUBLISH/ROLLBACK/OFFLINE/DELETE';
COMMENT ON COLUMN cc_operation_log.detail       IS '操作详情（JSONB），如变更前后差异';
COMMENT ON COLUMN cc_operation_log.operator     IS '操作人';
COMMENT ON COLUMN cc_operation_log.client_ip    IS '操作来源 IP';
COMMENT ON COLUMN cc_operation_log.created_at   IS '操作时间（含时区）';

-- ============================================================================
-- 初始化数据：默认 public 命名空间
-- ============================================================================
INSERT INTO cc_namespace (namespace_id, name, description, status, created_by, updated_by)
VALUES ('public', '默认命名空间', '系统内置默认命名空间', 1, 'system', 'system');
