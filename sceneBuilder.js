/**
 * @file sceneBuilder.js — Procedural scene generation & Perlin noise for weather-animated@zulus
 * @module sceneBuilder
 *
 * Converts weather data from weatherService into visual scene parameters.
 * Provides pre-generated fBm noise textures for use by the renderer.
 */

const Cairo = imports.cairo;

/* ══════════════════════════════════════════════════════════════════════════
 *  2D Perlin Noise (standard implementation)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Create a PerlinNoise instance with the given seed.
 * @constructor
 * @param {number} [seed] - Random seed (default: 42)
 * @returns {void}
 */
function PerlinNoise(seed) {
    this._seed = seed || 42;
    this._perm = new Array(512);
    this._grad = [[1, 1], [-1, 1], [1, -1], [-1, -1],
        [1, 0], [-1, 0], [0, 1], [0, -1]];

    // Fisher-Yates shuffle the permutation table
    const p = new Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = this._seed;
    for (let i = 255; i > 0; i--) {
        s = (s * 16807) % 2147483647;
        const j = s % (i + 1);
        const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) this._perm[i] = p[i & 255];
}

/**
 * Fade function for Perlin noise (6t⁵ - 15t⁴ + 10t³).
 * @param {number} t - Input value
 * @returns {number} Faded value
 */
PerlinNoise.prototype._fade = function (t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
};

/**
 * Linear interpolation between a and b.
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor [0, 1]
 * @returns {number} Interpolated value
 */
PerlinNoise.prototype._lerp = function (a, b, t) {
    return a + t * (b - a);
};

/**
 * Dot product of gradient vector (g) with (x, y).
 * @param {number[]} g - Gradient vector [gx, gy]
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {number} Dot product
 */
PerlinNoise.prototype._dot = function (g, x, y) {
    return g[0] * x + g[1] * y;
};

/**
 * Compute 2D Perlin noise value at (x, y).
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {number} Noise value in [-1, 1]
 */
PerlinNoise.prototype.noise = function (x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this._fade(xf);
    const v = this._fade(yf);

    const aa = this._perm[this._perm[X] + Y];
    const ab = this._perm[this._perm[X] + Y + 1];
    const ba = this._perm[this._perm[X + 1] + Y];
    const bb = this._perm[this._perm[X + 1] + Y + 1];

    const x1 = this._lerp(
        this._dot(this._grad[aa & 7], xf, yf),
        this._dot(this._grad[ba & 7], xf - 1, yf),
        u);
    const x2 = this._lerp(
        this._dot(this._grad[ab & 7], xf, yf - 1),
        this._dot(this._grad[bb & 7], xf - 1, yf - 1),
        u);
    return this._lerp(x1, x2, v);
};

/* ══════════════════════════════════════════════════════════════════════════
 *  fBm — Fractal Brownian Motion
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Compute fBm (Fractal Brownian Motion) noise value.
 * @param {Object} noise - PerlinNoise instance
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} octaves - Number of octaves
 * @param {number} lacunarity - Lacunarity (frequency multiplier)
 * @param {number} gain - Gain (amplitude multiplier)
 * @returns {number} fBm noise value in [-1, 1]
 */
function fBm(noise, x, y, octaves, lacunarity, gain) {
    let value = 0, amplitude = 1, frequency = 1, maxVal = 0;
    for (let i = 0; i < octaves; i++) {
        value += amplitude * noise.noise(x * frequency, y * frequency);
        maxVal += amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
    }
    return value / maxVal;
}

/* ══════════════════════════════════════════════════════════════════════════
 *  NoiseTexture — pre-generated fBm noise stored as a Cairo ImageSurface
 *                 and a flat Float64Array for fast point sampling
 * ══════════════════════════════════════════════════════════════════════════ */

const NOISE_SIZE = 256;

/**
 * Create a NoiseTexture instance with pre-generated fBm noise.
 * @constructor
 * @returns {void}
 */
function NoiseTexture() {
    this._size = NOISE_SIZE;
    this._noise = new PerlinNoise(42);
    this._data = new Float64Array(NOISE_SIZE * NOISE_SIZE);
    this._surface = null;
    this._generate();
}

/**
 * Generate fBm noise values into the flat array and create a Cairo ImageSurface.
 * @returns {void}
 */
