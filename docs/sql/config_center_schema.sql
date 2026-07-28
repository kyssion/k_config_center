-- ============================================================================
-- 配置中心（Config Center）PostgreSQL 建表脚本
-- ----------------------------------------------------------------------------
-- 用途    ：初始化配置中心数据库表结构（namespace → environment → group → configuration，
--           含版本快照与操作日志）。
-- 数据库  ：PostgreSQL 14+
-- 执行方式：psql -U <user> -d <database> -f config_center_schema.sql
-- 幂等说明：如需重复执行，请取消下方 DROP TABLE 注释块（会级联删除数据，慎用！）；
--           或自行改造为 CREATE TABLE IF NOT EXISTS。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 可选：清库重建（危险操作，默认注释；仅在开发环境重建时打开）
-- ----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS config_center_operation_log CASCADE;
-- DROP TABLE IF EXISTS config_center_configuration_version CASCADE;
-- DROP TABLE IF EXISTS config_center_configuration CASCADE;
-- DROP TABLE IF EXISTS config_center_configuration_group CASCADE;
-- DROP TABLE IF EXISTS config_center_environment CASCADE;
-- DROP TABLE IF EXISTS config_center_namespace CASCADE;

-- ============================================================================
-- 1. config_center_namespace 命名空间表
--    顶层隔离单元，如按业务线/团队划分；默认内置 public 命名空间。
-- ============================================================================
CREATE TABLE config_center_namespace (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    namespace_key  VARCHAR(128) NOT NULL DEFAULT 'public',
    namespace_name VARCHAR(128) NOT NULL,
    description    VARCHAR(512),
    status         SMALLINT     NOT NULL DEFAULT 1,
    created_by     VARCHAR(64),
    updated_by     VARCHAR(64),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT unique_namespace_key UNIQUE (namespace_key)
);

COMMENT ON TABLE  config_center_namespace                IS '命名空间表：配置中心顶层隔离单元';
COMMENT ON COLUMN config_center_namespace.id             IS '自增主键';
COMMENT ON COLUMN config_center_namespace.namespace_key  IS '命名空间业务标识，全局唯一，默认 public';
COMMENT ON COLUMN config_center_namespace.namespace_name IS '命名空间显示名称';
COMMENT ON COLUMN config_center_namespace.description    IS '描述';
COMMENT ON COLUMN config_center_namespace.status         IS '状态：1=启用，0=禁用';
COMMENT ON COLUMN config_center_namespace.created_by     IS '创建人';
COMMENT ON COLUMN config_center_namespace.updated_by     IS '最后修改人';
COMMENT ON COLUMN config_center_namespace.created_at     IS '创建时间（含时区）';
COMMENT ON COLUMN config_center_namespace.updated_at     IS '更新时间（含时区）';

-- ============================================================================
-- 2. config_center_environment 环境表
--    隶属于命名空间的环境维度，如 dev / test / staging / prod。
-- ============================================================================
CREATE TABLE config_center_environment (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    namespace_id     BIGINT       NOT NULL,
    environment_key  VARCHAR(64)  NOT NULL,
    environment_name VARCHAR(128) NOT NULL,
    description      VARCHAR(512),
    sort_order       INT          NOT NULL DEFAULT 0,
    status           SMALLINT     NOT NULL DEFAULT 1,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT foreign_key_environment_namespace FOREIGN KEY (namespace_id) REFERENCES config_center_namespace (id),
    CONSTRAINT unique_environment_namespace_key UNIQUE (namespace_id, environment_key)
);

