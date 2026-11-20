let lock = null;
let wanted = false;

async function acquire() {
  if (!('wakeLock' in navigator) || lock || document.visibilityState !== 'visible') return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; });
  } catch (err) {
    // Can fail on low battery or battery-saver mode
    console.warn('Wake lock not granted:', err.name, err.message);
  }
}

async function release() {
  try { await lock?.release(); } catch {}
  lock = null;
}

// The browser drops the lock whenever the tab is hidden, so get it back on return.
document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible') acquire();
});

// Landing screen hidden = the person joined; shown again = they quit.
const landing = document.getElementById('landing-screen');
new MutationObserver(() => {
  wanted = landing.hidden;
  if (wanted) acquire(); else release();
}).observe(landing, { attributes: true, attributeFilter: ['hidden'] });