NoiseTexture.prototype._generate = function () {
    const size = this._size;
    const half = size / 2;

    // Generate fBm noise values into the flat array
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Use fBm with 4 octaves for rich detail
            const nx = (x - half) / size * 4;
            const ny = (y - half) / size * 4;
            const val = fBm(this._noise, nx, ny, 4, 2.5, 0.55);
            this._data[y * size + x] = val;
        }
    }

    // Create Cairo ImageSurface (ARGB32) from the data for pattern use
    try {
        this._surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, size, size);
        const cr = new Cairo.Context(this._surface);

        // Draw in blocks for efficiency (8x8 blocks)
        const block = 8;
        for (let by = 0; by < size; by += block) {
            for (let bx = 0; bx < size; bx += block) {
                // Average block value
                let sum = 0;
                for (let dy = 0; dy < block && by + dy < size; dy++) {
                    for (let dx = 0; dx < block && bx + dx < size; dx++) {
                        sum += this._data[(by + dy) * size + (bx + dx)];
                    }
                }
                const avg = (sum / (block * block) + 1) * 0.5; // [0, 1]
                const v = Math.max(0, Math.min(255, Math.floor(avg * 255)));
                cr.setSourceRGBA(v / 255, v / 255, v / 255, 1);
                cr.rectangle(bx, by, block, block);
                cr.fill();
            }
        }
    } catch (e) {
        // Surface creation failed — renderer will use array directly
        this._surface = null;
    }
};

/**
 * Bilinear interpolation sampling of the noise texture.
 * @param {number} x - X coordinate (wrapping)
 * @param {number} y - Y coordinate (wrapping)
 * @returns {number} Sampled noise value
 */
NoiseTexture.prototype.sample = function (x, y) {
    const size = this._size;
    // Wrap coordinates
    x = ((x % size) + size) % size;
    y = ((y % size) + size) % size;

    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ix2 = (ix + 1) % size;
    const iy2 = (iy + 1) % size;

    const v00 = this._data[iy * size + ix];
    const v10 = this._data[iy * size + ix2];
    const v01 = this._data[iy2 * size + ix];
    const v11 = this._data[iy2 * size + ix2];

    const v0 = v00 + (v10 - v00) * fx;
    const v1 = v01 + (v11 - v01) * fx;
    return v0 + (v1 - v0) * fy;
};

/**
 * Get the Cairo ImageSurface for pattern use.
 * @returns {Cairo.ImageSurface|null} Cairo surface or null
 */
NoiseTexture.prototype.getSurface = function () {
    return this._surface;
};

/**
 * Sample fBm with wrapping, optionally at a different frequency.
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} [octaves] - Number of octaves (default: 3)
 * @returns {number} fBm noise value
 */
NoiseTexture.prototype.fBmSample = function (x, y, octaves) {
    octaves = octaves || 3;
    let value = 0, amplitude = 1, frequency = 1, maxVal = 0;
    const lacunarity = 2.3, gain = 0.55;
    for (let i = 0; i < octaves; i++) {
        value += amplitude * this.sample(x * frequency, y * frequency);
        maxVal += amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
    }
    return value / maxVal;
};

/* ══════════════════════════════════════════════════════════════════════════
 *  SceneBuilder — transforms weather data → visual scene parameters
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Create a SceneBuilder instance.
 * @constructor
 * @returns {void}
 */
function SceneBuilder() {
    this._noiseTex = new NoiseTexture();

    // Current (interpolated) and target scene states
    this._current = this._defaultScene();
    this._target = this._defaultScene();

    // Per-second transition speed (higher = faster, 1.2 ≈ 2.5s to 95%)
    this._transitionSpeed = 1.2;

    // Elapsed animation time
    this._time = 0;

    // Last known weather values for smooth interpolation on update
    this._lastWeatherCode = null;
    this._lastSunrise = null;
    this._lastSunset = null;

    // Cloud animation offsets
    this._cloudOffsets = [0, 0, 0];
}

/**
 * Get the default scene parameter object.
 * @returns {Object} Default scene parameters
 */
