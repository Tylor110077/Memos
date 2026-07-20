import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Memos",
  description: "自由探索式知识学习工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased bg-[var(--bg-primary)] text-[var(--text-primary)]" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('memos-theme') || 'abyss';
            var themes = {
              abyss: {'--bg-primary':'#0a0a0f','--bg-secondary':'#141419','--bg-tertiary':'#1c1c24','--bg-hover':'#22222b','--text-primary':'#f0f0f5','--text-secondary':'#8b8b9e','--text-muted':'#55556a','--accent':'#8b5cf6','--accent-hover':'#7c3aed','--accent-soft':'rgba(139,92,246,0.15)','--border':'rgba(255,255,255,0.06)','--border-strong':'rgba(255,255,255,0.12)','--shadow':'none','--radius':'12px','--node-concept':'#8b5cf6','--node-theme':'#a78bfa','--node-material':'#22d3ee','--node-understanding':'#60a5fa','--node-question':'#c084fc','--scrollbar':'#333345','--scrollbar-hover':'#4a4a5e'},
              aurora: {'--bg-primary':'#0d1117','--bg-secondary':'#161b22','--bg-tertiary':'#1c2128','--bg-hover':'#21262d','--text-primary':'#e6edf3','--text-secondary':'#7d8590','--text-muted':'#484f58','--accent':'#22d3ee','--accent-hover':'#06b6d4','--accent-soft':'rgba(34,211,238,0.12)','--border':'rgba(34,211,238,0.12)','--border-strong':'rgba(34,211,238,0.25)','--shadow':'0 0 20px rgba(34,211,238,0.05)','--radius':'8px','--node-concept':'#22d3ee','--node-theme':'#38bdf8','--node-material':'#34d399','--node-understanding':'#a78bfa','--node-question':'#f472b6','--scrollbar':'#21262d','--scrollbar-hover':'#30363d'},
              ember: {'--bg-primary':'#1a1412','--bg-secondary':'#241e1a','--bg-tertiary':'#2e2620','--bg-hover':'#38302a','--text-primary':'#fde8c8','--text-secondary':'#a08060','--text-muted':'#6b5540','--accent':'#f59e0b','--accent-hover':'#d97706','--accent-soft':'rgba(245,158,11,0.12)','--border':'rgba(245,158,11,0.12)','--border-strong':'rgba(245,158,11,0.25)','--shadow':'0 4px 12px rgba(0,0,0,0.3)','--radius':'6px','--node-concept':'#f59e0b','--node-theme':'#fb923c','--node-material':'#34d399','--node-understanding':'#fbbf24','--node-question':'#f87171','--scrollbar':'#2e2620','--scrollbar-hover':'#3d3530'}
            };
            var vars = themes[t] || themes.abyss;
            var s = document.documentElement.style;
            for (var k in vars) s.setProperty(k, vars[k]);
          } catch(e) {}
        `}} />
        {children}
      </body>
    </html>
  );
}
