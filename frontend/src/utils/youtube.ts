const PATTERNS = [
  /youtube\.com\/watch\?v=([\w-]+)/,
  /youtube\.com\/shorts\/([\w-]+)/,
  /youtube\.com\/embed\/([\w-]+)/,
  /youtu\.be\/([\w-]+)/,
];

export function getYoutubeEmbedUrl(url: string): string | null {
  for (const pattern of PATTERNS) {
    const match = url.match(pattern);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return null;
}