SceneBuilder.prototype._defaultScene = function () {
    return {
        // Time
        timeOfDay: 0.5,           // 0 = midnight, 0.5 = noon
        sunElevation: 60,         // degrees above horizon
        sunAzimuth: 180,          // degrees
        isNight: false,
        twilight: 0,              // 0=night, 1=day, twilight=0.2-0.5

        // Moon
        moonPhase: 0,
        moonIllumination: 0,
        moonVisible: false,
        moonElevation: 0,

        // Clouds (3 layers: far, mid, near)
        cloudCover: 0,
        cloudOpacity: [0, 0, 0],
        cloudSpeed: [0.2, 0.5, 0.8],
        cloudScale: [0.02, 0.01, 0.005],
        cloudDensity: [0.3, 0.5, 0.7],

        // Precipitation
        precipitation: 0,         // 0-1 intensity
        precipitationType: 'none', // 'none', 'rain', 'snow', 'drizzle', 'thunder'

        // Atmosphere
        fogIntensity: 0,          // 0-1
        fogDensity: 0.3,
        windSpeed: 0,             // km/h

        // Sky colors
        skyTopColor:    [0.18, 0.42, 0.78],
        skyMidColor:    [0.36, 0.56, 0.84],
        skyBottomColor: [0.58, 0.74, 0.90],
        sunColor:       [1.00, 0.92, 0.68],
        sunGlowColor:   [1.00, 0.85, 0.45],
        horizonGlow:    [0.78, 0.88, 0.95],

        // Panel tint
        panelTint: [1, 1, 1],

        // Ambient light for particles
        ambientLight: [1, 1, 1]
    };
};

/**
 * Get the noise texture instance.
 * @returns {NoiseTexture} The noise texture
 */
SceneBuilder.prototype.getNoiseTex = function () {
    return this._noiseTex;
};

/**
 * Get a fresh default scene object.
 * @returns {Object} Default scene parameters
 */
SceneBuilder.prototype.getDefaultScene = function () {
    return this._defaultScene();
};

/* ── Main entry point: build scene from weather data ───────────────────── */

/**
 * Build scene parameters from weather data.
 * @param {Object} weatherData - Weather data object
 * @param {number|null} sunriseMinutes - Sunrise minutes since midnight
 * @param {number|null} sunsetMinutes - Sunset minutes since midnight
 * @param {string} language - Language code
 * @returns {Object} Current interpolated scene parameters
 */
SceneBuilder.prototype.buildScene = function (weatherData, sunriseMinutes,
    sunsetMinutes, language) {
    this._updateSceneTarget(weatherData, sunriseMinutes, sunsetMinutes, language);
    return this._current;
};

/* ── Update target scene parameters from weather data ──────────────────── */

/**
 * Update the target scene parameters from weather data.
 * @param {Object} weatherData - Weather data object
 * @param {number|null} sunriseMinutes - Sunrise minutes since midnight
 * @param {number|null} sunsetMinutes - Sunset minutes since midnight
 * @param {string} _language - Language code (unused)
 * @returns {void}
 */
