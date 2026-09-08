export const SPACES_API_URL = (
  import.meta.env.VITE_SPACES_API_URL ||
  'https://spaces.spagotei.workers.dev'
).replace(/\/+$/, '')
