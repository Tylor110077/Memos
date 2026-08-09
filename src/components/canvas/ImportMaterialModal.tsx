'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Link2, Loader2, Upload, FileText, FileSpreadsheet, FileType2, FileImage, FileVideo } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useGraphStore } from '@/stores/graphStore';
import { useBoardStore } from '@/stores/boardStore';
import type { KnowledgeNode, MaterialType } from '@/types';
import { detectFileType, readFileAsText, readFileAsDataURL, type DetectedFileType } from '@/lib/fileUtils';
import { apiFetch } from '@/lib/directApi';

interface ImportMaterialModalProps {
  visible: boolean;
  onClose: () => void;
}

type ImportMode = 'url' | 'file';

export function ImportMaterialModal({ visible, onClose }: ImportMaterialModalProps) {
  const { addNode, nodes } = useGraphStore();
  const { currentBoardId } = useBoardStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL 状态
  const [url, setUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState('');
  const [scrapeError, setScrapeError] = useState('');

  // 文件状态
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = useCallback(() => {
    setUrl('');
    setIsScraping(false);
    setScrapeProgress('');
    setScrapeError('');
    setSelectedFile(null);
    setIsProcessingFile(false);
    setIsDragging(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!visible) return null;

  // 计算新节点位置
  const getNewPosition = () => {
    return nodes.length > 0
      ? {
          x: nodes[nodes.length - 1].position.x + 200,
          y: nodes[nodes.length - 1].position.y + 100,
        }
      : { x: 0, y: 0 };
  };

  // URL 导入流程
  const handleUrlImport = async () => {
    if (!url.trim() || isScraping || !currentBoardId) return;

    setIsScraping(true);
    setScrapeError('');
    setScrapeProgress('正在抓取网页内容...');

    let scrapedTitle = '';
    let scrapedContent = '';
    let scrapedFavicon = '';
    let summary = '';

    try {
      const res = await apiFetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        scrapedTitle = data.title || '';
        scrapedContent = data.content || '';
        scrapedFavicon = data.favicon || '';
        summary = data.summary || '';
        setScrapeProgress('抓取成功，正在创建节点...');
      } else {
        setScrapeError('抓取内容失败，将使用 URL 作为标题');
      }
    } catch {
      setScrapeError('抓取内容失败，将使用 URL 作为标题');
    } finally {
      setIsScraping(false);
      setScrapeProgress('');
    }

    const now = new Date().toISOString();
    const finalTitle = scrapedTitle || extractDomain(url);
    const finalContent = scrapedContent || url.trim();

    const newNode: KnowledgeNode = {
      id: `node-${nanoid(8)}`,
      boardId: currentBoardId,
      type: 'material',
      title: finalTitle,
      content: finalContent,
      level: 3,
      status: 'lit',
      position: getNewPosition(),
      summary: summary || undefined,
      metadata: {
        source: url.trim(),
        materialType: 'article',
        ...(scrapedTitle ? { scrapedTitle } : {}),
        ...(scrapedFavicon ? { scrapedFavicon } : {}),
        createdAt: now,
        updatedAt: now,
      },
    };

    addNode(newNode);
    handleClose();
  };

  // 文件处理
  const processFile = async (file: File) => {
    if (!currentBoardId) return;

    setIsProcessingFile(true);
    const fileType = detectFileType(file.name);
    const now = new Date().toISOString();

    let content = '';
    let fileData: string | undefined;
    let materialType: MaterialType = 'article';

    try {
      switch (fileType) {
        case 'markdown':
          content = await readFileAsText(file);
          materialType = 'article';
          break;
        case 'pdf':
          fileData = await readFileAsDataURL(file);
          materialType = 'pdf';
          break;
        case 'image':
          fileData = await readFileAsDataURL(file);
          materialType = 'image';
          break;
        case 'video':
          fileData = await readFileAsDataURL(file);
          materialType = 'video';
          break;
        case 'word':
        case 'excel':
          // 存储文件名，标记类型
          content = `文件: ${file.name}`;
          materialType = 'article';
          break;
        default:
          content = `文件: ${file.name}`;
      }
    } catch (e) {
      console.error('文件读取失败:', e);
      content = `文件: ${file.name}`;
    }

    const newNode: KnowledgeNode = {
      id: `node-${nanoid(8)}`,
      boardId: currentBoardId,
      type: 'material',
      title: file.name.replace(/\.[^/.]+$/, ''), // 去除扩展名
      content,
      level: 3,
      status: 'lit',
      position: getNewPosition(),
      fileData,
      metadata: {
        source: file.name,
        materialType,
        createdAt: now,
        updatedAt: now,
      },
    };

    addNode(newNode);
    setIsProcessingFile(false);
    handleClose();
  };

  // 文件选择
  const handleFileSelect = (file: File | null) => {
    if (file) {
      setSelectedFile(file);
    }
  };

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // 确认导入文件
  const handleFileImport = () => {
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  // 获取文件图标
  const getFileIcon = (fileType: DetectedFileType) => {
    switch (fileType) {
      case 'pdf':
        return <FileType2 size={24} className="text-red-400" />;
      case 'word':
        return <FileText size={24} className="text-blue-400" />;
      case 'excel':
        return <FileSpreadsheet size={24} className="text-green-400" />;
      case 'markdown':
        return <FileText size={24} className="text-purple-400" />;
      case 'image':
        return <FileImage size={24} className="text-cyan-400" />;
      case 'video':
        return <FileVideo size={24} className="text-pink-400" />;
      default:
        return <FileText size={24} className="text-gray-400" />;
    }
  };

  const selectedFileType = selectedFile ? detectFileType(selectedFile.name) : 'unknown';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-[var(--bg-secondary)] p-6 shadow-2xl shadow-black/30 border border-[var(--border)]">
        {/* 标题栏 */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
            <Upload size={20} />
            导入材料
          </h2>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* URL 输入区域 */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)] flex items-center gap-1">
            <Link2 size={14} />
            网页链接
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="粘贴网页链接..."
              className="flex-1 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] bg-[var(--bg-tertiary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
            />
            <button
              onClick={handleUrlImport}
              disabled={!url.trim() || isScraping}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {isScraping ? <Loader2 size={16} className="animate-spin" /> : '导入'}
            </button>
          </div>
          {scrapeProgress && (
            <p className="mt-1.5 text-xs text-[var(--accent)] flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              {scrapeProgress}
            </p>
          )}
          {scrapeError && (
            <p className="mt-1.5 text-xs text-amber-500">{scrapeError}</p>
          )}
        </div>

        {/* 分隔线 */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-xs text-[var(--text-muted)]">或</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* 文件拖拽区域 */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)] flex items-center gap-1">
            <Upload size={14} />
            本地文件
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${isDragging ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-strong)] hover:border-[var(--text-muted)] bg-[var(--bg-tertiary)]'}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.md,.doc,.xls,image/*,video/*,.mp4,.mov,.webm"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                {getFileIcon(selectedFileType)}
                <div className="text-left">
                  <p className="text-sm text-[var(--text-primary)] truncate max-w-[200px]">{selectedFile.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            ) : (
              <div className="text-[var(--text-muted)]">
                <Upload size={24} className="mx-auto mb-2" />
                <p className="text-sm">拖入文件或点击选择</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">支持 PDF、Word、Excel、Markdown</p>
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleFileImport}
            disabled={!selectedFile || isProcessingFile}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {isProcessingFile && <Loader2 size={14} className="animate-spin" />}
            导入文件
          </button>
        </div>
      </div>
    </div>
  );
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url.slice(0, 30);
  }
}
