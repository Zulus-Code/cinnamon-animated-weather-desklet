/* tests/sceneBuilder.test.js — Pure function tests for sceneBuilder.js */
const assert = require('assert');

// ── Pure function copies from sceneBuilder.js ──

function _lerp(a, b, t) {
    return a + (b - a) * t;
}

function _lerpArr(a, b, t) {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
    ];
}

// Moon phase: ((dayOfMonth - 1) % 29.53) / 29.53
function _moonPhase(dayOfMonth) {
    return ((dayOfMonth - 1) % 29.53) / 29.53;
}

// _calcPanelTint logic (pure function extracted from SceneBuilder.prototype._calcPanelTint)
function _calcPanelTint(t) {
    const night = t.isNight;
    const cloud = t.cloudCover;
    const sunset = t.sunElevation > 0 && t.sunElevation < 20;

    if (night || t.twilight < 0.1) {
        return [0.6, 0.6, 0.9];
    } else if (sunset) {
        return [1.0, 0.75, 0.55];
    } else if (t.precipitationType === 'rain' || t.precipitationType === 'thunder' ||
               t.precipitationType === 'drizzle' || t.precipitationType === 'hail') {
        return [0.6, 0.7, 1.0];
    } else if (t.precipitationType === 'snow') {
        return [0.75, 0.85, 1.0];
    } else if (cloud > 0.6) {
        return [0.75, 0.78, 0.85];
    } else {
        return [1.0, 0.95, 0.85];
    }
}

// _calcAmbientLight logic (pure function extracted from SceneBuilder.prototype._calcAmbientLight)
function _calcAmbientLight(t) {
    if (t.isNight || t.sunElevation < 5) {
        const moonBright = t.moonIllumination * 0.3 + 0.1;
        return [moonBright * 0.5, moonBright * 0.5, moonBright];
    } else {
        const factor = Math.min(1, t.sunElevation / 45);
        const cloudiness = Math.min(1, t.cloudCover * 1.3);
        const brightness = 0.5 + 0.5 * (1 - cloudiness) * factor;
        return [brightness, brightness * 0.95, brightness * 0.9];
    }
}

