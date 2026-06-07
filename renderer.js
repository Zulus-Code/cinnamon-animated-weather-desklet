/* renderer.js — Cairo/Pango renderer for weather-animated@zulus
 *
 * Procedural sky rendering with multi-layer clouds, sun/moon, and fog.
 * Uses SceneBuilder scene parameters for visual state.
 */

const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const Cairo = imports.cairo;

const Constants = imports.constants;

/* ── Renderer constructor ────────────────────────────────────────────────── */
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
}

/* ── Set noise texture reference (called by desklet after SceneBuilder init) ── */
Renderer.prototype.setNoiseTexture = function (noiseTex) {
    this._noiseTex = noiseTex;
};

/* ══════════════════════════════════════════════════════════════════════════
 *  THEME COLOURS (unchanged from original)
 * ══════════════════════════════════════════════════════════════════════════ */

Renderer.prototype._themeColors = function () {
    let d = this._d;
    let t = d.theme || 'auto';
    let isDark = (t === 'dark') || (t === 'auto' && d._isNight());
    return {
        isDark: isDark,
        text: isDark ? [0.878, 0.910, 1.000] : [1, 1, 1],
        dim:  isDark ? [0.533, 0.600, 0.800] : [1, 1, 1],
        faint:isDark ? [0.333, 0.400, 0.533] : [1, 1, 1],
        err:  isDark ? [1.000, 0.588, 0.588] : [1, 0.8, 0.8]
    };
};

/* ══════════════════════════════════════════════════════════════════════════
 *  MAIN DRAW ENTRY POINT
 * ══════════════════════════════════════════════════════════════════════════ */

Renderer.prototype.draw = function (area) {
    let cr = area.get_context();
    let d = this._d;
    let w = d._width, h = d._height;
    if (w < 50 || h < 50) return;

    cr.setSourceRGBA(0, 0, 0, 0);
    cr.paint();

    if (d.showBackground !== false) {
        // Procedural scene drawing
        let scene = d._scene || null;
        this._drawProceduralScene(cr, w, h, scene);
        this._drawGlassPanel(cr, w, h, scene);
    }

    // Particles (rain/snow) on top of glass
    if (d._particleSystem) d._particleSystem.draw(cr);

    // UI overlay
    if (d._loading) this._drawLoading(cr, w, h);
    else if (d._error) this._drawError(cr, w, h, d._error);
    else if (d._weather) {
        this._drawWeather(cr, w);
        if (d.showForecast && d._forecast) this._drawForecast(cr, w);
    }
};

/* ══════════════════════════════════════════════════════════════════════════
 *  PROCEDURAL SCENE DRAWING
 * ══════════════════════════════════════════════════════════════════════════ */

Renderer.prototype._drawProceduralScene = function (cr, w, h, scene) {
    if (!scene) {
        // Fallback to simple gradient if no scene data yet
        this._drawSimpleFallback(cr, w, h);
        return;
    }

    // 1. Procedural sky gradient
    this._drawProceduralSky(cr, w, h, scene);

    // 2. Sun (day) or Moon (night)
    this._drawSunMoon(cr, w, h, scene);

    // 3. Multi-layer clouds
    this._drawClouds(cr, w, h, scene);

    // 4. Fog overlay
    if (scene.fogIntensity > 0.02) {
        this._drawFog(cr, w, h, scene);
    }
};