SceneBuilder.prototype._updateSceneTarget = function (weatherData,
    sunriseMinutes,
    sunsetMinutes,
    _language) {
    const t = this._target;
    const w = weatherData;
    const wmoCode = w.wmoCode !== undefined ? w.wmoCode :
        (w.weather ? this._wmoFromOwmid(w.weather[0].id) : 0);

    // ── Time of day / sun position ──
    const [sunEl, twilight, isNight, moonEl, moonVis, moonIllum] =
        this._calcSunMoon(sunriseMinutes, sunsetMinutes);

    t.sunElevation = sunEl;
    t.isNight = isNight;
    t.twilight = twilight;
    t.moonElevation = moonEl;
    t.moonVisible = moonVis;
    t.moonIllumination = moonIllum;
    t.moonPhase = ((new Date().getDate() - 1) % 29.53) / 29.53;
    // Time of day as continuous 0-1 value (0=midnight)
    const now = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();
    t.timeOfDay = curMin / 1440;

    // ── Cloud cover from WMO code ──
    let cloudCover, fogIntensity, precip, precipType;

    if (wmoCode <= 1) {            // Clear
        cloudCover = 0;
        fogIntensity = 0;
        precip = 0;
        precipType = 'none';
    } else if (wmoCode === 2) {    // Partly cloudy
        cloudCover = 0.35;
        fogIntensity = 0;
        precip = 0;
        precipType = 'none';
    } else if (wmoCode === 3) {    // Overcast
        cloudCover = 0.90;
        fogIntensity = 0;
        precip = 0;
        precipType = 'none';
    } else if (wmoCode === 45 || wmoCode === 48) {  // Fog
        cloudCover = 0.30;
        fogIntensity = 0.85;
        precip = 0;
        precipType = 'none';
    } else if (wmoCode >= 51 && wmoCode <= 57) {    // Drizzle
        cloudCover = 0.70;
        fogIntensity = 0.15;
        precip = 0.25;
        precipType = 'drizzle';
    } else if (wmoCode >= 61 && wmoCode <= 67) {    // Rain
        cloudCover = 0.80;
        fogIntensity = 0.05;
        precip = Math.min(0.9, 0.3 + (wmoCode - 61) * 0.15);
        precipType = 'rain';
    } else if (wmoCode >= 71 && wmoCode <= 77) {    // Snow
        cloudCover = 0.85;
        fogIntensity = 0.10;
        precip = Math.min(0.85, 0.25 + (wmoCode - 71) * 0.12);
        precipType = 'snow';
    } else if (wmoCode >= 80 && wmoCode <= 82) {    // Rain showers
        cloudCover = 0.65 + (wmoCode - 80) * 0.10;
        fogIntensity = 0;
        precip = 0.35 + (wmoCode - 80) * 0.15;
        precipType = 'rain';
    } else if (wmoCode >= 85 && wmoCode <= 86) {    // Snow showers
        cloudCover = 0.70;
        fogIntensity = 0;
        precip = 0.35 + (wmoCode - 85) * 0.15;
        precipType = 'snow';
    } else if (wmoCode >= 95 && wmoCode <= 99) {    // Thunderstorm
        cloudCover = 0.95;
        fogIntensity = 0;
        precip = 0.80;
        precipType = (wmoCode >= 96) ? 'hail' : 'thunder';
    } else {
        cloudCover = 0;
        fogIntensity = 0;
        precip = 0;
        precipType = 'none';
    }

    t.cloudCover = cloudCover;
    t.fogIntensity = fogIntensity;
    t.precipitation = precip;
    t.precipitationType = precipType;

    // ── Wind speed ──
    t.windSpeed = w.wind ? w.wind.speed : 0;

    // ── Temperature ──
    t.temperature = w.main ? w.main.temp : 20;

    // ── Cloud layer properties (based on cover + time of day) ──
    const base = cloudCover;
    // Far clouds (thin, high): always some presence
    t.cloudOpacity[0] = Math.min(1, 0.15 + base * 0.6);
    // Mid clouds: main cloud layer
    t.cloudOpacity[1] = Math.min(1, 0.1 + base * 0.8);
    // Near clouds (thick, low): only when very cloudy
    t.cloudOpacity[2] = Math.min(1, Math.max(0, base * 1.2 - 0.3));

    // Scale: far=large, near=small (parallax)
    t.cloudScale[0] = 0.025;
    t.cloudScale[1] = 0.012;
    t.cloudScale[2] = 0.006;

    // Speed: far=slow, near=fast (parallax)
    const windFactor = 0.1 + Math.min(1, (t.windSpeed || 5) / 60);
    t.cloudSpeed[0] = windFactor * 0.15;
    t.cloudSpeed[1] = windFactor * 0.35;
    t.cloudSpeed[2] = windFactor * 0.70;

    // Density: far=diffuse, near=opaque
    t.cloudDensity[0] = 0.3 + base * 0.4;
    t.cloudDensity[1] = 0.4 + base * 0.5;
    t.cloudDensity[2] = 0.5 + base * 0.4;

    // ── Sky colors ──
    this._calcSkyColors(t, sunEl, twilight, cloudCover, precipType);

    // ── Panel tint ──
    this._calcPanelTint(t);

    // ── Ambient light ──
    this._calcAmbientLight(t);
};

/* ── Calculate sun/moon position ────────────────────────────────────────── */

/**
 * Calculate sun and moon position parameters.
 * @param {number|null} sunriseMinutes - Sunrise minutes since midnight
 * @param {number|null} sunsetMinutes - Sunset minutes since midnight
 * @returns {number[]} Array of [sunElevation, twilight, isNight, moonElevation, moonVisible, moonIllumination]
 */
