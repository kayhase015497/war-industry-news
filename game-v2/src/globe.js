/**
 * Globe.gl wrapper — sits behind Phaser canvas as a decorative background.
 * The Phaser canvas is transparent, so the globe shows through empty areas.
 */

let globe = null;
let isReady = false;

// Region → [lat, lng, altitude]
const REGION_VIEWS = {
  ukraine:  [49.0,  31.0, 1.8],
  taiwan:   [23.5, 121.0, 1.6],
  red_sea:  [15.0,  43.0, 1.7],
  default:  [20.0,  15.0, 2.2],
};

export async function initGlobe(container) {
  if (globe) return globe;

  try {
    const GlobeModule = await import('globe.gl');
    const GlobeFn = GlobeModule.default;

    globe = GlobeFn()
      .globeImageUrl(
        'https://unpkg.com/three-globe/example/img/earth-night.jpg'
      )
      .bumpImageUrl(
        'https://unpkg.com/three-globe/example/img/earth-topology.png'
      )
      .backgroundImageUrl(
        'https://unpkg.com/three-globe/example/img/night-sky.png'
      )
      .backgroundColor('rgba(0,0,0,0)')
      .width(window.innerWidth)
      .height(window.innerHeight)
      (container);

    // Initial camera position
    globe.pointOfView({ lat: 20, lng: 15, altitude: 2.2 }, 0);

    // Slow auto-rotate
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.15;
    globe.controls().enableZoom = false;
    globe.controls().enablePan = false;

    // Handle window resize
    window.addEventListener('resize', () => {
      if (globe) {
        globe.width(window.innerWidth).height(window.innerHeight);
      }
    });

    isReady = true;
    return globe;
  } catch (err) {
    console.warn('[globe.js] Failed to load globe.gl:', err);
    // Fallback: show a dark background with a radial glow
    container.style.background =
      'radial-gradient(ellipse at 40% 50%, #0d2040 0%, #050a14 70%)';
    return null;
  }
}

/**
 * Smoothly rotate globe to focus on a scenario region.
 * @param {string} region - one of 'ukraine' | 'taiwan' | 'red_sea' | 'default'
 * @param {number} duration - transition ms
 */
export function focusOnRegion(region, duration = 2500) {
  if (!globe || !isReady) return;
  const [lat, lng, altitude] = REGION_VIEWS[region] ?? REGION_VIEWS.default;
  globe.pointOfView({ lat, lng, altitude }, duration);
  globe.controls().autoRotate = false;
}

/** Resume auto-rotation (e.g. on menu screen) */
export function resumeAutoRotate() {
  if (!globe || !isReady) return;
  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.15;
}

/** Pause globe animation to save GPU when not needed */
export function pauseGlobe() {
  if (!globe || !isReady) return;
  globe.controls().autoRotate = false;
}

export function getGlobe() {
  return globe;
}
