'use client';

import { useState, useEffect } from 'react';

interface PptxPreviewProps {
  /** base64 编码的 pptx 文件数据 */
  fileData: string;
}

interface SlideContent {
  texts: string[];
}

/** PPT 预览组件：使用 JSZip 解析 pptx 提取文本按页展示 */
export function PptxPreview({ fileData }: PptxPreviewProps) {
  const [slides, setSlides] = useState<SlideContent[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const JSZip = (await import('jszip')).default;
        const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
        const zip = await JSZip.loadAsync(base64, { base64: true });

        // 提取所有 slide XML 文件
        const slideFiles = Object.keys(zip.files)
          .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
          .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
            const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
            return numA - numB;
          });

        const result: SlideContent[] = [];
        for (const slideFile of slideFiles) {
          const xml = await zip.files[slideFile].async('string');
          // 简单提取 <a:t> 标签中的文本
          const texts: string[] = [];
          const regex = /<a:t>([^<]*)<\/a:t>/g;
          let match;
          while ((match = regex.exec(xml)) !== null) {
            if (match[1].trim()) texts.push(match[1]);
          }
          result.push({ texts });
        }

        if (!cancelled) setSlides(result);
      } catch (e) {
        if (!cancelled) setError('PPT 解析失败');
      }
    })();
    return () => { cancelled = true; };
  }, [fileData]);

  if (error) return <p className="text-sm text-red-400 p-4">{error}</p>;
  if (slides.length === 0) return <p className="text-sm text-[var(--text-muted)] p-4">加载中...</p>;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {slides.map((slide, i) => (
        <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] p-4">
          <p className="text-[10px] text-[var(--text-muted)] mb-2">幻灯片 {i + 1}</p>
          {slide.texts.length > 0 ? (
            <div className="space-y-1">
              {slide.texts.map((text, j) => (
                <p key={j} className={`text-[var(--text-primary)] ${j === 0 ? 'text-sm font-semibold' : 'text-xs text-[var(--text-secondary)]'}`}>
                  {text}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic">（无文本内容）</p>
          )}
        </div>
      ))}
    </div>
  );
}
