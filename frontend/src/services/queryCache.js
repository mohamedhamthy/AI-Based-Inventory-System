const cache = new Map();
const pending = new Map();

export const getWorkspaceCacheKey = () => {
  const workspaceId =
    typeof localStorage === "undefined"
      ? "default"
      : localStorage.getItem("activeWorkspaceId") || "default";
  return workspaceId;
};

export const getCached = async (key, ttlMs, loader) => {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttlMs) return entry.value;
  if (entry) cache.delete(key);

  if (pending.has(key)) return pending.get(key);

  const request = Promise.resolve()
    .then(loader)
    .then((value) => {
      cache.set(key, { value, timestamp: Date.now() });
      return value;
    })
    .finally(() => pending.delete(key));

  pending.set(key, request);
  return request;
};

export const invalidateCache = (...prefixes) => {
  for (const key of cache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) cache.delete(key);
  }
};
