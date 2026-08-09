/**
 * 运行模式检测
 * - server: 有 Next.js 服务端（npm run dev / electron:dev），走 API Routes
 * - direct: 静态导出（electron:build 打包桌面应用），客户端直调 Qwen API
 *
 * 通过构建时环境变量 NEXT_PUBLIC_API_MODE 切换：
 *   NEXT_PUBLIC_API_MODE=direct next build   → 桌面应用离线包
 *   （不设置）                                → 网页/开发模式
 */
export type ApiMode = 'server' | 'direct';

export const API_MODE: ApiMode =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_MODE === 'direct'
    ? 'direct'
    : 'server';

export const isDirectMode = () => API_MODE === 'direct';
export const isServerMode = () => API_MODE === 'server';