/* ── Fallback for when scene is not ready ───────────────────────────────── */
Renderer.prototype._drawSimpleFallback = function (cr, w, h) {
    let d = this._d;
    let wid = d._weather ? d._weather.weather[0].id : 800;
    let night = d._isNight();
    let c;
    if (wid >= 200 && wid < 300) c = Constants.COLORS.sky.stormy;
    else if (wid >= 300 && wid < 600) c = night ? Constants.COLORS.sky.rainy_night : Constants.COLORS.sky.rainy_day;
    else if (wid >= 600 && wid < 700) c = night ? Constants.COLORS.sky.snowy_night : Constants.COLORS.sky.snowy_day;
    else if (wid >= 700 && wid < 800) c = Constants.COLORS.sky.foggy;
    else if (wid === 800) c = night ? Constants.COLORS.sky.clear_night : Constants.COLORS.sky.clear_day;
    else if (wid >= 801) c = night ? Constants.COLORS.sky.cloudy_night : Constants.COLORS.sky.cloudy_day;
    else c = night ? Constants.COLORS.sky.stormy : Constants.COLORS.sky.cloudy_day;

    let pat = new Cairo.LinearGradient(0, 0, 0, h);
    let c1 = this._hexToRgba(c[0]), c2 = this._hexToRgba(c[1]);
    pat.addColorStopRGBA(0, c1[0], c1[1], c1[2], 1);
    pat.addColorStopRGBA(1, c2[0], c2[1], c2[2], 1);
    cr.setSource(pat);
    cr.rectangle(0, 0, w, h);
    cr.fill();
};

/* ══════════════════════════════════════════════════════════════════════════
 *  1. PROCEDURAL SKY GRADIENT
 *  Multi-stop gradient adapting to time of day, weather, and sun position
 * ══════════════════════════════════════════════════════════════════════════ */

Renderer.prototype._drawProceduralSky = function (cr, w, h, scene) {
    // ── Three-stop vertical gradient ──
    // Top → Mid → Bottom (horizon)
    // Additional horizon glow near the bottom

    let top = scene.skyTopColor;
    let mid = scene.skyMidColor;
    let bot = scene.skyBottomColor;

    let pat = new Cairo.LinearGradient(0, 0, 0, h);

    // Top third: sky top color
    pat.addColorStopRGBA(0, top[0], top[1], top[2], 1);
    // Mid third: blend
    pat.addColorStopRGBA(0.35, mid[0], mid[1], mid[2], 1);
    // Bottom (horizon): lighter
    pat.addColorStopRGBA(0.75, bot[0], bot[1], bot[2], 1);

    // Horizon glow strip at the very bottom
    let glow = scene.horizonGlow || bot;
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

Renderer.prototype._drawSunMoon = function (cr, w, h, scene) {
    if (scene.sunElevation < -5 && !scene.isNight) return; // below horizon

    // Calculate sun/moon position
    let cx = w / 2;
    let sunY, isSunVisible = false;

    if (scene.isNight || scene.sunElevation < -2) {
        // ── DRAW MOON ──
        let moonEl = scene.moonElevation || 40;
        // Moon position: high at night, lower near horizon
        let moonY = h * (0.05 + 0.45 * (1 - (moonEl + 10) / 80));
        let moonX = w * 0.75 - (moonEl > 30 ? 0 : 30);
        let moonR = Math.min(w, h) * 0.04;

        if (scene.moonVisible) {
            this._drawMoon(cr, moonX, moonY, moonR, scene);
        }
        return;
    }

    // ── DRAW SUN ──
    let sunEl = scene.sunElevation;
    // Map elevation to Y position (top=high, bottom=horizon)
    if (sunEl <= 0) return;
    let maxH = h * 0.15; // highest point (slightly above center)
    let minH = h * 0.85; // horizon
    sunY = minH - (sunEl / 90) * (minH - maxH);
    let sunR = Math.min(w, h) * (0.04 + 0.02 * (1 - sunEl / 90)); // bigger near horizon

    // X position: slightly offset from center
    let sunX = cx + (0.5 - Math.sin(sunEl / 90 * Math.PI / 2)) * w * 0.1;

    // Sun glow (outer)
    let glowR = sunR * 5;
    let glow = new Cairo.RadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, glowR);
    let c = scene.sunGlowColor;
    glow.addColorStopRGBA(0, c[0], c[1], c[2], 0.4);
    glow.addColorStopRGBA(0.3, c[0], c[1], c[2], 0.15);
    glow.addColorStopRGBA(0.7, c[0], c[1], c[2], 0.04);
    glow.addColorStopRGBA(1, c[0], c[1], c[2], 0);
    cr.setSource(glow);
    cr.rectangle(0, 0, w, h);
    cr.fill();

    // Sun inner glow
    let innerR = sunR * 2.5;
    let inner = new Cairo.RadialGradient(sunX, sunY, 0, sunX, sunY, innerR);
    let sc = scene.sunColor;
    inner.addColorStopRGBA(0, 1, 1, 1, 1);
    inner.addColorStopRGBA(0.15, sc[0], sc[1], sc[2], 0.9);
    inner.addColorStopRGBA(0.6, sc[0], sc[1], sc[2], 0.3);
    inner.addColorStopRGBA(1, sc[0], sc[1], sc[2], 0);
    cr.setSource(inner);
    cr.rectangle(0, 0, w, h);
    cr.fill();

    // Sun disk
    cr.setSourceRGBA(1, 1, 1, 0.95);
    cr.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    cr.fill();

    // Sun disk warm center
    let disk = new Cairo.RadialGradient(sunX - sunR * 0.2, sunY - sunR * 0.2, 0,
                                        sunX, sunY, sunR);
    disk.addColorStopRGBA(0, 1, 1, 1, 1);
    disk.addColorStopRGBA(0.5, sc[0], sc[1], sc[2], 0.8);
    disk.addColorStopRGBA(1, sc[0], sc[1], sc[2], 0.3);
    cr.setSource(disk);
    cr.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    cr.fill();

    // ── Atmospheric halo around the sun (aerial perspective) ──
    if (sunEl < 30) {
        let halo = new Cairo.RadialGradient(sunX, sunY, sunR, sunX, sunY, sunR * 8);
        let hc = scene.sunGlowColor;
        halo.addColorStopRGBA(0, hc[0], hc[1], hc[2], 0.08);
        halo.addColorStopRGBA(0.5, hc[0], hc[1], hc[2], 0.03);
        halo.addColorStopRGBA(1, hc[0], hc[1], hc[2], 0);
        cr.setSource(halo);
        cr.rectangle(0, 0, w, h);
        cr.fill();
    }

    // ── Horizon glow at sunrise/sunset ──
    if (sunEl < 15 && sunEl > 0) {
        let factor = (15 - sunEl) / 15;
        let hGlow = new Cairo.LinearGradient(0, h * 0.7, 0, h);
        let hc = [1.0, 0.6 - factor * 0.3, 0.2 - factor * 0.2];
        hGlow.addColorStopRGBA(0, hc[0], hc[1], hc[2], 0);
        hGlow.addColorStopRGBA(0.3, hc[0], hc[1], hc[2], 0.05 * factor);
        hGlow.addColorStopRGBA(0.7, hc[0], hc[1], hc[2], 0.15 * factor);
        hGlow.addColorStopRGBA(1, hc[0], hc[1], hc[2], 0.25 * factor);
        cr.setSource(hGlow);
        cr.rectangle(0, 0, w, h);
        cr.fill();
    }
};

