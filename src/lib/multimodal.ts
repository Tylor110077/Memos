/**
 * 多模态理解辅助模块（客户端）
 * - 视频抽帧：<video> + <canvas> 抽取 N 帧转为 JPEG dataURL
 * - 图片/文件/视频理解统一入口（调用 /api/understand）
 */

/** 从视频抽取 count 帧，返回 JPEG dataURL 数组 */
export function extractVideoFrames(source: string, count = 4): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    video.src = source;

    const frames: string[] = [];
    let captured = 0;

    video.addEventListener('loadedmetadata', () => {
      const duration = video.duration || 0;
      if (!duration) return reject(new Error('无法读取视频时长'));
      const canvas = document.createElement('canvas');
      const w = (canvas.width = Math.min(640, video.videoWidth || 640));
      const h = (canvas.height = Math.round((video.videoHeight / video.videoWidth) * w) || 360);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas 不可用'));

      const times = Array.from({ length: count }, (_, i) => (duration * (i + 0.5)) / count);
      let tIdx = 0;

      const captureAt = (t: number) => {
        video.currentTime = t;
      };

      video.addEventListener('seeked', () => {
        ctx.drawImage(video, 0, 0, w, h);
        frames.push(canvas.toDataURL('image/jpeg', 0.7));
        captured++;
        tIdx++;
        if (tIdx < times.length) {
          captureAt(times[tIdx]);
        } else {
          cleanup();
          resolve(frames);
        }
      });

      const cleanup = () => {
        video.removeAttribute('src');
        video.load();
      };

      captureAt(times[0]);
    });

    video.addEventListener('error', () => reject(new Error('视频加载失败')));
    // 超时保护
    setTimeout(() => {
      if (captured === 0) reject(new Error('视频抽帧超时'));
    }, 15000);
  });
}

/** 调用 /api/understand 产出摘要 */
export async function understandContent(params: {
  type: 'image' | 'file' | 'video';
  dataUrls?: string[];
  text?: string;
  title?: string;
  apiKey?: string;
}): Promise<string> {
  const res = await fetch('/api/understand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '理解失败');
  }
  const data = await res.json();
  return data.summary || '';
}
