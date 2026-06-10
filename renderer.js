/**
 * @file renderer.js — Cairo/Pango renderer for weather-animated@zulus
 * @module renderer
 *
 * Procedural sky rendering with multi-layer clouds, sun/moon, and fog.
 * Uses SceneBuilder scene parameters for visual state.
 */

const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const Cairo = imports.cairo;

const Constants = imports.constants;
const Utils = imports.utils;

/* ── Renderer constructor ────────────────────────────────────────────────── */

/**
 * Create a Renderer instance.
 * @constructor
 * @param {Object} desklet - The AnimatedWeatherDesklet instance
 * @returns {void}
 */
function Renderer(desklet) {
    this._d = desklet;

    // Cached cloud mask surfaces (one per layer), regenerated on density change
    this._cloudMasks = [null, null, null];
    this._lastCloudDensity = [-1, -1, -1];

    // Cached fog mask
    this._fogMask = null;
    this._fogIntensity = -1;

    // Noise texture reference (set from sceneBuilder)
    this._noiseTex = null;

    // Internal clock for fog animation drift
    this._time = 0;
    this._lastDrawTime = 0;
}

/* ── Set noise texture reference (called by desklet after SceneBuilder init) ── */

/**
 * Set the noise texture reference for cloud/fog rendering.
 * @param {Object} noiseTex - NoiseTexture instance
 * @returns {void}
 */
Renderer.prototype.setNoiseTexture = function (noiseTex) {
    this._noiseTex = noiseTex;
};

/* ══════════════════════════════════════════════════════════════════════════
 *  THEME COLOURS (unchanged from original)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Get theme colours based on current desklet settings.
 * @returns {Object} Theme colour object with isDark, text, dim, faint, err
 */
Renderer.prototype._themeColors = function () {
    const d = this._d;
    const t = d.theme || 'auto';
    const isDark = (t === 'dark') || (t === 'auto' && d._isNight());

    switch (t) {
        case 'warm':
            return {
                isDark: false,
                text: [0.95, 0.85, 0.70],
                dim:  [0.85, 0.70, 0.50],
                faint:[0.70, 0.55, 0.35],
                err:  [1.0, 0.5, 0.4]
            };
        case 'cool':
            return {
                isDark: false,
                text: [0.75, 0.85, 1.0],
                dim:  [0.55, 0.65, 0.85],
                faint:[0.40, 0.50, 0.70],
                err:  [1.0, 0.6, 0.6]
            };
        case 'nature':
            return {
                isDark: false,
                text: [0.80, 0.90, 0.75],
                dim:  [0.60, 0.75, 0.55],
                faint:[0.45, 0.60, 0.40],
                err:  [1.0, 0.6, 0.5]
            };
        default:
            return {
                isDark: isDark,
                text: isDark ? [0.878, 0.910, 1.000] : [1, 1, 1],
                dim:  isDark ? [0.533, 0.600, 0.800] : [1, 1, 1],
                faint:isDark ? [0.333, 0.400, 0.533] : [1, 1, 1],
                err:  isDark ? [1.000, 0.588, 0.588] : [1, 0.8, 0.8]
            };
    }
};

/* ══════════════════════════════════════════════════════════════════════════
 *  MAIN DRAW ENTRY POINT
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Main draw entry point. Renders the full desklet scene.
 * @param {Object} area - St.DrawingArea to draw on
 * @returns {void}
 */
Renderer.prototype.draw = function (area) {
    const cr = area.get_context();
    const d = this._d;
    const w = d._width, h = d._height;
    if (w < 50 || h < 50) return;

    // Internal time keeping (for fog animation etc.)
    const now = Date.now();
    if (this._lastDrawTime) {
        this._time += (now - this._lastDrawTime) / 1000;
        if (this._time > 10000) this._time = 0; // prevent overflow
    }
    this._lastDrawTime = now;

    try {
        cr.setSourceRGBA(0, 0, 0, 0);
        cr.paint();
    } catch (e) {
        global.logError('Draw clear error: ' + e);
        return;
    }

    // ── Clip to rounded rectangle — so ALL drawing respects rounded corners ──
    const cornerR = 24;
    this._roundRect(cr, 0, 0, w, h, cornerR);
    cr.clip();

    // ── Sky background (gradient) — only when background ON ──
    if (d.showBackground !== false) {
        try {
            const scene = d._scene || null;
            this._drawProceduralSky(cr, w, h, scene || null);
        } catch (e) { global.logError('Draw procedural sky error: ' + e); }
    }

    // ── Sun / Moon — ALWAYS drawn (even on transparent background) ──
    try {
        const scene = d._scene || null;
        if (scene) {
            this._drawSunMoon(cr, w, h, scene);
        } else {
            this._drawSimpleFallback(cr, w, h);
        }
    } catch (e) { global.logError('Draw sun/moon error: ' + e); }

    // ── Clouds — ALWAYS drawn ──
    try {
        const scene = d._scene || null;
        if (scene) {
            this._drawClouds(cr, w, h, scene);
            // Fog overlay (part of sky scene)
            if (scene.fogIntensity > 0.02) {
                this._drawFog(cr, w, h, scene);
            }
        }
    } catch (e) { global.logError('Draw clouds error: ' + e); }

    // ── Rainbow — drawn when conditions are right ──
    try {
        const scene = d._scene || null;
        if (scene) {
            this._drawRainbow(cr, w, h, scene);
        }
    } catch (e) { global.logError('Draw rainbow error: ' + e); }

    // ── Lightning flash — drawn on top of everything ──
    try {
        const scene = d._scene || null;
        if (scene) {
            this._drawLightning(cr, w, h, scene);
        }
    } catch (e) { global.logError('Draw lightning error: ' + e); }

    // ── Glass panel — only when background ON ──
    if (d.showBackground !== false) {
        try {
            this._drawGlassPanel(cr, w, h, d._scene || null);
        } catch (e) { global.logError('Draw glass panel error: ' + e); }
    }

    // Particles (rain/snow/hail) on top of glass
    try {
        if (d._particleSystem) d._particleSystem.draw(cr);
    } catch (e) { global.logError('Draw particles error: ' + e); }

    // UI overlay
    try {
        if (d._loading) this._drawLoading(cr, w, h);
        else if (d._error) this._drawError(cr, w, h, d._error);
        else if (d._weather) {
            this._drawWeather(cr, w);
            if (d.showForecast) {
                const ft = d.forecastType || 'daily';
                if (ft === 'hourly' && d._forecast) this._drawForecast(cr, w);
                else if (ft === 'daily' && d._dailyForecast) this._drawDailyForecast(cr, w);
                else if (d._forecast) this._drawForecast(cr, w); // fallback
            }
        }
    } catch (e) { global.logError('Draw UI error: ' + e); }

    // Release Cairo context to prevent memory leaks in GJS
    try { cr.$dispose(); } catch (e) {}
};