/* ── Moon rendering ─────────────────────────────────────────────────────── */
Renderer.prototype._drawMoon = function (cr, x, y, r, scene) {
    // Moon glow
    let glowR = r * 4;
    let glow = new Cairo.RadialGradient(x, y, r * 0.3, x, y, glowR);
    glow.addColorStopRGBA(0, 0.6, 0.7, 1.0, 0.15);
    glow.addColorStopRGBA(0.4, 0.5, 0.6, 0.9, 0.06);
    glow.addColorStopRGBA(1, 0.4, 0.5, 0.8, 0);
    cr.setSource(glow);
    cr.rectangle(0, 0, this._d._width, this._d._height);
    cr.fill();

    // Moon disk
    cr.setSourceRGBA(0.92, 0.93, 0.98, 0.9);
    cr.arc(x, y, r, 0, Math.PI * 2);
    cr.fill();

    // Moon phase (crescent effect using shadow circle)
    let phase = scene.moonPhase || 0;
    // phase 0 = new moon, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter
    // Map to shadow offset: 0→-2r (full shadow = new moon), 0.5→0 (no shadow = full)
    if (Math.abs(phase - 0.5) > 0.02) {
        let shadowOffset;
        if (phase < 0.5) {
            // Waxing: shadow on left
            shadowOffset = -r * 2 * (1 - phase * 2);
        } else {
            // Waning: shadow on right
            shadowOffset = r * 2 * (phase - 0.5) * 2;
        }
        cr.setSourceRGBA(0.05, 0.05, 0.12, 0.85);
        cr.arc(x + shadowOffset, y, r * 1.02, 0, Math.PI * 2);
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

Renderer.prototype._drawClouds = function (cr, w, h, scene) {
    if (!this._noiseTex) return;

    // Draw layers from far to near (back to front)
    for (let layer = 0; layer < 3; layer++) {
        let opacity = scene.cloudOpacity[layer];
        if (opacity < 0.01) continue;

        this._drawCloudLayer(cr, w, h, scene, layer);
    }
};

Renderer.prototype._drawCloudLayer = function (cr, w, h, scene, layer) {
    let noiseTex = this._noiseTex;
    let noiseSurface = noiseTex.getSurface();
    if (!noiseSurface) return;

    let density = scene.cloudDensity[layer];
    let scale = scene.cloudScale[layer];
    let offset = this._d._sceneBuilder ? this._d._sceneBuilder.getCloudOffset(layer) : 0;
    let opacity = scene.cloudOpacity[layer];

    // Get or create cloud mask surface for this density
    let mask = this._getCloudMask(noiseTex, density, layer);
    if (!mask) return;

    // Build cloud color: white/grey with slight blue or warm tint based on scene
    let isNight = scene.isNight;
    let col;
    if (isNight) {
        col = [0.15, 0.15, 0.20]; // dark clouds at night
    } else if (scene.precipitationType === 'rain' || scene.precipitationType === 'thunder') {
        col = [0.35, 0.38, 0.45]; // rainy grey
    } else if (scene.precipitationType === 'snow') {
        col = [0.55, 0.58, 0.65]; // snowy grey
    } else if (scene.sunElevation > 0 && scene.sunElevation < 20) {
        // Sunset: warm clouds
        let sf = (20 - scene.sunElevation) / 20;
        col = [0.8 + sf * 0.2, 0.6 + sf * 0.1, 0.5 - sf * 0.2];
    } else {
        col = [0.75, 0.78, 0.85]; // default white-grey
    }

    // Apply scene ambient light to cloud color
    let amb = scene.ambientLight;
    col[0] *= amb[0];
    col[1] *= amb[1];
    col[2] *= amb[2];

    cr.save();

    // Set up the mask pattern
    let pattern = Cairo.Pattern.createForSurface(mask);
    try { pattern.setExtend(Cairo.Extend.REPEAT); } catch (e) {}

    // Create transform matrix: scale for parallax + scroll for animation
    // Base scale: map 256px noise texture to screen with parallax factor
    let px = layer === 0 ? 1.5 : (layer === 1 ? 1.0 : 0.6);
    let sx = w / 256 * (1 / scale) * px;
    let sy = h / 256 * (1 / scale) * px;

    let tx = offset * 80; // Scroll offset
    let ty = layer * 15 + offset * 5; // Vertical offset per layer

    try {
        let matrix = new Cairo.Matrix(sx, 0, 0, sy, tx, ty);
        pattern.setMatrix(matrix);
    } catch (e) {
        // Cairo.Matrix not available in this version — use translate hack
        try { cr.setSourceSurface(mask, tx % 256, ty % 256); } catch (e2) {}
    }

    // Apply the cloud mask with the cloud color
    cr.setSourceRGBA(col[0], col[1], col[2], opacity * 0.8);
    cr.mask(pattern);

    cr.restore();
};

/* ── Get or create a cloud mask surface for a given density ─────────────── */
Renderer.prototype._getCloudMask = function (noiseTex, density, layer) {
    // Regenerate if density changed significantly
    if (this._cloudMasks[layer] === null ||
        Math.abs(this._lastCloudDensity[layer] - density) > 0.05) {

        this._lastCloudDensity[layer] = density;
        this._cloudMasks[layer] = this._generateCloudMask(noiseTex, density);
    }
    return this._cloudMasks[layer];
};

/* ── Generate a cloud mask surface from noise data with thresholding ── */
Renderer.prototype._generateCloudMask = function (noiseTex, density) {
    let size = 256;
    let surface;
    let isA8 = false;

    // Try A8 first (8-bit alpha-only), fallback to ARGB32
    try {
        surface = new Cairo.ImageSurface(Cairo.Format.A8, size, size);
        isA8 = true;
    } catch (e) {
        try {
            surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, size, size);
        } catch (e2) {
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
                let cloudVal = this._computeCloudMaskValue(noiseTex, x, y, density);
                data[y * size + x] = cloudVal;
            }
        }
    } else if (canWriteDirect && !isA8) {
        // Fast path: write directly to ARGB32 surface data
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                let cloudVal = this._computeCloudMaskValue(noiseTex, x, y, density);
                let offset = (y * size + x) * 4;
                data[offset]     = cloudVal; // B
                data[offset + 1] = cloudVal; // G
                data[offset + 2] = cloudVal; // R
                data[offset + 3] = cloudVal; // A
            }
        }
    } else {
        // Slow fallback: per-pixel Cairo drawing
        let cr = new Cairo.Context(surface);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                let cloudVal = this._computeCloudMaskValue(noiseTex, x, y, density);
                let v = cloudVal / 255;
                cr.setSourceRGBA(v, v, v, v);
                cr.rectangle(x, y, 1, 1);
                cr.fill();
            }
        }
    }

    try { surface.mark_dirty(); } catch (e) {}

    return surface;
};

