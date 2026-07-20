import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return Response.json({ error: 'URL 不能为空' }, { status: 400 });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Studyboard/0.0.2)' },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    // 提取标题
    const title = $('meta[property="og:title"]').attr('content')
      || $('title').text()
      || url;

    // 提取 favicon
    const favicon = $('link[rel="icon"]').attr('href')
      || $('link[rel="shortcut icon"]').attr('href')
      || new URL('/favicon.ico', url).href;

    // 提取正文
    $('script, style, nav, header, footer, aside').remove();
    const content = $('article').text() || $('main').text() || $('body').text();
    const cleanContent = content.replace(/\s+/g, ' ').trim().slice(0, 5000);

    return Response.json({
      title: title.trim(),
      favicon: favicon.startsWith('http') ? favicon : new URL(favicon, url).href,
      content: cleanContent,
      excerpt: cleanContent.slice(0, 200),
    });
  } catch (error) {
    return Response.json({ error: '抓取失败', fallback: true }, { status: 422 });
  }
}