COMMENT ON TABLE  config_center_environment                  IS '环境表：命名空间下的环境（dev/test/staging/prod）';
COMMENT ON COLUMN config_center_environment.id               IS '自增主键';
COMMENT ON COLUMN config_center_environment.namespace_id     IS '所属命名空间，外键 → config_center_namespace(id)';
COMMENT ON COLUMN config_center_environment.environment_key  IS '环境业务标识，如 dev/test/staging/prod，命名空间内唯一';
COMMENT ON COLUMN config_center_environment.environment_name IS '环境显示名称';
COMMENT ON COLUMN config_center_environment.description      IS '描述';
COMMENT ON COLUMN config_center_environment.sort_order       IS '排序值，越小越靠前';
COMMENT ON COLUMN config_center_environment.status           IS '状态：1=启用，0=禁用';
COMMENT ON COLUMN config_center_environment.created_at       IS '创建时间（含时区）';
COMMENT ON COLUMN config_center_environment.updated_at       IS '更新时间（含时区）';

-- ============================================================================
-- 3. config_center_configuration_group 配置组表
--    环境下的配置分组（类似 Nacos 的 Group / Apollo 的 Namespace 文件）。
-- ============================================================================
CREATE TABLE config_center_configuration_group (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    namespace_id   BIGINT       NOT NULL,
    environment_id BIGINT       NOT NULL,
    group_key      VARCHAR(128) NOT NULL,
    group_name     VARCHAR(128) NOT NULL,
    description    VARCHAR(512),
    status         SMALLINT     NOT NULL DEFAULT 1,
    created_by     VARCHAR(64),
    updated_by     VARCHAR(64),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT foreign_key_group_namespace FOREIGN KEY (namespace_id) REFERENCES config_center_namespace (id),
    CONSTRAINT foreign_key_group_environment FOREIGN KEY (environment_id) REFERENCES config_center_environment (id),
    CONSTRAINT unique_group_environment_key UNIQUE (environment_id, group_key)
);

CREATE INDEX index_group_namespace_environment ON config_center_configuration_group (namespace_id, environment_id);

COMMENT ON TABLE  config_center_configuration_group                IS '配置组表：环境下的配置分组';
COMMENT ON COLUMN config_center_configuration_group.id             IS '自增主键';
COMMENT ON COLUMN config_center_configuration_group.namespace_id   IS '所属命名空间，外键 → config_center_namespace(id)';
COMMENT ON COLUMN config_center_configuration_group.environment_id IS '所属环境，外键 → config_center_environment(id)';
COMMENT ON COLUMN config_center_configuration_group.group_key      IS '配置组业务标识（编程标识符），同一环境内唯一';
COMMENT ON COLUMN config_center_configuration_group.group_name     IS '配置组显示名称';
COMMENT ON COLUMN config_center_configuration_group.description    IS '描述';
COMMENT ON COLUMN config_center_configuration_group.status         IS '状态：1=启用，0=禁用';
COMMENT ON COLUMN config_center_configuration_group.created_by     IS '创建人';
COMMENT ON COLUMN config_center_configuration_group.updated_by     IS '最后修改人';
COMMENT ON COLUMN config_center_configuration_group.created_at     IS '创建时间（含时区）';
COMMENT ON COLUMN config_center_configuration_group.updated_at     IS '更新时间（含时区）';

-- ============================================================================
-- 4. config_center_configuration 配置表（当前态）
--    每条记录代表一个配置项的最新状态；历史内容由 config_center_configuration_version 保存。
--    冗余 namespace_id / environment_id 以支撑高频读取时避免多表 JOIN。
-- ============================================================================
CREATE TABLE config_center_configuration (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id              BIGINT       NOT NULL,
    namespace_id          BIGINT       NOT NULL,
    environment_id        BIGINT       NOT NULL,
    configuration_key     VARCHAR(256) NOT NULL,
    content               TEXT,
    format                VARCHAR(16)  NOT NULL DEFAULT 'text',
    md5                   CHAR(32),
    description           VARCHAR(512),
    tags                  VARCHAR(256),
    status                VARCHAR(16)  NOT NULL DEFAULT 'DRAFT',
    published_version_id  BIGINT,
    latest_version_number BIGINT       NOT NULL DEFAULT 0,
    published_at          TIMESTAMPTZ,
    deleted_at            TIMESTAMPTZ,
    created_by            VARCHAR(64),
    updated_by            VARCHAR(64),
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT foreign_key_configuration_group FOREIGN KEY (group_id) REFERENCES config_center_configuration_group (id),
    CONSTRAINT check_configuration_format CHECK (format IN ('text', 'json', 'yaml', 'properties', 'xml', 'toml')),
    CONSTRAINT check_configuration_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'OFFLINE'))
);