/* ── Compute single cloud mask pixel value (shared logic) ───────────────── */
Renderer.prototype._computeCloudMaskValue = function (noiseTex, x, y, density) {
    // Sample noise and apply density threshold
    let noiseVal = noiseTex.sample(x, y);
    // noiseVal is in [-1, 1], threshold based on density
    // Higher density = lower threshold = more cloud
    let threshold = 0.6 - density * 0.5;
    let cloudVal;
    if (noiseVal > threshold) {
        cloudVal = Math.min(255, Math.floor((noiseVal - threshold) /
                             (1 - threshold) * 255));
    } else {
        cloudVal = 0;
    }

    // Add some texture variation at the edges
    if (cloudVal > 0 && cloudVal < 255) {
        let noise2 = noiseTex.sample(x * 3 + 50, y * 3 + 50);
        cloudVal = Math.floor(cloudVal * (0.7 + 0.3 * (noise2 + 1) / 2));
        cloudVal = Math.max(0, Math.min(255, cloudVal));
    }

    return cloudVal;
};

/* ══════════════════════════════════════════════════════════════════════════
 *  4. PROCEDURAL FOG
 *  Non-uniform fog using noise texture
 * ══════════════════════════════════════════════════════════════════════════ */

Renderer.prototype._drawFog = function (cr, w, h, scene) {
    let fogInt = scene.fogIntensity;
    if (fogInt < 0.02) return;

    // Regenerate fog mask if intensity changed
    if (this._fogMask === null || Math.abs(this._fogIntensity - fogInt) > 0.05) {
        this._fogIntensity = fogInt;
        this._fogMask = this._generateFogMask(fogInt);
    }

    if (!this._fogMask) {
        // Simple uniform fog fallback
        let fogColor = scene.isNight ? [0.05, 0.05, 0.10] : [0.6, 0.65, 0.72];
        cr.setSourceRGBA(fogColor[0], fogColor[1], fogColor[2], fogInt * 0.3);
        cr.rectangle(0, 0, w, h);
        cr.fill();
        return;
    }

    // Create pattern from fog mask
    let pattern = Cairo.Pattern.createForSurface(this._fogMask);
    try { pattern.setExtend(Cairo.Extend.REPEAT); } catch (e) {}

    // Slow drift for the fog
    let time = this._d._sceneTime || 0;
    let tx = time * 2;
    let ty = time * 0.5;
    try {
        let matrix = new Cairo.Matrix(w / 256 * 3, 0, 0, h / 256 * 3, tx, ty);
        pattern.setMatrix(matrix);
    } catch (e) {}

    let fogColor = scene.isNight ? [0.05, 0.05, 0.10] : [0.55, 0.60, 0.68];
    cr.setSourceRGBA(fogColor[0], fogColor[1], fogColor[2], fogInt * 0.35);
    cr.mask(pattern);
};

