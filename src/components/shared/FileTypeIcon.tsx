'use client';

interface FileTypeIconProps {
  /** 文件类型标识 */
  type?: string;
  /** 文件名（用于推断类型） */
  fileName?: string;
  size?: number;
  className?: string;
}

/** 根据文件类型返回品牌色和标签 */
function getFileTypeInfo(type?: string, fileName?: string) {
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  const t = type || ext;

  switch (t) {
    case 'pdf':
      return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'PDF' };
    case 'docx':
    case 'doc':
    case 'word':
      return { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', label: 'Word' };
    case 'xlsx':
    case 'xls':
    case 'excel':
      return { color: '#22c55e', bg: 'rgba(34,197,94,0.15)', label: 'Excel' };
    case 'pptx':
    case 'ppt':
    case 'powerpoint':
      return { color: '#f97316', bg: 'rgba(249,115,22,0.15)', label: 'PPT' };
    case 'md':
    case 'markdown':
      return { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', label: 'MD' };
    default:
      return { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', label: 'File' };
  }
}

/** 文件类型图标组件：用于画布节点和详情面板 */
export function FileTypeIcon({ type, fileName, size = 24, className = '' }: FileTypeIconProps) {
  const info = getFileTypeInfo(type, fileName);

  return (
    <div
      className={`inline-flex items-center justify-center rounded-md font-bold shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: info.bg,
        color: info.color,
        fontSize: size * 0.35,
        lineHeight: 1,
      }}
      title={info.label}
    >
      {info.label}
    </div>
  );
}

/** 推断文件类型的工具函数 */
export function detectMaterialType(fileName?: string, source?: string): string | undefined {
  const ext = fileName?.split('.').pop()?.toLowerCase() || source?.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['docx', 'doc'].includes(ext)) return 'docx';
  if (['xlsx', 'xls'].includes(ext)) return 'xlsx';
  if (['pptx', 'ppt'].includes(ext)) return 'pptx';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  return undefined;
}
