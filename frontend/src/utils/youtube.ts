const PATTERNS: { re: RegExp; isShort: boolean }[] = [
  { re: /youtube\.com\/watch\?v=([\w-]+)/, isShort: false },
  { re: /youtube\.com\/shorts\/([\w-]+)/, isShort: true },
  { re: /youtube\.com\/embed\/([\w-]+)/, isShort: false },
  { re: /youtu\.be\/([\w-]+)/, isShort: false },
];

export interface YoutubeEmbed {
  embedUrl: string;
  // Shorts are vertical (9:16) - callers should size the player frame
  // accordingly instead of the standard 16:9, or the player letterboxes hard.
  isShort: boolean;
}

export function getYoutubeEmbed(url: string): YoutubeEmbed | null {
  for (const { re, isShort } of PATTERNS) {
    const match = url.match(re);
    if (match) {
      // modestbranding/rel/iv_load_policy trim what YouTube's embed API
      // allows trimming - it doesn't remove the player's own chrome entirely.
      const params = "modestbranding=1&rel=0&iv_load_policy=3";
      return { embedUrl: `https://www.youtube.com/embed/${match[1]}?${params}`, isShort };
    }
  }
  return null;
}