/* ── Generate fog density mask ──────────────────────────────────────────── */
Renderer.prototype._generateFogMask = function (intensity) {
    let size = 256;
    let surface;
    let isA8 = false;

    try {
        surface = new Cairo.ImageSurface(Cairo.Format.A8, size, size);
        isA8 = true;
    } catch (e) {
        try {
            surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, size, size);
        } catch (e2) {
            return null;
        }
    }

    let noiseTex = this._noiseTex;
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
            let val = noiseTex.fBmSample(x / size * 4, y / size * 4, 3);
            // Remap: fog is visible where noise > threshold
            let fogVal = (val + 1) * 0.5; // [0, 1]
            // Fog threshold: intensity controls how much fog there is
            let threshold = 0.7 - intensity * 0.3;
            if (fogVal > threshold) {
                fogVal = Math.min(1, (fogVal - threshold) / (1 - threshold));
            } else {
                fogVal = 0;
            }
            // Bottom-heavy (more fog near ground)
            let vertical = (size - y) / size;
            fogVal *= (0.3 + 0.7 * vertical);

            let byteVal = Math.floor(fogVal * 255 * intensity * 1.2);
            byteVal = Math.max(0, Math.min(255, byteVal));

            if (canWriteDirect) {
                if (isA8) {
                    data[y * size + x] = byteVal;
                } else {
                    let offset = (y * size + x) * 4;
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

Renderer.prototype._drawGlassPanel = function (cr, w, h, scene) {
    let d = this._d;
    let isDark = this._themeColors().isDark;

    let o = (d.opacity || 70) / 100;
    let pad = 20, r = 20;
    let pH = h - pad * 2, pY = pad;

    // ── Scene-adaptive tint ──
    let tint = [1, 1, 1]; // default white
    if (scene && scene.panelTint) {
        tint = scene.panelTint;
    }

    // Shadow
    cr.setSourceRGBA(0, 0, 0, 0.2 * o);
    this._roundRect(cr, pad + 2, pY + 2, w - pad * 2 - 4, pH - 4, r);
    cr.fill();

    // Main glass fill with scene tint
    let glassDark = [
        0.039 * tint[0],
        0.039 * tint[1],
        0.118 * tint[2]
    ];
    let glassLight = [
        1.0 * tint[0],
        1.0 * tint[1],
        1.0 * tint[2]
    ];

    if (isDark) {
        cr.setSourceRGBA(glassDark[0], glassDark[1], glassDark[2], 0.75 * o);
    } else {
        cr.setSourceRGBA(
            Math.min(1, glassLight[0]),
            Math.min(1, glassLight[1]),
            Math.min(1, glassLight[2]),
            0.12 * o
        );
    }
    this._roundRect(cr, pad, pY, w - pad * 2, pH, r);
    cr.fill();

    // Border with scene-tinted color
    let border = isDark
        ? [0.392 * tint[0], 0.549 * tint[1], 1.0 * tint[2]]
        : [1.0 * tint[0], 1.0 * tint[1], 1.0 * tint[2]];

    cr.setLineWidth(1.5);
    cr.setSourceRGBA(
        Math.min(1, border[0]),
        Math.min(1, border[1]),
        Math.min(1, border[2]),
        (isDark ? 0.15 : 0.25) * o
    );
    this._roundRect(cr, pad, pY, w - pad * 2, pH, r);
    cr.stroke();

    // Light reflection on glass (light theme only)
    if (!isDark) {
        cr.setSourceRGBA(1, 1, 1, 0.06 * o);
        this._roundRect(cr, pad, pY, w - pad * 2, pH * 0.15, r);
        cr.fill();
    }
};

/* ══════════════════════════════════════════════════════════════════════════
 *  (Everything below is preserved from original renderer.js exactly)
 * ══════════════════════════════════════════════════════════════════════════ */

/* ── Convenience: draw centred Pango text at x baseline ────────────────── */
Renderer.prototype._cpango = function (cr, txt, cx, y, sz, bold) {
    this._drawPango(cr, txt, cx - this._pangoWidth(cr, txt, sz, bold) / 2, y, sz, bold);
};

/* ── Current weather display ─────────────────────────────────────────────── */
Renderer.prototype._drawWeather = function (cr, w) {
    let d = this._d;
    let tc = this._themeColors();
    let wd = d._weather, m = wd.weather[0];
    let temp = Math.round(wd.main.temp), feels = Math.round(wd.main.feels_like);
    let hum = Math.round(wd.main.humidity), wind = Math.round(wd.wind.speed);
    let unit = d.units === 'metric' ? '\u00B0C' : '\u00B0F';
    let cx = w / 2, topY = 45;

    cr.setSourceRGBA(1, 1, 1, 1);
    let emoji = this._iconToEmoji(m.icon, m.id);
    this._cpango(cr, emoji, cx, topY + 20, 56, false);

    cr.setSourceRGBA(tc.text[0], tc.text[1], tc.text[2], 1);
    this._cpango(cr, temp + unit, cx, topY + 90, 54, true);

    cr.setSourceRGBA(tc.dim[0], tc.dim[1], tc.dim[2], 0.9);
    let desc = m.description.charAt(0).toUpperCase() + m.description.slice(1);
    this._cpango(cr, desc, cx, topY + 118, 16, false);

    cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.7);
    this._cpango(cr, this._('feels_like') + ' ' + feels + unit, cx, topY + 140, 13, false);

    let detailItems = [];
    if (d.showHumidity !== false) detailItems.push({ val: hum + '%', lbl: this._('humidity') });
    if (d.showWind !== false) detailItems.push({ val: wind + ' ' + this._('wind_unit'), lbl: this._('wind') });
    if (d.showPressure !== false) detailItems.push({ val: wd.main.pressure + ' ' + this._('pressure_unit'), lbl: this._('pressure') });
    if (detailItems.length > 0) {
        let detailY = topY + 175, detailW = Math.min(w - 80, 300), sX = cx - detailW / 2, cW = detailW / detailItems.length;
        for (let i = 0; i < detailItems.length; i++) {
            let ix = sX + cW * i + cW / 2;
            cr.setSourceRGBA(tc.text[0], tc.text[1], tc.text[2], 0.95);
            this._cpango(cr, detailItems[i].val, ix, detailY + 19, 18, true);
            cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.6);
            this._cpango(cr, detailItems[i].lbl, ix, detailY + 37, 10, false);
        }
    }
    cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.6);
    this._cpango(cr, wd.name + ', ' + (wd.sys.country || ''), cx, topY + 230, 13, false);
};

