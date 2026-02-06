export function showToast(message, type = 'info', duration = 4000) {
  try {
    const detail = typeof message === 'string' ? { message, type, duration } : { message: String(message), type, duration };
    window.dispatchEvent(new CustomEvent('show-toast', { detail }));
  } catch (e) {
    // fallback to alert if dispatch fails
    try { window.alert(typeof message === 'string' ? message : String(message)); } catch (e) {}
  }
}
