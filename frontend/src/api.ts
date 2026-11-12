// Where the backend lives: origin+/api in dev (Vite proxies that to the local
// backend), or the explicit VITE_API_URL in production.
export const BASE: string =
  import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : `${window.location.origin}/api`;