/* ══════════════════════════════════════════════════════════════════════════
 *  PROCEDURAL SCENE DRAWING
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Fallback sky rendering when scene data is not ready.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} w - Desklet width
 * @param {number} h - Desklet height
 * @returns {void}
 */
Renderer.prototype._drawSimpleFallback = function (cr, w, h) {
    const dayTop = [0.18, 0.42, 0.78], dayBot = [0.58, 0.74, 0.90];
    const nightTop = [0.03, 0.04, 0.13], nightBot = [0.10, 0.10, 0.25];
    const cloudyDayTop = [0.42, 0.47, 0.54], cloudyDayBot = [0.58, 0.63, 0.68];
    const cloudyNightTop = [0.10, 0.10, 0.14], cloudyNightBot = [0.15, 0.15, 0.22];
    const rainyDayTop = [0.32, 0.37, 0.44], rainyDayBot = [0.45, 0.50, 0.56];
    const rainyNightTop = [0.08, 0.09, 0.17], rainyNightBot = [0.12, 0.13, 0.22];
    const snowyDayTop = [0.52, 0.57, 0.64], snowyDayBot = [0.64, 0.68, 0.74];
    const snowyNightTop = [0.12, 0.12, 0.22], snowyNightBot = [0.18, 0.18, 0.30];
    const stormyTop = [0.08, 0.10, 0.16], stormyBot = [0.14, 0.16, 0.22];
    const foggyTop = [0.55, 0.60, 0.68], foggyBot = [0.65, 0.70, 0.78];

    let top, bot;
    if (wid >= 200 && wid < 300) { top = stormyTop; bot = stormyBot; }
    else if (wid >= 300 && wid < 600) { top = night ? rainyNightTop : rainyDayTop; bot = night ? rainyNightBot : rainyDayBot; }
    else if (wid >= 600 && wid < 700) { top = night ? snowyNightTop : snowyDayTop; bot = night ? snowyNightBot : snowyDayBot; }
    else if (wid >= 700 && wid < 800) { top = foggyTop; bot = foggyBot; }
    else if (wid === 800) { top = night ? nightTop : dayTop; bot = night ? nightBot : dayBot; }
    else if (wid >= 801) { top = night ? cloudyNightTop : cloudyDayTop; bot = night ? cloudyNightBot : cloudyDayBot; }
    else { top = stormyTop; bot = cloudyDayBot; }

    const pat = new Cairo.LinearGradient(0, 0, 0, h);
    pat.addColorStopRGBA(0, top[0], top[1], top[2], 1);
    pat.addColorStopRGBA(1, bot[0], bot[1], bot[2], 1);
    cr.setSource(pat);
    cr.rectangle(0, 0, w, h);
    cr.fill();
};

/* ══════════════════════════════════════════════════════════════════════════
 *  1. PROCEDURAL SKY GRADIENT
 *  Multi-stop gradient adapting to time of day, weather, and sun position
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Draw the procedural sky gradient.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} w - Desklet width
 * @param {number} h - Desklet height
 * @param {Object} scene - Scene parameters object
 * @returns {void}
 */
Renderer.prototype._drawProceduralSky = function (cr, w, h, scene) {
    // ── Three-stop vertical gradient ──
    // Top → Mid → Bottom (horizon)
    // Additional horizon glow near the bottom

    const top = scene.skyTopColor;
    const mid = scene.skyMidColor;
    const bot = scene.skyBottomColor;

    const pat = new Cairo.LinearGradient(0, 0, 0, h);

    // Top third: sky top color
    pat.addColorStopRGBA(0, top[0], top[1], top[2], 1);
    // Mid third: blend
    pat.addColorStopRGBA(0.35, mid[0], mid[1], mid[2], 1);
    // Bottom (horizon): lighter
    pat.addColorStopRGBA(0.75, bot[0], bot[1], bot[2], 1);

    // Horizon glow strip at the very bottom
    const glow = scene.horizonGlow || bot;
    pat.addColorStopRGBA(0.92, glow[0], glow[1], glow[2], 0.8);
    pat.addColorStopRGBA(1, glow[0], glow[1], glow[2], 1);

    cr.setSource(pat);
    cr.rectangle(0, 0, w, h);
    cr.fill();
};

/* ══════════════════════════════════════════════════════════════════════════
 *  2. SUN / MOON
 *  Procedural rendering with radial gradients and glow
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Draw the sun or moon with glow effects.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} w - Desklet width
 * @param {number} h - Desklet height
 * @param {Object} scene - Scene parameters object
 * @returns {void}
 */
