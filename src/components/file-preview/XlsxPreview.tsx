'use client';

import { useState, useEffect } from 'react';

interface XlsxPreviewProps {
  /** base64 编码的 xlsx 文件数据 */
  fileData: string;
}

/** Excel 表格预览组件：使用 xlsx 解析为 HTML 表格 */
export function XlsxPreview({ fileData }: XlsxPreviewProps) {
  const [sheets, setSheets] = useState<{ name: string; html: string }[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const XLSX = await import('xlsx');
        const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const workbook = XLSX.read(bytes, { type: 'array' });
        const result = workbook.SheetNames.map(name => ({
          name,
          html: XLSX.utils.sheet_to_html(workbook.Sheets[name], { editable: false }),
        }));
        if (!cancelled) setSheets(result);
      } catch (e) {
        if (!cancelled) setError('表格解析失败');
      }
    })();
    return () => { cancelled = true; };
  }, [fileData]);

  if (error) return <p className="text-sm text-red-400 p-4">{error}</p>;
  if (sheets.length === 0) return <p className="text-sm text-[var(--text-muted)] p-4">加载中...</p>;

  return (
    <div className="flex flex-col h-full">
      {sheets.length > 1 && (
        <div className="flex gap-1 px-4 pt-2 border-b border-[var(--border)]">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActiveSheet(i)}
              className={`px-3 py-1 text-xs rounded-t-md transition-colors ${
                i === activeSheet
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div
        className="flex-1 overflow-auto p-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--border)] [&_td]:px-2 [&_td]:py-1 [&_td]:text-xs [&_th]:border [&_th]:border-[var(--border)] [&_th]:px-2 [&_th]:py-1 [&_th]:text-xs [&_th]:font-semibold"
        dangerouslySetInnerHTML={{ __html: sheets[activeSheet]?.html || '' }}
      />
    </div>
  );
}
