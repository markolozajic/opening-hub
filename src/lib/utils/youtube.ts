export function parseYouTubeUrl(url: string): { videoId: string; startTime: number } | null {
  let videoId: string | null = null;
  let startTime = 0;

  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const re of patterns) {
    const match = url.match(re);
    if (match) {
      videoId = match[1];
      break;
    }
  }

  if (!videoId) return null;

  const queryMatch = url.match(/[?&](?:t|start)=(\d+)/);
  if (queryMatch) {
    startTime = parseInt(queryMatch[1], 10);
  } else {
    const hashMatch = url.match(/#t=(\d+)/);
    if (hashMatch) {
      startTime = parseInt(hashMatch[1], 10);
    }
  }

  return { videoId, startTime };
}