// ── Sky colors computation ──
// Extracted and simplified for testing: produces { skyTopColor, skyMidColor, skyBottomColor, sunColor, sunGlowColor, horizonGlow }
function _buildSkyColors(sunEl, twilight, cloudCover, precipType, isNight) {
    const night = isNight;
    const twilightFactor = Math.max(0, Math.min(1, twilight));
    const sunsetFactor = (sunEl > 0 && sunEl < 20) ? 1 - (sunEl / 20) : 0;
    const overcast = Math.min(1, cloudCover * 1.2);
    const isRainy = (precipType === 'rain' || precipType === 'drizzle' || precipType === 'thunder');
    const isSnowy = (precipType === 'snow');

    const topDay = [0.25, 0.50, 0.90];
    const midDay = [0.45, 0.70, 0.95];
    const botDay = [0.65, 0.85, 1.00];

    const topNight = [0.02, 0.02, 0.10];
    const midNight = [0.04, 0.04, 0.15];
    const botNight = [0.06, 0.06, 0.20];

    const topTwilight = [0.15, 0.08, 0.20];
    const midTwilight = [0.50, 0.20, 0.15];
    const botTwilight = [0.90, 0.50, 0.20];

    let top, mid, bot, sunColor, sunGlowColor, horizonGlow;

    if (night || sunEl < -2) {
        top = _lerpArr(topNight, topTwilight, twilightFactor);
        mid = _lerpArr(midNight, midTwilight, twilightFactor);
        bot = _lerpArr(botNight, botTwilight, twilightFactor);

        if (overcast > 0.3) {
            const oc = Math.min(1, (overcast - 0.3) / 0.7);
            const greyTop = [0.08, 0.08, 0.12];
            const greyBot = [0.12, 0.12, 0.18];
            top = _lerpArr(top, greyTop, oc);
            mid = _lerpArr(mid, greyTop, oc);
            bot = _lerpArr(bot, greyBot, oc);
        }

        if (isSnowy) {
            const bright = [0.15, 0.15, 0.22];
            top = _lerpArr(top, bright, 0.4);
            mid = _lerpArr(mid, bright, 0.4);
            bot = _lerpArr(bot, bright, 0.3);
        }

        sunColor = [0.8, 0.85, 1.0];
        sunGlowColor = [0.3, 0.4, 0.8];
        horizonGlow = sunsetFactor > 0.5 ? [0.4, 0.2, 0.1] : [0.05, 0.05, 0.15];

        return { skyTopColor: top, skyMidColor: mid, skyBottomColor: bot,
            sunColor, sunGlowColor, horizonGlow };
    }

    // Daytime
    top = topDay.slice();
    mid = midDay.slice();
    bot = botDay.slice();

    if (twilightFactor > 0.1) {
        top = _lerpArr(top, topTwilight, twilightFactor * 0.7);
        mid = _lerpArr(mid, midTwilight, twilightFactor * 0.8);
        bot = _lerpArr(bot, botTwilight, twilightFactor);
    }

    if (sunsetFactor > 0.05 && !night) {
        const warmTop = [0.30, 0.15, 0.25];
        const warmMid = [0.70, 0.30, 0.15];
        const warmBot = [1.00, 0.65, 0.30];
        top = _lerpArr(top, warmTop, sunsetFactor * 0.6);
        mid = _lerpArr(mid, warmMid, sunsetFactor * 0.8);
        bot = _lerpArr(bot, warmBot, sunsetFactor);
    }

    if (overcast > 0.2) {
        const oc = (overcast - 0.2) / 0.8;
        let greyTop, greyMid, greyBot;
        if (isRainy) {
            greyTop = [0.30, 0.35, 0.45];
            greyMid = [0.35, 0.40, 0.50];
            greyBot = [0.40, 0.48, 0.55];
        } else if (isSnowy) {
            greyTop = [0.50, 0.55, 0.65];
            greyMid = [0.55, 0.60, 0.70];
            greyBot = [0.60, 0.65, 0.75];
        } else {
            greyTop = [0.40, 0.45, 0.55];
            greyMid = [0.48, 0.53, 0.62];
            greyBot = [0.55, 0.60, 0.68];
        }
        top = _lerpArr(top, greyTop, oc);
        mid = _lerpArr(mid, greyMid, oc);
        bot = _lerpArr(bot, greyBot, oc);
    }

    if (sunsetFactor > 0.05) {
        sunColor = [1.0, 0.85 - sunsetFactor * 0.2, 0.5 - sunsetFactor * 0.3];
        sunGlowColor = [1.0, 0.7 - sunsetFactor * 0.2, 0.3 - sunsetFactor * 0.2];
    } else if (overcast > 0.6) {
        sunColor = [0.8, 0.8, 0.85];
        sunGlowColor = [0.7, 0.7, 0.8];
    } else {
        sunColor = [1.0, 0.92, 0.65];
        sunGlowColor = [1.0, 0.85, 0.4];
    }

    if (sunEl > 0 && sunEl < 30) {
        const glow = (30 - sunEl) / 30;
        horizonGlow = _lerpArr([0.65, 0.85, 1.0], [1.0, 0.7, 0.3], glow * (1 - overcast * 0.5));
    } else {
        horizonGlow = _lerpArr([0.65, 0.85, 1.0], bot, 0.5);
    }

    return { skyTopColor: top, skyMidColor: mid, skyBottomColor: bot,
        sunColor, sunGlowColor, horizonGlow };
}

// ── Test suite ──

let passed = 0;
let failed = 0;
let errors = [];

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log('  ✓ ' + name);
    } catch (e) {
        failed++;
        errors.push({ name, error: e.message });
        console.log('  ✗ ' + name + ' — ' + e.message);
    }
}