Renderer.prototype._drawSunMoon = function (cr, w, h, scene) {
    if (scene.sunElevation < -5 && !scene.isNight) return; // below horizon

    // Calculate sun/moon position — now in TOP-RIGHT corner
    if (scene.isNight || scene.sunElevation < -2) {
        // ── DRAW MOON ──
        const moonEl = scene.moonElevation || 40;
        // Moon in top-right: X near right edge, Y high
        const moonX = w - Math.min(w * 0.12, 45);
        const moonY = Math.min(h * 0.08, 30) + (1 - (moonEl + 10) / 80) * 20;
        const moonR = Math.min(w, h) * 0.035;

        if (scene.moonVisible) {
            this._drawMoon(cr, moonX, moonY, moonR, scene);
        }
        return;
    }

    // ── DRAW SUN — top-right corner ──
    const sunEl = scene.sunElevation;
    if (sunEl <= 0) return;
    // Y position: smooth arc, anchored in top-right
    const sunBaseY = Math.min(h * 0.08, 30);
    const sunHorizonY = h * 0.55;
    const sunY = sunBaseY + (sunHorizonY - sunBaseY) * (1 - sunEl / 90);
    const sunR = Math.min(w, h) * (0.035 + 0.02 * (1 - sunEl / 90));

    // X position: fixed near right edge, slight horizontal drift
    const sunX = w - Math.min(w * 0.12, 45) + Math.sin(sunEl / 90 * Math.PI) * 8;

    // Sun glow (outer)
    const glowR = sunR * 5;
    const glow = new Cairo.RadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, glowR);
    const c = scene.sunGlowColor;
    glow.addColorStopRGBA(0, c[0], c[1], c[2], 0.4);
    glow.addColorStopRGBA(0.3, c[0], c[1], c[2], 0.15);
    glow.addColorStopRGBA(0.7, c[0], c[1], c[2], 0.04);
    glow.addColorStopRGBA(1, c[0], c[1], c[2], 0);
    cr.setSource(glow);
    cr.rectangle(0, 0, w, h);
    cr.fill();

    // Sun inner glow
    const innerR = sunR * 2.5;
    const inner = new Cairo.RadialGradient(sunX, sunY, 0, sunX, sunY, innerR);
    const sc = scene.sunColor;
    inner.addColorStopRGBA(0, 1, 1, 1, 1);
    inner.addColorStopRGBA(0.15, sc[0], sc[1], sc[2], 0.9);
    inner.addColorStopRGBA(0.6, sc[0], sc[1], sc[2], 0.3);
    inner.addColorStopRGBA(1, sc[0], sc[1], sc[2], 0);
    cr.setSource(inner);
    cr.rectangle(0, 0, w, h);
    cr.fill();

    // Sun disk — slightly warm centre, subtly cooler edge (real solar disc effect)
    const disk = new Cairo.RadialGradient(sunX - sunR * 0.15, sunY - sunR * 0.15, 0,
        sunX, sunY, sunR);
    disk.addColorStopRGBA(0, 1, 1, 0.96, 1);
    disk.addColorStopRGBA(0.35, 1, 0.98, 0.90, 0.98);
    disk.addColorStopRGBA(0.75, sc[0], sc[1], sc[2], 0.85);
    disk.addColorStopRGBA(0.9, sc[0], sc[1], sc[2], 0.6);
    disk.addColorStopRGBA(1, sc[0], sc[1], sc[2], 0.15);
    cr.setSource(disk);
    cr.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    cr.fill();

    // ── Atmospheric halo around the sun (aerial perspective) ──
    if (sunEl < 30) {
        const halo = new Cairo.RadialGradient(sunX, sunY, sunR, sunX, sunY, sunR * 8);
        const hc = scene.sunGlowColor;
        halo.addColorStopRGBA(0, hc[0], hc[1], hc[2], 0.08);
        halo.addColorStopRGBA(0.5, hc[0], hc[1], hc[2], 0.03);
        halo.addColorStopRGBA(1, hc[0], hc[1], hc[2], 0);
        cr.setSource(halo);
        cr.rectangle(0, 0, w, h);
        cr.fill();
    }

    // ── Horizon glow at sunrise/sunset ──
    if (sunEl < 15 && sunEl > 0) {
        const factor = (15 - sunEl) / 15;
        const hGlow = new Cairo.LinearGradient(0, h * 0.7, 0, h);
        const hc = [1.0, 0.6 - factor * 0.3, 0.2 - factor * 0.2];
        hGlow.addColorStopRGBA(0, hc[0], hc[1], hc[2], 0);
        hGlow.addColorStopRGBA(0.3, hc[0], hc[1], hc[2], 0.05 * factor);
        hGlow.addColorStopRGBA(0.7, hc[0], hc[1], hc[2], 0.15 * factor);
        hGlow.addColorStopRGBA(1, hc[0], hc[1], hc[2], 0.25 * factor);
        cr.setSource(hGlow);
        cr.rectangle(0, 0, w, h);
        cr.fill();
    }
};

/**
 * Draw the moon with phase shadow and glow.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} x - Moon X position
 * @param {number} y - Moon Y position
 * @param {number} r - Moon radius
 * @param {Object} scene - Scene parameters object
 * @returns {void}
 */
Renderer.prototype._drawMoon = function (cr, x, y, r, scene) {
    // Moon glow — soft silvery-blue atmospheric halo
    const glowR = r * 4.5;
    const glow = new Cairo.RadialGradient(x, y, r * 0.25, x, y, glowR);
    glow.addColorStopRGBA(0, 0.75, 0.80, 1.0, 0.18);
    glow.addColorStopRGBA(0.3, 0.60, 0.68, 0.95, 0.08);
    glow.addColorStopRGBA(0.65, 0.35, 0.45, 0.80, 0.02);
    glow.addColorStopRGBA(1, 0.20, 0.28, 0.60, 0);
    cr.setSource(glow);
    cr.rectangle(0, 0, this._d._width, this._d._height);
    cr.fill();

    // Moon disk — soft silvery white with subtle cool tint
    cr.setSourceRGBA(0.96, 0.97, 1.0, 0.88);
    cr.arc(x, y, r, 0, Math.PI * 2);
    cr.fill();

    // Moon phase (softer crescent using a radial gradient shadow)
    const phase = scene.moonPhase || 0;
    // phase 0 = new moon, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter
    if (Math.abs(phase - 0.5) > 0.02) {
        let shadowOffset;
        if (phase < 0.5) {
            shadowOffset = -r * 1.5 * (1 - phase * 2);
        } else {
            shadowOffset = r * 1.5 * (phase - 0.5) * 2;
        }
        // Use a radial gradient centred on the shadow offset for a soft terminator
        const shadow = new Cairo.RadialGradient(
            x + shadowOffset, y, r * 0.2,
            x + shadowOffset, y, r * 1.4
        );
        shadow.addColorStopRGBA(0, 0.05, 0.05, 0.12, 0.92);
        shadow.addColorStopRGBA(0.35, 0.05, 0.05, 0.12, 0.55);
        shadow.addColorStopRGBA(0.7, 0.05, 0.05, 0.12, 0.12);
        shadow.addColorStopRGBA(1, 0.05, 0.05, 0.12, 0);
        cr.setSource(shadow);
        cr.arc(x, y, r * 1.02, 0, Math.PI * 2);
        cr.fill();
    }

    // Soft inner highlight (opposite side of phase)
    cr.setSourceRGBA(0.98, 0.99, 1.0, 0.15);
    cr.arc(x - r * 0.2, y - r * 0.2, r * 0.6, 0, Math.PI * 2);
    cr.fill();
};

/* ══════════════════════════════════════════════════════════════════════════
 *  3. MULTI-LAYER CLOUDS
 *  Three parallax cloud layers using noise texture as mask
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Draw three layers of parallax clouds.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} w - Desklet width
 * @param {number} h - Desklet height
 * @param {Object} scene - Scene parameters object
 * @returns {void}
 */
Renderer.prototype._drawClouds = function (cr, w, h, scene) {
    if (!this._noiseTex) return;

    // Draw layers from far to near (back to front)
    for (let layer = 0; layer < 3; layer++) {
        const opacity = scene.cloudOpacity[layer];
        if (opacity < 0.01) continue;

        this._drawCloudLayer(cr, w, h, scene, layer);
    }
};

/**
 * Draw a single cloud layer using noise mask.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} w - Desklet width
 * @param {number} h - Desklet height
 * @param {Object} scene - Scene parameters object
 * @param {number} layer - Cloud layer index (0-2)
 * @returns {void}
 */
