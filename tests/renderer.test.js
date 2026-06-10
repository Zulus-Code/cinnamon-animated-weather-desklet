/* tests/renderer.test.js — Pure function tests for renderer.js */
const assert = require('assert');

// ── Pure function copies from renderer.js ──

// _iconToEmoji: maps icon code + OWM id to emoji
function _iconToEmoji(icon, id) {
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
}

// _themeColors logic extracted as pure function
function _themeColors(theme, isNight) {
    const t = theme || 'auto';
    const isDark = (t === 'dark') || (t === 'auto' && isNight);

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
}

// ── Test suite ──

let passed = 0;
let failed = 0;
const errors = [];

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

console.log('\n── renderer.test.js ──');

// _iconToEmoji tests
test('_iconToEmoji null/undefined icon returns sun emoji', () => {
    assert.strictEqual(_iconToEmoji(null, 800), '\u2600\uFE0F');
    assert.strictEqual(_iconToEmoji(undefined, 800), '\u2600\uFE0F');
});

test('_iconToEmoji thunderstorm id >= 200 returns storm emoji', () => {
    assert.strictEqual(_iconToEmoji('11d', 200), '\u26C8\uFE0F');
    assert.strictEqual(_iconToEmoji('11n', 299), '\u26C8\uFE0F');
});

test('_iconToEmoji drizzle id >= 300 returns drizzle emoji', () => {
    assert.strictEqual(_iconToEmoji('09d', 300), '\uD83C\uDF26\uFE0F');
    assert.strictEqual(_iconToEmoji('09n', 399), '\uD83C\uDF26\uFE0F');
});

test('_iconToEmoji rain id >= 500 and < 511 returns rain emoji', () => {
    assert.strictEqual(_iconToEmoji('10d', 500), '\uD83C\uDF27\uFE0F');
    assert.strictEqual(_iconToEmoji('10n', 510), '\uD83C\uDF27\uFE0F');
});

test('_iconToEmoji freezing rain id >= 511 returns sleet emoji', () => {
    assert.strictEqual(_iconToEmoji('13d', 511), '\uD83C\uDF28\uFE0F');
    assert.strictEqual(_iconToEmoji('13n', 599), '\uD83C\uDF28\uFE0F');
});

test('_iconToEmoji snow id >= 600 returns snowflake', () => {
    assert.strictEqual(_iconToEmoji('13d', 600), '\u2744\uFE0F');
    assert.strictEqual(_iconToEmoji('13n', 699), '\u2744\uFE0F');
});

test('_iconToEmoji fog id >= 701 returns fog emoji', () => {
    assert.strictEqual(_iconToEmoji('50d', 701), '\uD83C\uDF2B\uFE0F');
    assert.strictEqual(_iconToEmoji('50n', 799), '\uD83C\uDF2B\uFE0F');
});

test('_iconToEmoji clear 800 day returns sun', () => {
    assert.strictEqual(_iconToEmoji('01d', 800), '\u2600\uFE0F');
});

test('_iconToEmoji clear 800 night returns moon', () => {
    assert.strictEqual(_iconToEmoji('01n', 800), '\uD83C\uDF19');
});

test('_iconToEmoji partly cloudy 801 day returns sun-behind-cloud', () => {
    assert.strictEqual(_iconToEmoji('02d', 801), '\uD83C\uDF24\uFE0F');
});

test('_iconToEmoji partly cloudy 801 night returns moon-cloud', () => {
    assert.strictEqual(_iconToEmoji('02n', 801), '\uD83C\uDF19\u2601\uFE0F');
});

test('_iconToEmoji 802 day returns partly cloudy emoji', () => {
    assert.strictEqual(_iconToEmoji('03d', 802), '\u26C5');
});

test('_iconToEmoji 802 night returns cloud-moon', () => {
    assert.strictEqual(_iconToEmoji('03n', 802), '\u2601\uFE0F\uD83C\uDF19');
});

test('_iconToEmoji overcast >= 803 returns cloud', () => {
    assert.strictEqual(_iconToEmoji('04d', 803), '\u2601\uFE0F');
    assert.strictEqual(_iconToEmoji('04n', 804), '\u2601\uFE0F');
});

test('_iconToEmoji id >= 803 returns cloud regardless of value', () => {
    assert.strictEqual(_iconToEmoji('01d', 999), '\u2601\uFE0F');
});

test('_iconToEmoji negative/unknown id hits fallback return', () => {
    assert.strictEqual(_iconToEmoji('01d', -1), '\uD83C\uDF24\uFE0F');
});

// _themeColors tests
test('_themeColors auto+night returns dark theme', () => {
    const tc = _themeColors('auto', true);
    assert.strictEqual(tc.isDark, true);
    assert.deepStrictEqual(tc.text, [0.878, 0.910, 1.000]);
    assert.deepStrictEqual(tc.dim, [0.533, 0.600, 0.800]);
    assert.deepStrictEqual(tc.faint, [0.333, 0.400, 0.533]);
    assert.deepStrictEqual(tc.err, [1.000, 0.588, 0.588]);
});

test('_themeColors auto+day returns light theme', () => {
    const tc = _themeColors('auto', false);
    assert.strictEqual(tc.isDark, false);
    assert.deepStrictEqual(tc.text, [1, 1, 1]);
    assert.deepStrictEqual(tc.dim, [1, 1, 1]);
    assert.deepStrictEqual(tc.faint, [1, 1, 1]);
    assert.deepStrictEqual(tc.err, [1, 0.8, 0.8]);
});

test('_themeColors dark always returns dark theme', () => {
    const tc = _themeColors('dark', false);
    assert.strictEqual(tc.isDark, true);
    assert.deepStrictEqual(tc.text, [0.878, 0.910, 1.000]);
});

test('_themeColors warm returns warm palette', () => {
    const tc = _themeColors('warm', false);
    assert.strictEqual(tc.isDark, false);
    assert.deepStrictEqual(tc.text, [0.95, 0.85, 0.70]);
    assert.deepStrictEqual(tc.dim, [0.85, 0.70, 0.50]);
    assert.deepStrictEqual(tc.faint, [0.70, 0.55, 0.35]);
});

test('_themeColors cool returns cool palette', () => {
    const tc = _themeColors('cool', true);
    assert.strictEqual(tc.isDark, false);
    assert.deepStrictEqual(tc.text, [0.75, 0.85, 1.0]);
    assert.deepStrictEqual(tc.dim, [0.55, 0.65, 0.85]);
});

test('_themeColors nature returns nature palette', () => {
    const tc = _themeColors('nature', false);
    assert.strictEqual(tc.isDark, false);
    assert.deepStrictEqual(tc.text, [0.80, 0.90, 0.75]);
    assert.deepStrictEqual(tc.dim, [0.60, 0.75, 0.55]);
});

module.exports = { passed, failed, errors };