SceneBuilder.prototype._calcSunMoon = function (sunriseMinutes, sunsetMinutes) {
    const now = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();

    const sr = sunriseMinutes !== null ? sunriseMinutes : 360;   // 06:00
    const ss = sunsetMinutes !== null ? sunsetMinutes : 1080;    // 18:00

    // Day progress (0 at sunrise, 1 at sunset)
    const dayLength = ss - sr;
    const dayProgress = dayLength > 0 ? (curMin - sr) / dayLength : 0.5;

    const isNight = (curMin < sr || curMin > ss);
    let sunElevation, twilight;

    if (!isNight) {
        // During day: sin curve from sunrise to sunset
        sunElevation = Math.sin(dayProgress * Math.PI) * 90;
        // Twilight: near sunrise/sunset (within 30 minutes)
        const minsFromEdge = Math.min(
            Math.abs(curMin - sr),
            Math.abs(curMin - ss)
        );
        twilight = Math.min(1, Math.max(0, minsFromEdge / 45));
        twilight = 1 - twilight; // 0=fully day, 1=fully twilight
    } else {
        sunElevation = -10;
        // Night: how far into night
        const minutesSinceSunset = curMin - ss;
        const minutesUntilSunrise = 1440 - curMin + sr;
        const nightMinutes = Math.min(minutesSinceSunset, minutesUntilSunrise);
        twilight = 1 + Math.min(0, Math.max(-0.5, -(nightMinutes / 60)));
        if (twilight < 0.3) {
            // True night (not twilight)
            twilight = -0.1;
        } else {
            twilight = Math.max(0.3, twilight);
        }
    }

    // Clamp twilight to [-0.1, 1]
    twilight = Math.max(-0.1, Math.min(1, twilight));

    // Moon: visible at night, calculate approximate elevation
    const moonVisible = isNight || twilight > 0.5;
    // Simple moon elevation: high at midnight, low near horizon
    let moonEl = moonVisible ? 60 : -20;
    if (isNight) {
        const nightProgress = (curMin - ss) / (1440 - ss + sr);
        moonEl = Math.sin(nightProgress * Math.PI) * 70;
    }
    // Moon illumination: near full ≈ 1, near new ≈ 0
    // Approximate from day of month (very rough)
    const dayOfMonth = now.getDate();
    const moonIllum = 0.5 + 0.5 * Math.sin((dayOfMonth - 6) / 15 * Math.PI);
    const _moonPhase = ((dayOfMonth - 1) % 29.53) / 29.53;

    return [sunElevation, twilight, isNight, moonEl, moonVisible, moonIllum];
};

/* ── Calculate sky gradient colors ─────────────────────────────────────── */

/**
 * Calculate sky gradient colors based on sun position, weather, and time.
 * @param {Object} t - Target scene parameters object (mutated in-place)
 * @param {number} sunEl - Sun elevation in degrees
 * @param {number} twilight - Twilight factor [-0.1, 1]
 * @param {number} cloudCover - Cloud cover [0, 1]
 * @param {string} precipType - Precipitation type string
 * @returns {void}
 */