Renderer.prototype._drawCloudLayer = function (cr, w, h, scene, layer) {
    const noiseTex = this._noiseTex;
    const noiseSurface = noiseTex.getSurface();
    if (!noiseSurface) return;

    const density = scene.cloudDensity[layer];
    const scale = scene.cloudScale[layer];
    const offset = (scene.cloudOffsets && scene.cloudOffsets[layer]) || 0;
    const opacity = scene.cloudOpacity[layer];

    // Get or create cloud mask surface for this density
    const mask = this._getCloudMask(noiseTex, density, layer);
    if (!mask) return;

    // Build cloud color: base white/grey tinted by sky colors for atmospheric integration
    const isNight = scene.isNight;
    const skyTop = scene.skyTopColor;
    const skyBot = scene.skyBottomColor;

    let col;
    if (isNight) {
        // Dark clouds at night, slightly picking up moonlight blue
        col = [0.18, 0.18, 0.24];
    } else if (scene.precipitationType === 'rain' || scene.precipitationType === 'thunder' || scene.precipitationType === 'hail') {
        col = [0.42, 0.45, 0.52];
    } else if (scene.precipitationType === 'snow') {
        col = [0.62, 0.65, 0.72];
    } else if (scene.sunElevation > 0 && scene.sunElevation < 20) {
        // Sunset: warm clouds — tint with sky bottom color
        const sf = (20 - scene.sunElevation) / 20;
        col = [0.85 + sf * 0.12, 0.62 + sf * 0.15, 0.48 - sf * 0.18];
    } else {
        // Default white-grey with subtle sky blue influence
        col = [0.78, 0.82, 0.88];
    }

    // Apply scene ambient light and blend with sky color
    const amb = scene.ambientLight;
    col[0] = col[0] * 0.7 + skyTop[0] * 0.3;
    col[1] = col[1] * 0.7 + skyTop[1] * 0.3;
    col[2] = col[2] * 0.7 + skyTop[2] * 0.3;
    col[0] *= amb[0] * 0.85 + 0.15;
    col[1] *= amb[1] * 0.85 + 0.15;
    col[2] *= amb[2] * 0.85 + 0.15;

    // Clamp
    col[0] = Math.max(0, Math.min(1, col[0]));
    col[1] = Math.max(0, Math.min(1, col[1]));
    col[2] = Math.max(0, Math.min(1, col[2]));

    cr.save();

    // Set up the mask pattern
    let pattern;
    try { pattern = new Cairo.Pattern(mask); } catch (e) {
        try { pattern = Cairo.Pattern.createForSurface(mask); } catch (e) { cr.restore(); return; }
    }
    try { pattern.setExtend(Cairo.Extend.REPEAT); } catch (e) {}

    // Create transform matrix: scale for parallax + scroll for animation
    // Base scale: map 256px noise texture to screen with parallax factor
    const px = layer === 0 ? 1.5 : (layer === 1 ? 1.0 : 0.6);
    const sx = w / 256 * (1 / scale) * px;
    const sy = h / 256 * (1 / scale) * px;

    const tx = offset * 80; // Scroll offset
    const ty = layer * 15 + offset * 5; // Vertical offset per layer

    try {
        const matrix = new Cairo.Matrix(sx, 0, 0, sy, tx, ty);
        pattern.setMatrix(matrix);
    } catch (e) {
        // Cairo.Matrix not available in this version — use translate hack
        try { cr.setSourceSurface(mask, tx % 256, ty % 256); } catch (e) {}
    }

    // Apply the cloud mask with the cloud color
    cr.setSourceRGBA(col[0], col[1], col[2], opacity * 0.8);
    cr.mask(pattern);

    cr.restore();
};

/**
 * Get or create a cached cloud mask surface for a given density.
 * @param {Object} noiseTex - NoiseTexture instance
 * @param {number} density - Cloud density [0, 1]
 * @param {number} layer - Cloud layer index (0-2)
 * @returns {Cairo.ImageSurface|null} Cloud mask surface or null
 */
Renderer.prototype._getCloudMask = function (noiseTex, density, layer) {
    // Regenerate if density changed significantly
    if (this._cloudMasks[layer] === null ||
        Math.abs(this._lastCloudDensity[layer] - density) > 0.05) {

        this._lastCloudDensity[layer] = density;
        this._cloudMasks[layer] = this._generateCloudMask(noiseTex, density);
    }
    return this._cloudMasks[layer];
};

/**
 * Generate a cloud mask surface from noise data with thresholding.
 * @param {Object} noiseTex - NoiseTexture instance
 * @param {number} density - Cloud density [0, 1]
 * @returns {Cairo.ImageSurface|null} Cloud mask surface or null
 */
Renderer.prototype._generateCloudMask = function (noiseTex, density) {
    const size = 256;
    let surface;
    let isA8 = false;

    // Try A8 first (8-bit alpha-only), fallback to ARGB32
    try {
        surface = new Cairo.ImageSurface(Cairo.Format.A8, size, size);
        isA8 = true;
    } catch (e) {
        try {
            surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, size, size);
        } catch (e) {
            return null;
        }
    }

    // Generate mask pixel data using get_data() if available
    let canWriteDirect = false;
    let data;
    try {
        data = surface.get_data();
        canWriteDirect = (data !== null && data !== undefined);
    } catch (e) {
        canWriteDirect = false;
    }

    if (canWriteDirect && isA8) {
        // Fast path: write directly to A8 surface data
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const cloudVal = this._computeCloudMaskValue(noiseTex, x, y, density);
                data[y * size + x] = cloudVal;
            }
        }
    } else if (canWriteDirect && !isA8) {
        // Fast path: write directly to ARGB32 surface data
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const cloudVal = this._computeCloudMaskValue(noiseTex, x, y, density);
                const offset = (y * size + x) * 4;
                data[offset]     = cloudVal; // B
                data[offset + 1] = cloudVal; // G
                data[offset + 2] = cloudVal; // R
                data[offset + 3] = cloudVal; // A
            }
        }
    } else {
        // Slow fallback: per-pixel Cairo drawing
        const cr = new Cairo.Context(surface);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const cloudVal = this._computeCloudMaskValue(noiseTex, x, y, density);
                const v = cloudVal / 255;
                cr.setSourceRGBA(v, v, v, v);
                cr.rectangle(x, y, 1, 1);
                cr.fill();
            }
        }
    }

    try { surface.mark_dirty(); } catch (e) {}

    return surface;
};

/**
 * Compute a single cloud mask pixel value.
 * @param {Object} noiseTex - NoiseTexture instance
 * @param {number} x - Pixel X coordinate
 * @param {number} y - Pixel Y coordinate
 * @param {number} density - Cloud density [0, 1]
 * @returns {number} Byte value (0-255) for the mask pixel
 */
