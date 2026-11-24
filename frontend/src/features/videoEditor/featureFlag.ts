/**
 * The video editor is still being built. It opens in development, or anywhere VITE_ENABLE_VIDEO_EDITOR=true
 * (e.g. a staging build). Everywhere else the dashboard card shows "Coming soon" and the route goes back to the dashboard.
 */
export const VIDEO_EDITOR_ENABLED =
  import.meta.env.VITE_ENABLE_VIDEO_EDITOR === 'true' || (import.meta.env.DEV && import.meta.env.VITE_ENABLE_VIDEO_EDITOR !== 'false');

export const VIDEO_EDITOR_PATH = '/video-editor';
