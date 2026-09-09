export function isYouTubeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com') || url.hostname === 'youtu.be');
  } catch { return false; }
}

export function browserSearchUrl(value: string) {
  const query = value.trim();
  if (isYouTubeUrl(query)) return query;
  return `https://m.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