Renderer.prototype._computeCloudMaskValue = function (noiseTex, x, y, density) {
    // Sample noise and apply density threshold
    const noiseVal = noiseTex.sample(x, y);
    // noiseVal is in [-1, 1], threshold based on density
    // Higher density = lower threshold = more cloud
    const threshold = 0.6 - density * 0.5;
    let cloudVal;
    if (noiseVal > threshold) {
        cloudVal = Math.min(255, Math.floor((noiseVal - threshold) /
                             (1 - threshold) * 255));
    } else {
        cloudVal = 0;
    }

    // Add some texture variation at the edges
    if (cloudVal > 0 && cloudVal < 255) {
        const noise2 = noiseTex.sample(x * 3 + 50, y * 3 + 50);
        cloudVal = Math.floor(cloudVal * (0.7 + 0.3 * (noise2 + 1) / 2));
        cloudVal = Math.max(0, Math.min(255, cloudVal));
    }

    return cloudVal;
};

/* ══════════════════════════════════════════════════════════════════════════
 *  4. PROCEDURAL FOG
 *  Non-uniform fog using noise texture
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Draw procedural fog using noise texture.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} w - Desklet width
 * @param {number} h - Desklet height
 * @param {Object} scene - Scene parameters object
 * @returns {void}
 */
Renderer.prototype._drawFog = function (cr, w, h, scene) {
    const fogInt = scene.fogIntensity;
    if (fogInt < 0.02) return;

    // Regenerate fog mask if intensity changed
    if (this._fogMask === null || Math.abs(this._fogIntensity - fogInt) > 0.05) {
        this._fogIntensity = fogInt;
        this._fogMask = this._generateFogMask(fogInt);
    }

    if (!this._fogMask) {
        // Simple uniform fog fallback
        const fogColor = scene.isNight ? [0.05, 0.05, 0.10] : [0.6, 0.65, 0.72];
        cr.setSourceRGBA(fogColor[0], fogColor[1], fogColor[2], fogInt * 0.3);
        cr.rectangle(0, 0, w, h);
        cr.fill();
        return;
    }

    // Create pattern from fog mask
    let pattern;
    try { pattern = new Cairo.Pattern(this._fogMask); } catch (e) {
        try { pattern = Cairo.Pattern.createForSurface(this._fogMask); } catch (e) { return; }
    }
    try { pattern.setExtend(Cairo.Extend.REPEAT); } catch (e) {}

    // Slow drift for the fog
    const time = this._time;
    const tx = time * 2;
    const ty = time * 0.5;
    try {
        const matrix = new Cairo.Matrix(w / 256 * 3, 0, 0, h / 256 * 3, tx, ty);
        pattern.setMatrix(matrix);
    } catch (e) {}

    const fogColor = scene.isNight ? [0.05, 0.05, 0.10] : [0.55, 0.60, 0.68];
    cr.setSourceRGBA(fogColor[0], fogColor[1], fogColor[2], fogInt * 0.35);
    cr.mask(pattern);
};

/**
 * Generate a fog density mask surface.
 * @param {number} intensity - Fog intensity [0, 1]
 * @returns {Cairo.ImageSurface|null} Fog mask surface or null
 */
Renderer.prototype._generateFogMask = function (intensity) {
    const size = 256;
    let surface;
    let isA8 = false;

    try {
        surface = new Cairo.ImageSurface(Cairo.Format.A8, size, size);
        isA8 = true;
    } catch (e) {
        try {
            surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, size, size);
        } catch (e) {
            return null;
        }
    }

    const noiseTex = this._noiseTex;
    if (!noiseTex) return null;

    // Try direct data write first
    let data;
    let canWriteDirect = false;
    try {
        data = surface.get_data();
        canWriteDirect = (data !== null && data !== undefined);
    } catch (e) {}

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Fog uses fBm sample with lower frequency for wispy look
            const val = noiseTex.fBmSample(x / size * 4, y / size * 4, 3);
            // Remap: fog is visible where noise > threshold
            let fogVal = (val + 1) * 0.5; // [0, 1]
            // Fog threshold: intensity controls how much fog there is
            const threshold = 0.7 - intensity * 0.3;
            if (fogVal > threshold) {
                fogVal = Math.min(1, (fogVal - threshold) / (1 - threshold));
            } else {
                fogVal = 0;
            }
            // Bottom-heavy (more fog near ground)
            const vertical = (size - y) / size;
            fogVal *= (0.3 + 0.7 * vertical);

            let byteVal = Math.floor(fogVal * 255 * intensity * 1.2);
            byteVal = Math.max(0, Math.min(255, byteVal));

            if (canWriteDirect) {
                if (isA8) {
                    data[y * size + x] = byteVal;
                } else {
                    const offset = (y * size + x) * 4;
                    data[offset]     = byteVal;
                    data[offset + 1] = byteVal;
                    data[offset + 2] = byteVal;
                    data[offset + 3] = byteVal;
                }
            }
        }
    }

    if (canWriteDirect) {
        try { surface.mark_dirty(); } catch (e) {}
    }

    return surface;
};

/* ══════════════════════════════════════════════════════════════════════════
 *  GLASS PANEL (dynamic scene-adaptive tinting)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Draw the glass panel overlay with scene-adaptive tinting.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} w - Desklet width
 * @param {number} h - Desklet height
 * @param {Object|null} scene - Scene parameters object or null
 * @returns {void}
 */
