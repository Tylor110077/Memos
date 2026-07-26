/**
 * 文件名安全化工具
 * 将节点标题转换为安全的文件系统文件名
 */

const ILLEGAL_CHARS = /[/\\:*?"<>|]/g;
const MAX_LENGTH = 200;

/**
 * 将标题转换为安全的文件名（不含扩展名）
 * @param title 节点标题
 * @param fallbackId 节点 ID（用于空标题 fallback）
 */
export function sanitizeFileName(title: string, fallbackId?: string): string {
  let name = title
    // 替换非法字符
    .replace(ILLEGAL_CHARS, '_')
    // 合并连续下划线
    .replace(/_{2,}/g, '_')
    // 去除首尾空白和下划线
    .replace(/^[_\s]+|[_\s]+$/g, '');

  // 空标题 fallback
  if (!name) {
    name = `untitled-${(fallbackId || 'unknown').slice(0, 8)}`;
  }

  // 截断超长标题
  if (name.length > MAX_LENGTH) {
    name = name.slice(0, MAX_LENGTH);
  }

  return name;
}

/**
 * 生成带扩展名的完整文件名
 */
export function sanitizeMarkdownFileName(title: string, fallbackId?: string): string {
  return `${sanitizeFileName(title, fallbackId)}.md`;
}

/**
 * 生成 Board 文件夹名
 */
export function sanitizeFolderName(boardName: string, boardId?: string): string {
  return sanitizeFileName(boardName, boardId);
}
