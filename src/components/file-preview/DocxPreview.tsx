'use client';

import { useState, useEffect } from 'react';

interface DocxPreviewProps {
  /** base64 编码的 docx 文件数据 */
  fileData: string;
}

/** Word 文档预览组件：使用 mammoth 将 docx 转为 HTML */
export function DocxPreview({ fileData }: DocxPreviewProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mammoth = await import('mammoth');
        // fileData 可能是 data URL 或纯 base64
        const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
        const buffer = Buffer.from(base64, 'base64');
        const result = await mammoth.convertToHtml({ buffer });
        if (!cancelled) setHtml(result.value);
      } catch (e) {
        if (!cancelled) setError('文档解析失败');
      }
    })();
    return () => { cancelled = true; };
  }, [fileData]);

  if (error) return <p className="text-sm text-red-400 p-4">{error}</p>;
  if (!html) return <p className="text-sm text-[var(--text-muted)] p-4">加载中...</p>;

  return (
    <div
      className="prose prose-sm max-w-none prose-invert p-4 overflow-y-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
