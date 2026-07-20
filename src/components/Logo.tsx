'use client';

interface LogoProps {
  size?: number;
  className?: string;
}

/** Memos 品牌 Logo：知识星座（核心节点 + 辐射连接的知识节点） */
export function Logo({ size = 48, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Memos"
    >
      <defs>
        <linearGradient id="logoBg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1c1c30" />
          <stop offset="1" stopColor="#0a0a14" />
        </linearGradient>
        <radialGradient id="logoCore" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </radialGradient>
        <radialGradient id="logoHalo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.45" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#logoBg)" />
      <circle cx="256" cy="256" r="150" fill="url(#logoHalo)" />
      <g strokeLinecap="round">
        <line x1="256" y1="256" x2="146" y2="158" stroke="#8b5cf6" strokeOpacity="0.55" strokeWidth="5" />
        <line x1="256" y1="256" x2="378" y2="168" stroke="#22d3ee" strokeOpacity="0.5" strokeWidth="5" />
        <line x1="256" y1="256" x2="164" y2="372" stroke="#60a5fa" strokeOpacity="0.5" strokeWidth="5" />
        <line x1="256" y1="256" x2="372" y2="366" stroke="#f472b6" strokeOpacity="0.5" strokeWidth="5" />
        <line x1="146" y1="158" x2="378" y2="168" stroke="#a78bfa" strokeOpacity="0.22" strokeWidth="3" />
        <line x1="164" y1="372" x2="372" y2="366" stroke="#a78bfa" strokeOpacity="0.22" strokeWidth="3" />
      </g>
      <circle cx="146" cy="158" r="24" fill="#a78bfa" />
      <circle cx="378" cy="168" r="19" fill="#22d3ee" />
      <circle cx="164" cy="372" r="19" fill="#60a5fa" />
      <circle cx="372" cy="366" r="22" fill="#f472b6" />
      <circle cx="256" cy="256" r="52" fill="url(#logoCore)" />
      <circle cx="256" cy="256" r="52" fill="none" stroke="#ddd6fe" strokeOpacity="0.7" strokeWidth="3" />
      <circle cx="240" cy="240" r="14" fill="#ede9fe" fillOpacity="0.55" />
    </svg>
  );
}
