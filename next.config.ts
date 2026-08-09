import type { NextConfig } from "next";

// 直调模式（桌面应用离线包）：静态导出，无 API Routes
// 网页/开发模式：默认，保留 API Routes
const isDirect = process.env.NEXT_PUBLIC_API_MODE === "direct";

const nextConfig: NextConfig = {
  devIndicators: false,
  // 构建时不跑 ESLint（独立用 npm run lint / typecheck 检查）
  eslint: { ignoreDuringBuilds: true },
  ...(isDirect
    ? {
        output: "export" as const,
        images: { unoptimized: true },
        // file:// 加载时资源用相对路径，否则 /_next 解析失败导致无样式
        assetPrefix: "./",
      }
    : {}),
};

export default nextConfig;
