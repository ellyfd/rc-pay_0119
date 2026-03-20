/**
 * 取得簡短名稱（去掉姓氏）
 * - 3 字以上中文名：去掉第一個字（姓氏），例如「陳小明」→「小明」
 * - 2 字中文名：保留原樣，例如「小明」→「小明」
 * - 含空格的名字：取第一段，例如「John Smith」→「John」
 * - 其他：保留原樣
 */
export function getShortName(name) {
  if (!name) return '';
  const trimmed = name.trim();

  // 含空格 → 取第一段
  if (trimmed.includes(' ')) {
    return trimmed.split(' ')[0];
  }

  // 中文名 3 字以上 → 去掉姓氏（第一個字）
  if (trimmed.length >= 3 && /^[\u4e00-\u9fff]/.test(trimmed)) {
    return trimmed.slice(1);
  }

  return trimmed;
}
