export function isOnline(lastActive) {
  if (!lastActive) return false;

  const diff = Date.now() - new Date(lastActive).getTime();

  return diff < 60 * 1000; // 1 minute = online
}