/* ── Forecast display ────────────────────────────────────────────────────── */
Renderer.prototype._drawForecast = function (cr, w) {
    let d = this._d;
    if (!d._forecast || !d._forecast.list) return;
    let tc = this._themeColors();
    let fY = 300, pad = 30, fw = w - pad * 2;
    let maxSlots = Math.min(d.forecastHours / 3 || 6, 8), step = fw / maxSlots;

    cr.save();
    cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.15);
    cr.setLineWidth(1);
    cr.moveTo(pad + 5, fY - 5);
    cr.lineTo(w - pad - 5, fY - 5);
    cr.stroke();
    cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.5);
    this._drawPango(cr, this._('forecast'), pad + 5, fY - 10, 10, false);

    let list = d._forecast.list.slice(0, maxSlots);
    for (let i = 0; i < list.length; i++) {
        let fx = pad + step * i + step / 2, item = list[i];
        let dt = new Date(item.dt * 1000);
        let time = dt.getHours().toString().padStart(2, '0') + ':' + dt.getMinutes().toString().padStart(2, '0');

        cr.setSourceRGBA(tc.dim[0], tc.dim[1], tc.dim[2], 0.7);
        this._cpango(cr, time, fx, fY + 10, 10, false);
        cr.setSourceRGBA(1, 1, 1, 0.9);
        this._cpango(cr, this._iconToEmoji(item.weather[0].icon, item.weather[0].id), fx, fY + 40, 20, false);
        cr.setSourceRGBA(tc.text[0], tc.text[1], tc.text[2], 0.95);
        this._cpango(cr, Math.round(item.main.temp) + (d.units === 'metric' ? '\u00B0' : '\u00B0F'), fx, fY + 65, 13, true);
    }
    cr.restore();
};