Renderer.prototype._drawGlassPanel = function (cr, w, h, scene) {
    const d = this._d;
    const isDark = this._themeColors().isDark;

    const o = (d.opacity || 70) / 100;
    const pad = 20, r = 24;
    const pH = h - pad * 2, pY = pad;

    // ── Scene-adaptive tint ──
    let tint = [1, 1, 1]; // default white
    if (scene && scene.panelTint) {
        tint = scene.panelTint;
    }

    // Shadow — softer, wider spread for realistic depth
    cr.setSourceRGBA(0, 0, 0, 0.12 * o);
    this._roundRect(cr, pad + 1, pY + 2, w - pad * 2 - 2, pH - 2, r);
    cr.fill();

    // Inner shadow / rim highlight — etched glass edge effect
    cr.setSourceRGBA(0, 0, 0, 0.08 * o);
    this._roundRect(cr, pad + 1, pY + 1, w - pad * 2 - 2, pH - 2, r);
    cr.fill();

    // Main glass fill with scene tint
    const glassDark = [
        0.039 * tint[0],
        0.039 * tint[1],
        0.118 * tint[2]
    ];
    const glassLight = [
        1.0 * tint[0],
        1.0 * tint[1],
        1.0 * tint[2]
    ];

    if (isDark) {
        cr.setSourceRGBA(glassDark[0], glassDark[1], glassDark[2], 0.72 * o);
    } else {
        cr.setSourceRGBA(
            Math.min(1, glassLight[0]),
            Math.min(1, glassLight[1]),
            Math.min(1, glassLight[2]),
            0.10 * o
        );
    }
    this._roundRect(cr, pad, pY, w - pad * 2, pH, r);
    cr.fill();

    // Subtle glass depth gradient (top-to-bottom light attenuation)
    const glassGrad = new Cairo.LinearGradient(0, pad, 0, pad + pH);
    if (isDark) {
        glassGrad.addColorStopRGBA(0, 0, 0, 0, 0);
        glassGrad.addColorStopRGBA(0.6, 0, 0, 0, 0);
        glassGrad.addColorStopRGBA(1, 0, 0, 0, 0.06 * o);
    } else {
        glassGrad.addColorStopRGBA(0, 1, 1, 1, 0.03 * o);
        glassGrad.addColorStopRGBA(0.4, 1, 1, 1, 0);
        glassGrad.addColorStopRGBA(0.7, 0, 0, 0, 0);
        glassGrad.addColorStopRGBA(1, 0, 0, 0, 0.04 * o);
    }
    cr.setSource(glassGrad);
    this._roundRect(cr, pad, pY, w - pad * 2, pH, r);
    cr.fill();

    // Border with scene-tinted color
    const border = isDark
        ? [0.35 * tint[0], 0.52 * tint[1], 1.0 * tint[2]]
        : [1.0 * tint[0], 1.0 * tint[1], 1.0 * tint[2]];

    cr.setLineWidth(1.2);
    cr.setSourceRGBA(
        Math.min(1, border[0]),
        Math.min(1, border[1]),
        Math.min(1, border[2]),
        (isDark ? 0.12 : 0.18) * o
    );
    this._roundRect(cr, pad, pY, w - pad * 2, pH, r);
    cr.stroke();

    // Top rim light reflection — realistic glass edge catch
    if (!isDark) {
        const rimGrad = new Cairo.LinearGradient(0, pad - 1, 0, pad + 8);
        rimGrad.addColorStopRGBA(0, 1, 1, 1, 0);
        rimGrad.addColorStopRGBA(0.35, 1, 1, 1, 0.09 * o);
        rimGrad.addColorStopRGBA(1, 1, 1, 1, 0);
        cr.setSource(rimGrad);
        cr.rectangle(pad + r, pad, w - pad * 2 - r * 2, 8);
        cr.fill();
    } else {
        // Subtle dark glass rim catch
        const rimGrad = new Cairo.LinearGradient(0, pad - 1, 0, pad + 6);
        rimGrad.addColorStopRGBA(0, 0.5, 0.5, 1.0, 0);
        rimGrad.addColorStopRGBA(0.4, 0.5, 0.5, 1.0, 0.04 * o);
        rimGrad.addColorStopRGBA(1, 0.5, 0.5, 1.0, 0);
        cr.setSource(rimGrad);
        cr.rectangle(pad + r, pad, w - pad * 2 - r * 2, 6);
        cr.fill();
    }
};

/* ══════════════════════════════════════════════════════════════════════════
 *  LIGHTNING FLASH (thunderstorm effect)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Draw lightning flash effect for thunderstorm weather.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} w - Desklet width
 * @param {number} h - Desklet height
 * @param {Object} scene - Scene parameters object
 * @returns {void}
 */
Renderer.prototype._drawLightning = function (cr, w, h, scene) {
    if (scene.precipitationType !== 'thunder' && scene.precipitationType !== 'hail') {
        this._lightningTimer = 0;
        this._lightningAlpha = 0;
        return;
    }

    // Lightning timing
    if (this._lightningTimer === undefined) this._lightningTimer = 0;
    if (this._lightningAlpha === undefined) this._lightningAlpha = 0;

    this._lightningTimer += 1 / 30; // ~one animation frame

    // Random lightning strikes
    if (this._lightningAlpha <= 0.01) {
        // Wait random interval before next strike (3-15 seconds)
        if (this._lightningTimer > 3 + Math.random() * 12) {
            this._lightningAlpha = 0.6 + Math.random() * 0.4;
            this._lightningTimer = 0;
        }
    } else {
        // Flash decays quickly
        this._lightningAlpha *= 0.85;
        if (this._lightningAlpha < 0.01) {
            this._lightningAlpha = 0;
        }
    }

    if (this._lightningAlpha > 0.01) {
        const a = this._lightningAlpha;

        // Use a deterministic pseudo-random hotspot for consistency within a strike
        const seed = Math.floor(this._lightningTimer * 100) % 100;
        const hotX = w * (0.2 + (seed % 7) * 0.1);
        const hotY = h * (0.15 + (seed % 5) * 0.1);

        // Radial flash from hotspot — simulates the bright core of a lightning strike
        const flash = new Cairo.RadialGradient(hotX, hotY, w * 0.02, hotX, hotY, Math.max(w, h) * 0.9);
        flash.addColorStopRGBA(0, 1, 1, 1, a * 0.22);
        flash.addColorStopRGBA(0.25, 0.95, 0.95, 1.0, a * 0.10);
        flash.addColorStopRGBA(0.6, 0.85, 0.88, 1.0, a * 0.03);
        flash.addColorStopRGBA(1, 0.5, 0.55, 0.8, 0);
        cr.setSource(flash);
        cr.rectangle(0, 0, w, h);
        cr.fill();

        // Secondary crisp flash (brief bright core)
        if (a > 0.3) {
            const flash2 = new Cairo.RadialGradient(hotX, hotY, w * 0.005, hotX, hotY, w * 0.35);
            flash2.addColorStopRGBA(0, 1, 1, 1, a * 0.12);
            flash2.addColorStopRGBA(0.4, 0.9, 0.92, 1.0, a * 0.04);
            flash2.addColorStopRGBA(1, 0.7, 0.75, 0.95, 0);
            cr.setSource(flash2);
            cr.rectangle(0, 0, w, h);
            cr.fill();
        }
    }
};

/* ══════════════════════════════════════════════════════════════════════════
 *  RAINBOW EFFECT (appears when sun is low + light rain)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Draw a rainbow arc when conditions are right (low sun + light rain).
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} w - Desklet width
 * @param {number} h - Desklet height
 * @param {Object} scene - Scene parameters object
 * @returns {void}
 */