SceneBuilder.prototype._calcSkyColors = function (t, sunEl, twilight,
    cloudCover, precipType) {
    const night = t.isNight;
    const _dayFactor = sunEl > 5 ? Math.min(1, sunEl / 60) : 0;
    const twilightFactor = Math.max(0, Math.min(1, twilight));

    // Base sky colors for different conditions
    // Naturalistic daylight: Rayleigh-scattered blue with subtle green at zenith,
    // whitening toward horizon (aerial perspective)
    const topDay = [0.18, 0.42, 0.78];
    const midDay = [0.36, 0.56, 0.84];
    const botDay = [0.58, 0.74, 0.90];

    // Night sky: deep navy with subtle atmospheric glow at horizon
    const topNight = [0.03, 0.04, 0.13];
    const midNight = [0.06, 0.07, 0.19];
    const botNight = [0.10, 0.10, 0.25];

    // Twilight: atmospheric scattering yields purple-blue → rose → warm horizon
    const topTwilight = [0.10, 0.12, 0.32];
    const midTwilight = [0.38, 0.28, 0.35];
    const botTwilight = [0.72, 0.48, 0.30];

    // Sunset warm tones (when sun is low)
    let sunsetFactor = 0;
    if (sunEl > 0 && sunEl < 20) {
        sunsetFactor = 1 - (sunEl / 20);
    }

    // Cloudy/rainy adjustments
    const overcast = Math.min(1, cloudCover * 1.2);
    const isRainy = (precipType === 'rain' || precipType === 'drizzle' ||
                   precipType === 'thunder');
    const isSnowy = (precipType === 'snow');

    // Night sky
    if (night || sunEl < -2) {
        const _nf = night ? 1 : (1 - Math.min(1, (sunEl + 5) / 5));

        // Clear night
        let top = _lerpArr(topNight, topTwilight, twilightFactor);
        let mid = _lerpArr(midNight, midTwilight, twilightFactor);
        let bot = _lerpArr(botNight, botTwilight, twilightFactor);

        // Overcast modifies night colors
        if (overcast > 0.3) {
            const oc = Math.min(1, (overcast - 0.3) / 0.7);
            const greyTop = [0.10, 0.10, 0.14];
            const greyBot = [0.15, 0.15, 0.22];
            top = _lerpArr(top, greyTop, oc);
            mid = _lerpArr(mid, greyTop, oc);
            bot = _lerpArr(bot, greyBot, oc);
        }

        // Snow at night is brighter
        if (isSnowy) {
            const bright = [0.18, 0.18, 0.25];
            top = _lerpArr(top, bright, 0.4);
            mid = _lerpArr(mid, bright, 0.4);
            bot = _lerpArr(bot, bright, 0.3);
        }

        t.skyTopColor = top;
        t.skyMidColor = mid;
        t.skyBottomColor = bot;
        t.sunColor = [0.82, 0.87, 1.0];
        t.sunGlowColor = [0.28, 0.38, 0.78];
        t.horizonGlow = sunsetFactor > 0.5 ? [0.35, 0.18, 0.08] : [0.06, 0.06, 0.18];
        return;
    }

    // ── Daytime ──

    // Start with clear sky
    let top = topDay.slice();
    let mid = midDay.slice();
    let bot = botDay.slice();

    // Apply twilight
    if (twilightFactor > 0.1) {
        top = _lerpArr(top, topTwilight, twilightFactor * 0.7);
        mid = _lerpArr(mid, midTwilight, twilightFactor * 0.8);
        bot = _lerpArr(bot, botTwilight, twilightFactor);
    }

    // Apply sunset coloration
    if (sunsetFactor > 0.05 && !night) {
        const warmTop = [0.28, 0.14, 0.28];
        const warmMid = [0.72, 0.32, 0.17];
        const warmBot = [0.96, 0.58, 0.26];

        top = _lerpArr(top, warmTop, sunsetFactor * 0.6);
        mid = _lerpArr(mid, warmMid, sunsetFactor * 0.8);
        bot = _lerpArr(bot, warmBot, sunsetFactor);
    }

    // Apply cloud cover
    if (overcast > 0.2) {
        const oc = (overcast - 0.2) / 0.8;
        let greyTop, greyMid, greyBot;

        if (isRainy) {
            greyTop = [0.32, 0.37, 0.44];
            greyMid = [0.38, 0.43, 0.50];
            greyBot = [0.45, 0.50, 0.56];
        } else if (isSnowy) {
            greyTop = [0.52, 0.57, 0.64];
            greyMid = [0.58, 0.63, 0.70];
            greyBot = [0.64, 0.68, 0.74];
        } else {
            greyTop = [0.42, 0.47, 0.54];
            greyMid = [0.50, 0.55, 0.62];
            greyBot = [0.58, 0.63, 0.68];
        }

        top = _lerpArr(top, greyTop, oc);
        mid = _lerpArr(mid, greyMid, oc);
        bot = _lerpArr(bot, greyBot, oc);
    }

    t.skyTopColor = top;
    t.skyMidColor = mid;
    t.skyBottomColor = bot;

    // Sun color: whiter at noon, warmer near horizon
    if (sunsetFactor > 0.05) {
        t.sunColor = [1.0, 0.82 - sunsetFactor * 0.15, 0.46 - sunsetFactor * 0.25];
        t.sunGlowColor = [1.0, 0.65 - sunsetFactor * 0.2, 0.25 - sunsetFactor * 0.18];
    } else if (overcast > 0.6) {
        t.sunColor = [0.8, 0.8, 0.85];
        t.sunGlowColor = [0.7, 0.7, 0.8];
    } else {
        t.sunColor = [1.0, 0.92, 0.68];
        t.sunGlowColor = [1.0, 0.85, 0.45];
    }

    // Horizon glow: warm from sun
    if (sunEl > 0 && sunEl < 30) {
        const glow = (30 - sunEl) / 30;
        t.horizonGlow = _lerpArr(
            [0.58, 0.74, 0.90],
            [0.96, 0.65, 0.28],
            glow * (1 - overcast * 0.5)
        );
    } else {
        t.horizonGlow = _lerpArr([0.58, 0.74, 0.90], bot, 0.5);
    }
};

