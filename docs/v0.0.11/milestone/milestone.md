# v0.0.11 Milestone — Obsidian 兼容文件系统导出与文件树视图

| # | 检查项 | 通过标准 | 状态 |
|---|--------|----------|------|
| 1 | 文件名安全化 | 含非法字符的标题正确转义，空标题有 fallback | ☐ |
| 2 | MD 生成正确 | frontmatter 完整、正文含笔记和双链、网页/文件节点格式正确 | ☐ |
| 3 | 全量导出 | 点击导出按钮后生成正确目录结构（Board文件夹/MD/attachments/canvas） | ☐ |
| 4 | 增量导出 | 仅变更节点被重写，未变更文件不触碰 | ☐ |
| 5 | PDF 文件独立存储 | base64 解码为二进制文件存入 attachments/，MD 中用链接引用 | ☐ |
| 6 | 白板独立存储 | Excalidraw JSON 存入 canvas/ 子目录 | ☐ |
| 7 | 文件树视图 | 主界面可切换文件树，正确展示目录结构，点击可打开节点 | ☐ |
| 8 | 文件树搜索 | 输入关键词实时过滤节点 | ☐ |
| 9 | 视图切换 | 画布/文件树 Tab 切换流畅，状态不丢失 | ☐ |
| 10 | 自动同步 | 设置中开启后，节点变更 2s 内自动写入 | ☐ |
| 11 | ZIP fallback | 不支持 File System Access API 时打包下载 ZIP | ☐ |
| 12 | Obsidian 兼容 | 导出目录用 Obsidian 打开，双链可跳转，frontmatter 显示为 Properties | ☐ |
| 13 | TypeScript 零错误 | `npx tsc --noEmit --skipLibCheck` 无 error | ☐ |
| 14 | Git push | 代码推送到 GitHub main 分支 | ☐ |