Renderer.prototype._drawRainbow = function (cr, w, h, scene) {
    // Rainbow conditions: sun low (5-35°), light rain or just after rain
    const sunEl = scene.sunElevation;
    const isRainy = (scene.precipitationType === 'rain' || scene.precipitationType === 'drizzle');
    const lightPrecip = scene.precipitation < 0.6;
    const sunnyEnough = sunEl > 5 && sunEl < 35;

    if (!sunnyEnough || !isRainy || !lightPrecip) return;

    // Rainbow opacity: strongest around 20° sun elevation
    let intensity = 1 - Math.abs(sunEl - 20) / 15;
    if (intensity < 0.1) return;
    intensity = Math.min(1, intensity) * 0.35; // max 35% opacity

    // Rainbow arc in the lower-left area of the desklet
    const cx = w * 0.3;
    const cy = h * 0.85;
    const r1 = Math.min(w, h) * 0.35;
    const r2 = r1 * 0.85; // inner radius
    const r3 = r1 * 0.90;
    const r4 = r1 * 0.95;
    const r5 = r1 * 1.0;

    // Rainbow colors (ROYGBV)
    const colors = [
        [1.0, 0.2, 0.1, intensity],       // red
        [1.0, 0.6, 0.1, intensity * 0.9], // orange
        [1.0, 0.9, 0.1, intensity * 0.8], // yellow
        [0.3, 0.8, 0.3, intensity * 0.7], // green
        [0.2, 0.4, 0.9, intensity * 0.6], // blue
        [0.5, 0.2, 0.8, intensity * 0.5]  // violet
    ];

    const radii = [r1, r2, r3, r4, r5];
    const arcStart = Math.PI * 0.1;
    const arcEnd = Math.PI * 0.9;

    for (let i = 0; i < colors.length && i < radii.length; i++) {
        const r = radii[i];
        const c = colors[i];
        cr.setSourceRGBA(c[0], c[1], c[2], c[3]);
        cr.setLineWidth(Math.min(w, h) * 0.025);
        cr.newPath();
        cr.arc(cx, cy, r, arcStart, arcEnd);
        cr.stroke();
    }
};

/**
 * Draw centred Pango text at a given x baseline.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {string} txt - Text to render
 * @param {number} cx - Centre X position
 * @param {number} y - Y baseline position
 * @param {number} sz - Font size
 * @param {boolean} bold - Whether to use bold weight
 * @returns {void}
 */
Renderer.prototype._cpango = function (cr, txt, cx, y, sz, bold) {
    this._drawPango(cr, txt, cx - this._pangoWidth(cr, txt, sz, bold) / 2, y, sz, bold);
};

/* ── Current weather display ─────────────────────────────────────────────── */

/**
 * Draw the current weather display (temperature, description, details).
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} w - Desklet width
 * @returns {void}
 */
Renderer.prototype._drawWeather = function (cr, w) {
    const d = this._d;
    const tc = this._themeColors();
    const wd = d._weather, m = wd.weather[0];
    const temp = Math.round(wd.main.temp), feels = Math.round(wd.main.feels_like);
    const hum = Math.round(wd.main.humidity), wind = Math.round(wd.wind.speed);
    const unit = d.units === 'metric' ? '\u00B0C' : '\u00B0F';
    const cx = w / 2, topY = 55;

    cr.setSourceRGBA(tc.text[0], tc.text[1], tc.text[2], 1);
    this._cpango(cr, temp + unit, cx, topY + 30, 54, true);

    cr.setSourceRGBA(tc.dim[0], tc.dim[1], tc.dim[2], 0.92);
    const desc = m.description.charAt(0).toUpperCase() + m.description.slice(1);
    this._cpango(cr, desc, cx, topY + 61, 17, false);

    cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.75);
    this._cpango(cr, this._('feels_like') + ' ' + feels + unit, cx, topY + 85, 14, false);

    const detailItems = [];
    if (d.showHumidity !== false) detailItems.push({ val: hum + '%', lbl: this._('humidity') });
    if (d.showWind !== false) detailItems.push({ val: wind + ' ' + this._('wind_unit'), lbl: this._('wind') });
    if (d.showPressure !== false) detailItems.push({ val: wd.main.pressure + ' ' + this._('pressure_unit'), lbl: this._('pressure') });
    if (detailItems.length > 0) {
        const detailY = topY + 115, detailW = Math.min(w - 70, 300), sX = cx - detailW / 2, cW = detailW / detailItems.length;
        for (let i = 0; i < detailItems.length; i++) {
            const ix = sX + cW * i + cW / 2;
            cr.setSourceRGBA(tc.text[0], tc.text[1], tc.text[2], 0.95);
            this._cpango(cr, detailItems[i].val, ix, detailY + 20, 18, true);
            cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.72);
            this._cpango(cr, detailItems[i].lbl, ix, detailY + 42, 11, false);
        }
    }
    // ── Current date and time (one line) ──
    const locale = (this._d.language || 'en') === 'ru' ? 'ru-RU' : 'en-US';
    const now = new Date();
    const dtStr = now.toLocaleString(locale, {
        day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit'
    });
    cr.setSourceRGBA(tc.dim[0], tc.dim[1], tc.dim[2], 0.88);
    this._cpango(cr, dtStr, cx, topY + 180, 14, false);
};

/* ── Forecast display ────────────────────────────────────────────────────── */

/**
 * Draw the hourly forecast display.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} w - Desklet width
 * @returns {void}
 */
Renderer.prototype._drawForecast = function (cr, w) {
    const d = this._d;
    if (!d._forecast || !d._forecast.list) return;
    const tc = this._themeColors();
    const fY = Math.min(285, d._height * 0.63), pad = 30, fw = w - pad * 2;
    const maxSlots = Math.min(d.forecastHours / 3 || 6, 8), step = fw / maxSlots;

    cr.save();
    cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.18);
    cr.setLineWidth(1);
    cr.moveTo(pad + 5, fY - 8);
    cr.lineTo(w - pad - 5, fY - 8);
    cr.stroke();
    cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.55);
    this._drawPango(cr, this._('forecast'), pad + 5, fY - 13, 11, false);

    const list = d._forecast.list.slice(0, maxSlots);
    for (let i = 0; i < list.length; i++) {
        const fx = pad + step * i + step / 2, item = list[i];
        const dt = new Date(item.dt * 1000);
        const time = dt.getHours().toString().padStart(2, '0') + ':' + dt.getMinutes().toString().padStart(2, '0');

        cr.setSourceRGBA(tc.dim[0], tc.dim[1], tc.dim[2], 0.72);
        this._cpango(cr, time, fx, fY + 12, 11, false);
        cr.setSourceRGBA(1, 1, 1, 0.9);
        this._cpango(cr, this._iconToEmoji(item.weather[0].icon, item.weather[0].id), fx, fY + 42, 20, false);
        cr.setSourceRGBA(tc.text[0], tc.text[1], tc.text[2], 0.95);
        this._cpango(cr, Math.round(item.main.temp) + (d.units === 'metric' ? '\u00B0' : '\u00B0F'), fx, fY + 68, 13, true);
    }
    cr.restore();
};

/* ── Daily forecast display (3-5 days) ──────────────────────────────────── */

/**
 * Draw the daily forecast display.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} w - Desklet width
 * @returns {void}
 */
