/**
 * HUD — Entropy bar, paranoia eye, ambient text, arc phase.
 */

let entropyBar = null;
let entropyLabel = null;
let paranoiaEye = null;
let ambientText = null;
let arcLabel = null;
let ambientTimer = 0;
let currentAmbientIdx = 0;

export function initHUD() {
  entropyBar = document.getElementById('entropy-fill');
  entropyLabel = document.getElementById('entropy-label');
  paranoiaEye = document.getElementById('paranoia-eye');
  ambientText = document.getElementById('ambient-text');
  arcLabel = document.getElementById('arc-label');
}

export function updateHUD(gameState, dt) {
  if (!entropyBar) return;

  // Entropy bar
  const pct = Math.min(100, gameState.entropy.level * 100);
  entropyBar.style.width = `${pct}%`;
  entropyBar.style.backgroundColor = entropyColor(gameState.entropy.level);
  if (entropyLabel) {
    entropyLabel.textContent = gameState.entropy.state || 'stable';
  }

  // Paranoia eye
  if (paranoiaEye) {
    const scale = 0.5 + gameState.paranoia.level * 0.5;
    const opacity = 0.2 + gameState.paranoia.level * 0.8;
    paranoiaEye.style.transform = `scale(${scale})`;
    paranoiaEye.style.opacity = opacity;
  }

  // Ambient micro-events (rotate every 15s)
  ambientTimer += dt;
  if (ambientTimer > 15000 && ambientText) {
    ambientTimer = 0;
    const events = gameState.ambient.microEvents || gameState.entropy.markers || [];
    if (events.length > 0) {
      currentAmbientIdx = (currentAmbientIdx + 1) % events.length;
      ambientText.style.opacity = 0;
      setTimeout(() => {
        ambientText.textContent = events[currentAmbientIdx] || '';
        ambientText.style.opacity = 0.7;
      }, 500);
    }
  }

  // Arc phase
  if (arcLabel) {
    const icons = { rising: '↗', apex: '★', falling: '↘', impact: '⬤' };
    arcLabel.textContent = `${icons[gameState.arc.phase] || ''} ${gameState.arc.phase}`;
  }
}

function entropyColor(level) {
  if (level < 0.3) return '#4ADE80';      // green — stable
  if (level < 0.5) return '#FBBF24';      // yellow — unsettled
  if (level < 0.7) return '#F97316';      // orange — decaying
  if (level < 0.9) return '#EF4444';      // red — fragmenting
  return '#A855F7';                        // purple — dissolving
}
