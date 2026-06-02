const API_ORIGIN = window.location.origin;

export const runtime = {
  origin: API_ORIGIN,
  api(pathname = '') {
    if (!pathname) return API_ORIGIN;
    if (pathname.startsWith('http://') || pathname.startsWith('https://')) return pathname;
    if (pathname.startsWith('/')) return `${API_ORIGIN}${pathname}`;
    return `${API_ORIGIN}/${pathname}`;
  },
};