-- 部分唯一索引：仅约束未软删除的记录，同一组内 configuration_key 唯一
CREATE UNIQUE INDEX unique_configuration_key ON config_center_configuration (group_id, configuration_key) WHERE deleted_at IS NULL;

CREATE INDEX index_configuration_namespace_environment ON config_center_configuration (namespace_id, environment_id, status);

COMMENT ON TABLE  config_center_configuration                       IS '配置表（当前态）：配置项最新内容与发布状态';
COMMENT ON COLUMN config_center_configuration.id                    IS '自增主键';
COMMENT ON COLUMN config_center_configuration.group_id              IS '所属配置组，外键 → config_center_configuration_group(id)';
COMMENT ON COLUMN config_center_configuration.namespace_id          IS '冗余命名空间 ID，高频读避免 JOIN';
COMMENT ON COLUMN config_center_configuration.environment_id        IS '冗余环境 ID，高频读避免 JOIN';
COMMENT ON COLUMN config_center_configuration.configuration_key     IS '配置键，组内唯一（未软删除范围）';
COMMENT ON COLUMN config_center_configuration.content               IS '配置内容（当前编辑态最新内容）';
COMMENT ON COLUMN config_center_configuration.format                IS '内容格式：text/json/yaml/properties/xml/toml';
COMMENT ON COLUMN config_center_configuration.md5                   IS '当前内容的 MD5，用于变更探测与未发布变更判断';
COMMENT ON COLUMN config_center_configuration.description           IS '描述';
COMMENT ON COLUMN config_center_configuration.tags                  IS '标签，逗号分隔';
COMMENT ON COLUMN config_center_configuration.status                IS '状态：DRAFT=草稿，PUBLISHED=已发布，OFFLINE=已下线';
COMMENT ON COLUMN config_center_configuration.published_version_id  IS '当前生效版本，外键 → config_center_configuration_version(id)（延迟建立）';
COMMENT ON COLUMN config_center_configuration.latest_version_number IS '最新版本号（发布时自增），0 表示从未发布';
COMMENT ON COLUMN config_center_configuration.published_at          IS '最近一次发布时间';
COMMENT ON COLUMN config_center_configuration.deleted_at            IS '软删除时间，NULL 表示未删除';
COMMENT ON COLUMN config_center_configuration.created_by            IS '创建人';
COMMENT ON COLUMN config_center_configuration.updated_by            IS '最后修改人';
COMMENT ON COLUMN config_center_configuration.created_at            IS '创建时间（含时区）';
COMMENT ON COLUMN config_center_configuration.updated_at            IS '更新时间（含时区）';

-- ============================================================================
-- 5. config_center_configuration_version 配置版本表（历史快照，不可变）
--    每次发布/回滚/删除等操作写入一条不可变快照，版本号线性递增。
-- ============================================================================
CREATE TABLE config_center_configuration_version (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    configuration_id BIGINT      NOT NULL,
    version_number   BIGINT      NOT NULL,
    content          TEXT,
    format           VARCHAR(16),
    md5              CHAR(32),
    change_type      VARCHAR(16) NOT NULL,
    change_remark    VARCHAR(512),
    created_by       VARCHAR(64),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT foreign_key_version_configuration FOREIGN KEY (configuration_id) REFERENCES config_center_configuration (id),
    CONSTRAINT check_version_change_type CHECK (change_type IN ('CREATE', 'UPDATE', 'DELETE', 'ROLLBACK', 'IMPORT')),
    CONSTRAINT unique_version_configuration_number UNIQUE (configuration_id, version_number)
);