Renderer.prototype._drawDailyForecast = function (cr, w) {
    const d = this._d;
    if (!d._dailyForecast || d._dailyForecast.length === 0) return;
    const tc = this._themeColors();
    const fY = Math.min(285, d._height * 0.63), pad = 30, fw = w - pad * 2;
    const list = d._dailyForecast.slice(0, 5);
    const step = fw / list.length;

    cr.save();
    cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.18);
    cr.setLineWidth(1);
    cr.moveTo(pad + 5, fY - 8);
    cr.lineTo(w - pad - 5, fY - 8);
    cr.stroke();
    cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.55);
    this._drawPango(cr, this._('forecast'), pad + 5, fY - 13, 11, false);

    const unit = d.units === 'metric' ? '\u00B0' : '\u00B0F';
    for (let i = 0; i < list.length; i++) {
        const fx = pad + step * i + step / 2, item = list[i];

        // Day name
        cr.setSourceRGBA(tc.dim[0], tc.dim[1], tc.dim[2], 0.72);
        this._cpango(cr, item.day, fx, fY + 12, 11, false);

        // Weather emoji
        cr.setSourceRGBA(1, 1, 1, 0.9);
        this._cpango(cr, this._iconToEmoji(item.weather[0].icon, item.weather[0].id), fx, fY + 42, 20, false);

        // High / low temperatures
        const hi = Math.round(item.temp_max);
        const lo = Math.round(item.temp_min);
        cr.setSourceRGBA(tc.text[0], tc.text[1], tc.text[2], 0.95);
        this._cpango(cr, hi + unit, fx, fY + 65, 13, true);
        cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.65);
        this._cpango(cr, lo + unit, fx, fY + 82, 11, false);
    }
    cr.restore();
};

/* ── Loading state ───────────────────────────────────────────────────────── */

/**
 * Draw the loading state message.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} w - Desklet width
 * @param {number} h - Desklet height
 * @returns {void}
 */
Renderer.prototype._drawLoading = function (cr, w, h) {
    const tc = this._themeColors();
    cr.setSourceRGBA(tc.text[0], tc.text[1], tc.text[2], 0.75);
    this._cpango(cr, this._('loading'), w / 2, h / 2, 20, false);
};

/* ── Error state ─────────────────────────────────────────────────────────── */

/**
 * Draw the error state message.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} w - Desklet width
 * @param {number} h - Desklet height
 * @param {Object|string} errInfo - Error information
 * @returns {void}
 */
Renderer.prototype._drawError = function (cr, w, h, errInfo) {
    const tc = this._themeColors();
    cr.setSourceRGBA(tc.err[0], tc.err[1], tc.err[2], 0.8);

    let errMsg = '';
    if (typeof errInfo === 'string') errMsg = errInfo;
    else if (errInfo && errInfo.key) {
        errMsg = errInfo.detail !== undefined
            ? this._(errInfo.key) + ': ' + errInfo.detail : this._(errInfo.key);
    }

    const lines = errMsg.split('\n');
    let ly = h / 2 - lines.length * 12;
    for (let li = 0; li < lines.length; li++) {
        let line = lines[li];
        if (this._pangoWidth(cr, line, 15, false) > w - 60) {
            while (this._pangoWidth(cr, line + '...', 15, false) > w - 60 && line.length > 3) { line = line.slice(0, -1); }
            line += '...';
        }
        this._cpango(cr, line, w / 2, ly, 15, false);
        ly += 24;
    }
};

/* ── Pango text rendering ────────────────────────────────────────────────── */

/**
 * Draw Pango text at a given position.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {string} text - Text to render
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} size - Font size
 * @param {boolean} bold - Whether to use bold weight
 * @returns {void}
 */
Renderer.prototype._drawPango = function (cr, text, x, y, size, bold) {
    const layout = PangoCairo.create_layout(cr);
    layout.set_text(text, -1);
    const fd = Pango.FontDescription.from_string('Ubuntu, Cantarell, Sans ' + size);
    if (bold) fd.set_weight(Pango.Weight.BOLD);
    layout.set_font_description(fd);
    cr.moveTo(x, y - layout.get_baseline() / Pango.SCALE);
    PangoCairo.show_layout(cr, layout);
};

/**
 * Measure the width of text with Pango.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {string} text - Text to measure
 * @param {number} size - Font size
 * @param {boolean} bold - Whether to use bold weight
 * @returns {number} Pixel width of the text
 */
Renderer.prototype._pangoWidth = function (cr, text, size, bold) {
    try {
        const layout = PangoCairo.create_layout(cr);
        layout.set_text(text, -1);
        const fd = Pango.FontDescription.from_string('Ubuntu, Cantarell, Sans ' + size);
        if (bold) fd.set_weight(Pango.Weight.BOLD);
        layout.set_font_description(fd);
        return layout.get_pixel_size()[0];
    } catch (e) {
        return text.length * 9;
    }
};

/**
 * Draw a rounded rectangle path.
 * @param {Cairo.Context} cr - Cairo drawing context
 * @param {number} x - Top-left X
 * @param {number} y - Top-left Y
 * @param {number} w - Width
 * @param {number} h - Height
 * @param {number} r - Corner radius
 * @returns {void}
 */
Renderer.prototype._roundRect = function (cr, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    cr.moveTo(x + r, y);
    cr.lineTo(x + w - r, y);
    cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    cr.lineTo(x + w, y + h - r);
    cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    cr.lineTo(x + r, y + h);
    cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    cr.lineTo(x, y + r);
    cr.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
    cr.closePath();
};

/**
 * Map icon code and weather ID to emoji.
 * @param {string} icon - Icon code (e.g. '01d', '01n')
 * @param {number} id - OWM weather ID
 * @returns {string} Emoji string
 */
Renderer.prototype._iconToEmoji = function (icon, id) {
    if (!icon) return '\u2600\uFE0F';
    const n = icon.endsWith('n');
    if (id >= 200 && id < 300) return '\u26C8\uFE0F';
    if (id >= 300 && id < 400) return '\uD83C\uDF26\uFE0F';
    if (id >= 500 && id < 511) return '\uD83C\uDF27\uFE0F';
    if (id >= 511 && id < 600) return '\uD83C\uDF28\uFE0F';
    if (id >= 600 && id < 700) return '\u2744\uFE0F';
    if (id >= 701 && id < 800) return '\uD83C\uDF2B\uFE0F';
    if (id === 800) return n ? '\uD83C\uDF19' : '\u2600\uFE0F';
    if (id === 801) return n ? '\uD83C\uDF19\u2601\uFE0F' : '\uD83C\uDF24\uFE0F';
    if (id === 802) return n ? '\u2601\uFE0F\uD83C\uDF19' : '\u26C5';
    if (id >= 803) return '\u2601\uFE0F';
    return '\uD83C\uDF24\uFE0F';
};

/**
 * Look up a localised string by key.
 * @param {string} key - Translation key
 * @returns {string} Localised string
 */
Renderer.prototype._ = function (key) {
    const lang = this._d.language || 'en';
    const dict = Constants.STRINGS[lang] || Constants.STRINGS.en;
    return dict[key] !== undefined ? dict[key] : Constants.STRINGS.en[key] || key;
};

// eslint-disable-next-line no-var
var Renderer = Renderer;