/* ── Loading state ───────────────────────────────────────────────────────── */
Renderer.prototype._drawLoading = function (cr, w, h) {
    let tc = this._themeColors();
    cr.setSourceRGBA(tc.text[0], tc.text[1], tc.text[2], 0.7);
    this._cpango(cr, this._('loading'), w / 2, h / 2, 18, false);
};

/* ── Error state ─────────────────────────────────────────────────────────── */
Renderer.prototype._drawError = function (cr, w, h, errInfo) {
    let tc = this._themeColors();
    cr.setSourceRGBA(tc.err[0], tc.err[1], tc.err[2], 0.8);

    let errMsg = '';
    if (typeof errInfo === 'string') errMsg = errInfo;
    else if (errInfo && errInfo.key) errMsg = errInfo.detail !== undefined
        ? this._(errInfo.key) + ': ' + errInfo.detail : this._(errInfo.key);

    let lines = errMsg.split('\n');
    let ly = h / 2 - lines.length * 10;
    for (let li = 0; li < lines.length; li++) {
        let line = lines[li];
        if (this._pangoWidth(cr, line, 14, false) > w - 60) {
            while (this._pangoWidth(cr, line + '...', 14, false) > w - 60 && line.length > 3)
                line = line.slice(0, -1);
            line += '...';
        }
        this._cpango(cr, line, w / 2, ly, 14, false);
        ly += 22;
    }
};