console.log('\n── sceneBuilder.test.js ──');

// _lerp
test('_lerp a→b at t=0 returns a', () => {
    assert.strictEqual(_lerp(10, 20, 0), 10);
});

test('_lerp a→b at t=1 returns b', () => {
    assert.strictEqual(_lerp(10, 20, 1), 20);
});

test('_lerp a→b at t=0.5 returns midpoint', () => {
    assert.strictEqual(_lerp(10, 20, 0.5), 15);
});

test('_lerp handles negative values', () => {
    assert.strictEqual(_lerp(-10, 10, 0.5), 0);
});

// _lerpArr
test('_lerpArr interpolates array at t=0', () => {
    const r = _lerpArr([0, 0, 0], [1, 2, 3], 0);
    assert.deepStrictEqual(r, [0, 0, 0]);
});

test('_lerpArr interpolates array at t=1', () => {
    const r = _lerpArr([0, 0, 0], [1, 2, 3], 1);
    assert.deepStrictEqual(r, [1, 2, 3]);
});

test('_lerpArr interpolates array at t=0.5', () => {
    const r = _lerpArr([0, 0, 0], [2, 4, 6], 0.5);
    assert.deepStrictEqual(r, [1, 2, 3]);
});

// _moonPhase
test('moonPhase day 1 is 0 (new moon approx)', () => {
    const phase = _moonPhase(1);
    assert.strictEqual(phase, 0);
});

test('moonPhase day 15 gives roughly 0.5 (full moon approx)', () => {
    const phase = _moonPhase(15);
    assert.ok(phase > 0.45 && phase < 0.55);
});

test('moonPhase day 30 gives roughly 0.98+', () => {
    const phase = _moonPhase(30);
    assert.ok(phase > 0.95);
});

// _calcPanelTint
test('panelTint night is cool blue-purple', () => {
    const t = { isNight: true, cloudCover: 0, sunElevation: -10, twilight: 0, precipitationType: 'none' };
    assert.deepStrictEqual(_calcPanelTint(t), [0.6, 0.6, 0.9]);
});

test('panelTint sunset is warm orange', () => {
    const t = { isNight: false, cloudCover: 0, sunElevation: 10, twilight: 0.5, precipitationType: 'none' };
    assert.deepStrictEqual(_calcPanelTint(t), [1.0, 0.75, 0.55]);
});

test('panelTint rain is cool blue', () => {
    const t = { isNight: false, cloudCover: 0.5, sunElevation: 30, twilight: 1, precipitationType: 'rain' };
    assert.deepStrictEqual(_calcPanelTint(t), [0.6, 0.7, 1.0]);
});

test('panelTint snow is cool light blue', () => {
    const t = { isNight: false, cloudCover: 0.5, sunElevation: 30, twilight: 1, precipitationType: 'snow' };
    assert.deepStrictEqual(_calcPanelTint(t), [0.75, 0.85, 1.0]);
});

test('panelTint cloudy over 0.6 is neutral grey', () => {
    const t = { isNight: false, cloudCover: 0.7, sunElevation: 45, twilight: 1, precipitationType: 'none' };
    assert.deepStrictEqual(_calcPanelTint(t), [0.75, 0.78, 0.85]);
});

test('panelTint sunny default is warm tint', () => {
    const t = { isNight: false, cloudCover: 0.3, sunElevation: 60, twilight: 1, precipitationType: 'none' };
    assert.deepStrictEqual(_calcPanelTint(t), [1.0, 0.95, 0.85]);
});

// _calcAmbientLight
test('ambientLight at night uses moon illumination', () => {
    const t = { isNight: true, sunElevation: -10, moonIllumination: 0.5, cloudCover: 0 };
    const r = _calcAmbientLight(t);
    const moonBright = 0.5 * 0.3 + 0.1;
    assert.deepStrictEqual(r, [moonBright * 0.5, moonBright * 0.5, moonBright]);
});