/* ── Calculate panel tint from scene ───────────────────────────────────── */

/**
 * Calculate the glass panel tint color based on scene conditions.
 * @param {Object} t - Target scene parameters object (mutated in-place)
 * @returns {void}
 */
SceneBuilder.prototype._calcPanelTint = function (t) {
    const night = t.isNight;
    const cloud = t.cloudCover;
    const sunset = t.sunElevation > 0 && t.sunElevation < 20;

    if (night || t.twilight < 0.1) {
        // Night: cool blue-purple
        t.panelTint = [0.6, 0.6, 0.9];
    } else if (sunset) {
        // Sunset: warm orange
        t.panelTint = [1.0, 0.75, 0.55];
    } else if (t.precipitationType === 'rain' || t.precipitationType === 'thunder' ||
               t.precipitationType === 'drizzle' || t.precipitationType === 'hail') {
        // Rain: cool blue
        t.panelTint = [0.6, 0.7, 1.0];
    } else if (t.precipitationType === 'snow') {
        // Snow: cool light blue
        t.panelTint = [0.75, 0.85, 1.0];
    } else if (cloud > 0.6) {
        // Cloudy: neutral grey
        t.panelTint = [0.75, 0.78, 0.85];
    } else {
        // Sunny: warm tint
        t.panelTint = [1.0, 0.95, 0.85];
    }
};

/* ── Calculate ambient light ────────────────────────────────────────────── */

/**
 * Calculate ambient light color based on time of day and weather.
 * @param {Object} t - Target scene parameters object (mutated in-place)
 * @returns {void}
 */
SceneBuilder.prototype._calcAmbientLight = function (t) {
    if (t.isNight || t.sunElevation < 5) {
        const moonBright = t.moonIllumination * 0.3 + 0.1;
        t.ambientLight = [moonBright * 0.5, moonBright * 0.5, moonBright];
    } else {
        const factor = Math.min(1, t.sunElevation / 45);
        const cloudiness = Math.min(1, t.cloudCover * 1.3);
        const brightness = 0.5 + 0.5 * (1 - cloudiness) * factor;
        t.ambientLight = [brightness, brightness * 0.95, brightness * 0.9];
    }
};

/* ── Update time and interpolate scene ─────────────────────────────────── */

/**
 * Advance scene animation time and interpolate current toward target.
 * @param {number} dt - Delta time in seconds
 * @returns {void}
 */
SceneBuilder.prototype.update = function (dt) {
    this._time += dt;

    // Animate cloud offsets for parallax scrolling
    for (let i = 0; i < 3; i++) {
        this._cloudOffsets[i] += dt * this._target.cloudSpeed[i] * (i + 1);
        if (this._cloudOffsets[i] > 1000) this._cloudOffsets[i] -= 1000;
    }
    this._current.cloudOffsets = this._cloudOffsets;

    // Interpolate current → target
    const speed = Math.min(1, this._transitionSpeed * dt);
    this._interpolateScene(speed);
};

/* ── Lerp current scene toward target ──────────────────────────────────── */

/**
 * Interpolate current scene parameters toward target.
 * @param {number} t - Interpolation factor [0, 1]
 * @returns {void}
 */