/* ── Pango text rendering ────────────────────────────────────────────────── */
Renderer.prototype._drawPango = function (cr, text, x, y, size, bold) {
    let layout = PangoCairo.create_layout(cr);
    layout.set_text(text, -1);
    let fd = Pango.FontDescription.from_string('Ubuntu, Sans ' + size);
    if (bold) fd.set_weight(Pango.Weight.BOLD);
    layout.set_font_description(fd);
    cr.moveTo(x, y - layout.get_baseline() / Pango.SCALE);
    PangoCairo.show_layout(cr, layout);
};

/* ── Text width measurement ──────────────────────────────────────────────── */
Renderer.prototype._pangoWidth = function (cr, text, size, bold) {
    try {
        let layout = PangoCairo.create_layout(cr);
        layout.set_text(text, -1);
        let fd = Pango.FontDescription.from_string('Ubuntu, Sans ' + size);
        if (bold) fd.set_weight(Pango.Weight.BOLD);
        layout.set_font_description(fd);
        return layout.get_pixel_size()[0];
    } catch (e) {
        return text.length * 9;
    }
};

/* ── Rounded rectangle path ──────────────────────────────────────────────── */
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

/* ── Icon code → emoji ───────────────────────────────────────────────────── */
Renderer.prototype._iconToEmoji = function (icon, id) {
    if (!icon) return '\u2600\uFE0F';
    let n = icon.endsWith('n');
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

/* ── Localised string lookup ─────────────────────────────────────────────── */
Renderer.prototype._ = function (key) {
    let lang = this._d.language || 'en';
    let dict = Constants.STRINGS[lang] || Constants.STRINGS.en;
    return dict[key] !== undefined ? dict[key] : Constants.STRINGS.en[key] || key;
};

/* ── Hex → RGBA helper ───────────────────────────────────────────────────── */
Renderer.prototype._hexToRgba = function (hex) {
    return [
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255
    ];
};

var Renderer = Renderer;