test('ambientLight at midnight moon is dim', () => {
    const t = { isNight: true, sunElevation: -30, moonIllumination: 0.1, cloudCover: 0 };
    const r = _calcAmbientLight(t);
    const moonBright = 0.1 * 0.3 + 0.1;
    assert.deepStrictEqual(r, [moonBright * 0.5, moonBright * 0.5, moonBright]);
});

test('ambientLight daytime sunny is bright', () => {
    const t = { isNight: false, sunElevation: 60, cloudCover: 0, moonIllumination: 0 };
    const r = _calcAmbientLight(t);
    const factor = Math.min(1, 60 / 45);
    const cloudiness = 0;
    const brightness = 0.5 + 0.5 * (1 - cloudiness) * factor;
    assert.deepStrictEqual(r, [brightness, brightness * 0.95, brightness * 0.9]);
});

test('ambientLight daytime cloudy is dimmer', () => {
    const t = { isNight: false, sunElevation: 45, cloudCover: 1, moonIllumination: 0 };
    const r = _calcAmbientLight(t);
    const factor = Math.min(1, 45 / 45);
    const cloudiness = Math.min(1, 1 * 1.3);
    const brightness = 0.5 + 0.5 * (1 - cloudiness) * factor;
    assert.deepStrictEqual(r, [brightness, brightness * 0.95, brightness * 0.9]);
});

// _buildSkyColors
test('skyColors daytime clear has blue sky (twilight=0 = full day)', () => {
    const s = _buildSkyColors(60, 0, 0, 'none', false);
    assert.deepStrictEqual(s.skyTopColor, [0.25, 0.50, 0.90]);
    assert.deepStrictEqual(s.skyMidColor, [0.45, 0.70, 0.95]);
    assert.deepStrictEqual(s.skyBottomColor, [0.65, 0.85, 1.00]);
});

test('skyColors nighttime clear is dark', () => {
    const s = _buildSkyColors(-10, 0, 0, 'none', true);
    assert.ok(s.skyTopColor[0] < 0.05);
    assert.ok(s.skyTopColor[1] < 0.05);
});

test('skyColors nighttime overcast is darker grey', () => {
    const s = _buildSkyColors(-10, 0, 0.9, 'none', true);
    // Overcast night should be grey-ish
    assert.ok(s.skyTopColor[0] > 0.05 && s.skyTopColor[0] < 0.15);
});

test('skyColors snowy night is brighter', () => {
    const s = _buildSkyColors(-10, 0, 0.85, 'snow', true);
    // Snowy night should be brighter than plain night
    const plainNight = _buildSkyColors(-10, 0, 0.85, 'none', true);
    assert.ok(s.skyTopColor[0] > plainNight.skyTopColor[0]);
});

test('skyColors sunset gives warm colors', () => {
    const s = _buildSkyColors(10, 0.3, 0, 'none', false);
    // Sunset should have warm bottom
    assert.ok(s.skyBottomColor[0] > 0.7);
    assert.ok(s.skyBottomColor[1] < 0.7);
});

test('skyColors rainy day is grey', () => {
    const s = _buildSkyColors(45, 1, 0.8, 'rain', false);
    // Rain should desaturate sky
    assert.ok(s.skyTopColor[0] > 0.2 && s.skyTopColor[0] < 0.5);
});

test('skyColors sunColor at noon is warm white', () => {
    const s = _buildSkyColors(60, 1, 0, 'none', false);
    assert.deepStrictEqual(s.sunColor, [1.0, 0.92, 0.65]);
});

test('skyColors sunColor overcast is grey-white', () => {
    const s = _buildSkyColors(45, 1, 0.8, 'none', false);
    assert.deepStrictEqual(s.sunColor, [0.8, 0.8, 0.85]);
});

test('skyColors night moon glow color', () => {
    const s = _buildSkyColors(-10, 0, 0, 'none', true);
    assert.deepStrictEqual(s.sunColor, [0.8, 0.85, 1.0]);
});

module.exports = { passed, failed, errors };