SceneBuilder.prototype._interpolateScene = function (t) {
    const c = this._current;
    const tar = this._target;

    c.sunElevation      = _lerp(c.sunElevation, tar.sunElevation, t);
    c.twilight          = _lerp(c.twilight, tar.twilight, t);
    c.isNight           = tar.isNight; // instant (boolean)
    c.timeOfDay         = tar.timeOfDay;
    c.moonElevation     = _lerp(c.moonElevation, tar.moonElevation, t);
    c.moonIllumination  = _lerp(c.moonIllumination, tar.moonIllumination, t);
    c.moonVisible       = tar.moonVisible;
    c.moonPhase         = tar.moonPhase;
    c.cloudCover        = _lerp(c.cloudCover, tar.cloudCover, t);
    c.fogIntensity      = _lerp(c.fogIntensity, tar.fogIntensity, t);
    c.precipitation     = _lerp(c.precipitation, tar.precipitation, t);
    c.precipitationType = tar.precipitationType; // instant
    c.windSpeed         = _lerp(c.windSpeed, tar.windSpeed, t);
    c.temperature       = _lerp(c.temperature, tar.temperature, t);

    for (let i = 0; i < 3; i++) {
        c.cloudOpacity[i] = _lerp(c.cloudOpacity[i], tar.cloudOpacity[i], t);
        c.cloudScale[i]   = _lerp(c.cloudScale[i], tar.cloudScale[i], t);
        c.cloudSpeed[i]   = _lerp(c.cloudSpeed[i], tar.cloudSpeed[i], t);
        c.cloudDensity[i] = _lerp(c.cloudDensity[i], tar.cloudDensity[i], t);
    }

    _lerpArrInPlace(c.skyTopColor, tar.skyTopColor, t);
    _lerpArrInPlace(c.skyMidColor, tar.skyMidColor, t);
    _lerpArrInPlace(c.skyBottomColor, tar.skyBottomColor, t);
    _lerpArrInPlace(c.sunColor, tar.sunColor, t);
    _lerpArrInPlace(c.sunGlowColor, tar.sunGlowColor, t);
    _lerpArrInPlace(c.horizonGlow, tar.horizonGlow, t);
    _lerpArrInPlace(c.panelTint, tar.panelTint, t);
    _lerpArrInPlace(c.ambientLight, tar.ambientLight, t);
};

/* ── Get cloud offset for animation ────────────────────────────────────── */

/**
 * Get cloud scroll offset for a given layer.
 * @param {number} layer - Cloud layer index (0-2)
 * @returns {number} Current offset value
 */
SceneBuilder.prototype.getCloudOffset = function (layer) {
    return this._cloudOffsets[layer] || 0;
};

/* ── Rough WMO→OWM reverse mapping ──────────────────────────────────────── */

/**
 * Rough reverse mapping from OWM ID to WMO weather code.
 * @param {number} owmId - OWM weather ID
 * @returns {number} Approximate WMO weather code
 */
SceneBuilder.prototype._wmoFromOwmid = function (owmId) {
    if (owmId === 800) return 0;
    if (owmId === 801) return 2;
    if (owmId === 802 || owmId === 803) return 3;
    if (owmId === 804) return 3;
    if (owmId >= 300 && owmId < 400) return 53;
    if (owmId >= 500 && owmId < 512) return 63;
    if (owmId >= 600 && owmId < 700) return 73;
    if (owmId >= 700 && owmId < 800) return 45;
    if (owmId >= 200 && owmId < 300) return 95;
    return 0;
};

/* ══════════════════════════════════════════════════════════════════════════
 *  Utility functions
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Linear interpolation between two numbers.
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor [0, 1]
 * @returns {number} Interpolated value
 */
function _lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Linear interpolation between two 3-element arrays.
 * @param {number[]} a - Start array [r, g, b]
 * @param {number[]} b - End array [r, g, b]
 * @param {number} t - Interpolation factor [0, 1]
 * @returns {number[]} Interpolated array [r, g, b]
 */
function _lerpArr(a, b, t) {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
    ];
}

/**
 * Interpolate a 3-element array in-place to avoid per-frame allocations.
 * @param {number[]} current - Mutable current array [r, g, b]
 * @param {number[]} target - Target array [r, g, b]
 * @param {number} t - Interpolation factor [0, 1]
 * @returns {number[]} The mutated current array
 */
function _lerpArrInPlace(current, target, t) {
    current[0] += (target[0] - current[0]) * t;
    current[1] += (target[1] - current[1]) * t;
    current[2] += (target[2] - current[2]) * t;
    return current;
}

/* ══════════════════════════════════════════════════════════════════════════
 *  Exports
 * ══════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line no-var
var SceneBuilder = SceneBuilder;
// eslint-disable-next-line no-var
var PerlinNoise = PerlinNoise;
// eslint-disable-next-line no-var
var NoiseTexture = NoiseTexture;
// eslint-disable-next-line no-var
var fBm = fBm;