CREATE INDEX index_version_configuration ON config_center_configuration_version (configuration_id, version_number DESC);

COMMENT ON TABLE  config_center_configuration_version                  IS '配置版本表：发布历史快照，记录不可变';
COMMENT ON COLUMN config_center_configuration_version.id               IS '自增主键';
COMMENT ON COLUMN config_center_configuration_version.configuration_id IS '所属配置项，外键 → config_center_configuration(id)';
COMMENT ON COLUMN config_center_configuration_version.version_number   IS '版本号，配置项内线性递增';
COMMENT ON COLUMN config_center_configuration_version.content          IS '该版本的配置内容快照';
COMMENT ON COLUMN config_center_configuration_version.format           IS '该版本的内容格式';
COMMENT ON COLUMN config_center_configuration_version.md5              IS '该版本内容的 MD5';
COMMENT ON COLUMN config_center_configuration_version.change_type      IS '变更类型：CREATE/UPDATE/DELETE/ROLLBACK/IMPORT';
COMMENT ON COLUMN config_center_configuration_version.change_remark    IS '变更备注';
COMMENT ON COLUMN config_center_configuration_version.created_by       IS '操作人';
COMMENT ON COLUMN config_center_configuration_version.created_at       IS '创建时间（含时区）';

-- 延迟建立 config_center_configuration → config_center_configuration_version 的外键，避免建表时的循环依赖
ALTER TABLE config_center_configuration
    ADD CONSTRAINT foreign_key_published_version
    FOREIGN KEY (published_version_id) REFERENCES config_center_configuration_version (id);

-- ============================================================================
-- 6. config_center_operation_log 操作日志表
--    审计用途，仅记录 ID 不加外键约束，避免影响主表删除与写入性能。
-- ============================================================================
CREATE TABLE config_center_operation_log (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    namespace_id      BIGINT,
    environment_id    BIGINT,
    group_id          BIGINT,
    configuration_id  BIGINT,
    operation         VARCHAR(32) NOT NULL,
    detail            JSONB,
    operator          VARCHAR(64),
    client_ip_address VARCHAR(64),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX index_operation_log_configuration ON config_center_operation_log (configuration_id, created_at DESC);

COMMENT ON TABLE  config_center_operation_log                   IS '操作日志表：配置中心操作审计记录';
COMMENT ON COLUMN config_center_operation_log.id                IS '自增主键';
COMMENT ON COLUMN config_center_operation_log.namespace_id      IS '命名空间 ID（无外键约束）';
COMMENT ON COLUMN config_center_operation_log.environment_id    IS '环境 ID（无外键约束）';
COMMENT ON COLUMN config_center_operation_log.group_id          IS '配置组 ID（无外键约束）';
COMMENT ON COLUMN config_center_operation_log.configuration_id  IS '配置项 ID（无外键约束）';
COMMENT ON COLUMN config_center_operation_log.operation         IS '操作类型：CREATE/UPDATE/PUBLISH/ROLLBACK/OFFLINE/DELETE';
COMMENT ON COLUMN config_center_operation_log.detail            IS '操作详情（JSONB），如变更前后差异';
COMMENT ON COLUMN config_center_operation_log.operator          IS '操作人';
COMMENT ON COLUMN config_center_operation_log.client_ip_address IS '操作来源 IP';
COMMENT ON COLUMN config_center_operation_log.created_at        IS '操作时间（含时区）';

-- ============================================================================
-- 初始化数据：默认 public 命名空间
-- ============================================================================
INSERT INTO config_center_namespace (namespace_key, namespace_name, description, status, created_by, updated_by)
VALUES ('public', '默认命名空间', '系统内置默认命名空间', 1, 'system', 'system');
