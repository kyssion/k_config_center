import { load, dump, YAMLException } from 'js-yaml';
import xmlFormat from 'xml-formatter';

/**
 * 配置内容格式化器：按 format 提供校验（validate）与美化（format）能力。
 * validate 返回 null 表示合法，否则返回错误描述；format 实现整体 try/catch，异常回退原文。
 */
export interface ContentFormatter {
  /** 是否支持美化（false 时 UI 可隐藏"格式化"入口） */
  canFormat: boolean;
  /** 校验内容合法性：null=合法，string=错误信息 */
  validate(content: string): string | null;
  /** 美化内容：失败时回退原文 */
  format(content: string): string;
}

/** json：JSON.parse 校验 + 两空格缩进美化 */
const jsonFormatter: ContentFormatter = {
  canFormat: true,
  validate(content) {
    try {
      JSON.parse(content);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  },
  format(content) {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  },
};

/** yaml：js-yaml load 校验（YAMLException.message 自带行号信息）+ dump 美化 */
const yamlFormatter: ContentFormatter = {
  canFormat: true,
  validate(content) {
    try {
      load(content);
      return null;
    } catch (e) {
      if (e instanceof YAMLException) {
        return e.message;
      }
      return e instanceof Error ? e.message : String(e);
    }
  },
  format(content) {
    // 空串/纯空白直接原样返回：dump(load('')) 会产出 "null\n"，把空配置变成 null 值
    if (content.trim() === '') {
      return content;
    }
    try {
      return dump(load(content), { indent: 2, lineWidth: 120 });
    } catch {
      return content;
    }
  },
};

/** xml：DOMParser 校验（提取 parsererror 节点文本）+ xml-formatter 两空格缩进美化 */
const xmlContentFormatter: ContentFormatter = {
  canFormat: true,
  validate(content) {
    const doc = new DOMParser().parseFromString(content, 'application/xml');
    // getElementsByTagName 不区分命名空间，兼容 Firefox 将 parsererror 置于专属命名空间的行为
    const errors = doc.getElementsByTagName('parsererror');
    if (errors.length > 0) {
      return errors[0].textContent?.trim() || 'XML 格式错误';
    }
    return null;
  },
  format(content) {
    try {
      return xmlFormat(content, { indentation: '  ' });
    } catch {
      return content;
    }
  },
};

/** 行尾是否以奇数个反斜杠结尾（properties 规范的续行标记，偶数个为转义反斜杠本身） */
function endsWithOddBackslashes(line: string): boolean {
  let count = 0;
  for (let i = line.length - 1; i >= 0 && line[i] === '\\'; i--) {
    count++;
  }
  return count % 2 === 1;
}

/** properties：行级校验（空行 / #! 注释跳过，其余须含 = 或 :，支持行尾 \ 续行）；美化仅去行尾空白与首尾空行 */
const propertiesFormatter: ContentFormatter = {
  canFormat: true,
  validate(content) {
    const lines = content.split('\n');
    // 续行状态：上一有效行以奇数个反斜杠结尾时，本行是多行值的后续行，跳过 = / : 检查
    let continuation = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (continuation) {
        // 续行本身也可继续以 \ 结尾向下续行
        continuation = endsWithOddBackslashes(line);
        continue;
      }
      if (line === '' || line.startsWith('#') || line.startsWith('!')) {
        continue;
      }
      if (!line.includes('=') && !line.includes(':')) {
        return `第 ${i + 1} 行格式错误：${line}`;
      }
      continuation = endsWithOddBackslashes(line);
    }
    return null;
  },
  format(content) {
    try {
      return content
        .split('\n')
        .map((line) => {
          const stripped = line.replace(/\s+$/, '');
          // 去尾空白会让行凭空以奇数个反斜杠结尾（产生续行语义）时保守保留原行，不改变语义
          return stripped !== line && endsWithOddBackslashes(stripped) ? line : stripped;
        })
        .join('\n')
        .replace(/^\n+/, '')
        .replace(/\n+$/, '');
    } catch {
      return content;
    }
  },
};

/** toml：行级校验（空行 / # 注释跳过，允许 [section] / [[array]] 与含 = 的键值行）；不支持美化 */
const tomlFormatter: ContentFormatter = {
  canFormat: false,
  validate(content) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '' || line.startsWith('#')) {
        continue;
      }
      // 两条精确匹配：普通 section 与数组表，拒绝 [foo]] / [[foo] 等畸形写法
      const isSection = /^\[[^\[\]]+\]$/.test(line) || /^\[\[[^\[\]]+\]\]$/.test(line);
      if (!isSection && !line.includes('=')) {
        return `第 ${i + 1} 行格式错误：${line}`;
      }
    }
    return null;
  },
  format(content) {
    return content;
  },
};

/** text / 未注册格式兜底：恒合法、原样返回、不支持美化 */
const plainFormatter: ContentFormatter = {
  canFormat: false,
  validate() {
    return null;
  },
  format(content) {
    return content;
  },
};

/** 格式化器注册表：与后端 format 字段取值一致 */
const formatters: Record<string, ContentFormatter> = {
  text: plainFormatter,
  json: jsonFormatter,
  yaml: yamlFormatter,
  xml: xmlContentFormatter,
  properties: propertiesFormatter,
  toml: tomlFormatter,
};

/** 按格式取格式化器，未注册格式返回兜底器（恒合法、原样返回） */
export function getFormatter(format: string): ContentFormatter {
  return formatters[format] ?? plainFormatter;
}
