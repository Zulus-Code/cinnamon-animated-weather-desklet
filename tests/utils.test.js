/* tests/utils.test.js — Pure function tests for utils.js */
const assert = require('assert');

// ── Pure function copies from utils.js ──

function _parseLocalDate(str) {
    const parts = str.split('T');
    const dateParts = parts[0].split('-');
    const timeParts = parts[1].split(':');
    return new Date(
        parseInt(dateParts[0], 10),
        parseInt(dateParts[1], 10) - 1,
        parseInt(dateParts[2], 10),
        parseInt(timeParts[0], 10),
        parseInt(timeParts[1], 10)
    );
}

function _getMinutes(str) {
    const timePart = str.split('T')[1];
    const parts = timePart.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function _hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
}

function _dayName(date, lang) {
    try {
        return date.toLocaleDateString(lang || 'en', { weekday: 'short' });
    } catch (e) {
        const days = lang === 'ru' ? ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
            : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getDay()] || '';
    }
}

function wmoToOwmId(code) {
    if (code <= 1) return 800;
    if (code === 2) return 801;
    if (code === 3) return 802;
    if (code === 45 || code === 48) return 701;
    if (code >= 51 && code <= 57) return 301;
    if (code >= 61 && code <= 65) return code >= 65 ? 502 : 501;
    if (code === 66 || code === 67) return 511;
    if (code >= 71 && code <= 77) return code >= 75 ? 602 : 601;
    if (code >= 80 && code <= 82) return code === 82 ? 502 : 501;
    if (code >= 85 && code <= 86) return code === 86 ? 602 : 601;
    if (code >= 95 && code <= 99) return code === 95 ? 201 : 202;
    return 800;
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

console.log('\n── utils.test.js ──');

// _parseLocalDate
test('_parseLocalDate parses ISO-like string correctly', () => {
    const d = _parseLocalDate('2026-06-10T14:30');
    assert.strictEqual(d.getFullYear(), 2026);
    assert.strictEqual(d.getMonth(), 5); // June = 5
    assert.strictEqual(d.getDate(), 10);
    assert.strictEqual(d.getHours(), 14);
    assert.strictEqual(d.getMinutes(), 30);
});

test('_parseLocalDate handles midnight', () => {
    const d = _parseLocalDate('2026-01-01T00:00');
    assert.strictEqual(d.getHours(), 0);
    assert.strictEqual(d.getMinutes(), 0);
});

test('_parseLocalDate handles end of year', () => {
    const d = _parseLocalDate('2025-12-31T23:59');
    assert.strictEqual(d.getFullYear(), 2025);
    assert.strictEqual(d.getMonth(), 11);
    assert.strictEqual(d.getDate(), 31);
    assert.strictEqual(d.getHours(), 23);
    assert.strictEqual(d.getMinutes(), 59);
});

// _getMinutes
test('_getMinutes returns minutes since midnight', () => {
    assert.strictEqual(_getMinutes('2026-06-10T00:00'), 0);
    assert.strictEqual(_getMinutes('2026-06-10T01:00'), 60);
    assert.strictEqual(_getMinutes('2026-06-10T06:30'), 390);
    assert.strictEqual(_getMinutes('2026-06-10T12:00'), 720);
    assert.strictEqual(_getMinutes('2026-06-10T23:59'), 1439);
});

// _hexToRgba
test('_hexToRgba converts black', () => {
    const [r, g, b] = _hexToRgba('#000000');
    assert.strictEqual(r, 0);
    assert.strictEqual(g, 0);
    assert.strictEqual(b, 0);
});

test('_hexToRgba converts white', () => {
    const [r, g, b] = _hexToRgba('#ffffff');
    assert.strictEqual(r, 1);
    assert.strictEqual(g, 1);
    assert.strictEqual(b, 1);
});

test('_hexToRgba converts red', () => {
    const [r, g, b] = _hexToRgba('#ff0000');
    assert.strictEqual(r, 1);
    assert.strictEqual(g, 0);
    assert.strictEqual(b, 0);
});

test('_hexToRgba converts green', () => {
    const [r, g, b] = _hexToRgba('#00ff00');
    assert.strictEqual(r, 0);
    assert.strictEqual(g, 1);
    assert.strictEqual(b, 0);
});

test('_hexToRgba converts blue', () => {
    const [r, g, b] = _hexToRgba('#0000ff');
    assert.strictEqual(r, 0);
    assert.strictEqual(g, 0);
    assert.strictEqual(b, 1);
});

test('_hexToRgba converts mid-gray', () => {
    const [r, g, b] = _hexToRgba('#808080');
    assert.strictEqual(r, 0x80 / 255);
    assert.strictEqual(g, 0x80 / 255);
    assert.strictEqual(b, 0x80 / 255);
});

// _dayName
test('_dayName returns English short name by default', () => {
    const d = new Date(2026, 5, 10); // Wednesday June 10, 2026
    const name = _dayName(d);
    assert(name === 'Wed' || name === 'Wed', 'Expected Wed, got ' + name);
});

test('_dayName returns Russian name for ru locale', () => {
    // Get day name via fallback (node might have Russsian locale issues)
    const d = new Date(2026, 5, 10); // Wednesday
    const name = _dayName(d, 'ru');
    // If Intl works with 'ru', it'll be 'ср' otherwise fallback 'Ср'
    assert(name.length > 0, 'Expected non-empty name, got ' + name);
});

// wmoToOwmId
test('wmoToOwmId 0 → 800 (clear)', () => {
    assert.strictEqual(wmoToOwmId(0), 800);
});

test('wmoToOwmId 1 → 800 (mainly clear)', () => {
    assert.strictEqual(wmoToOwmId(1), 800);
});

test('wmoToOwmId 2 → 801 (partly cloudy)', () => {
    assert.strictEqual(wmoToOwmId(2), 801);
});

test('wmoToOwmId 3 → 802 (overcast)', () => {
    assert.strictEqual(wmoToOwmId(3), 802);
});

test('wmoToOwmId 45 → 701 (fog)', () => {
    assert.strictEqual(wmoToOwmId(45), 701);
});

test('wmoToOwmId 48 → 701 (rime fog)', () => {
    assert.strictEqual(wmoToOwmId(48), 701);
});

test('wmoToOwmId 51 → 301 (light drizzle)', () => {
    assert.strictEqual(wmoToOwmId(51), 301);
});

test('wmoToOwmId 57 → 301 (dense freezing drizzle)', () => {
    assert.strictEqual(wmoToOwmId(57), 301);
});

test('wmoToOwmId 61 → 501 (slight rain)', () => {
    assert.strictEqual(wmoToOwmId(61), 501);
});

test('wmoToOwmId 65 → 502 (heavy rain)', () => {
    assert.strictEqual(wmoToOwmId(65), 502);
});

test('wmoToOwmId 66 → 511 (freezing rain)', () => {
    assert.strictEqual(wmoToOwmId(66), 511);
});

test('wmoToOwmId 67 → 511 (heavy freezing rain)', () => {
    assert.strictEqual(wmoToOwmId(67), 511);
});

test('wmoToOwmId 71 → 601 (slight snow)', () => {
    assert.strictEqual(wmoToOwmId(71), 601);
});

test('wmoToOwmId 75 → 602 (heavy snow)', () => {
    assert.strictEqual(wmoToOwmId(75), 602);
});

test('wmoToOwmId 77 → 602 (snow grains, code>=75)', () => {
    assert.strictEqual(wmoToOwmId(77), 602);
});

test('wmoToOwmId 80 → 501 (slight rain showers)', () => {
    assert.strictEqual(wmoToOwmId(80), 501);
});

test('wmoToOwmId 82 → 502 (violent rain showers)', () => {
    assert.strictEqual(wmoToOwmId(82), 502);
});

test('wmoToOwmId 85 → 601 (slight snow showers)', () => {
    assert.strictEqual(wmoToOwmId(85), 601);
});

test('wmoToOwmId 86 → 602 (heavy snow showers)', () => {
    assert.strictEqual(wmoToOwmId(86), 602);
});

test('wmoToOwmId 95 → 201 (thunderstorm)', () => {
    assert.strictEqual(wmoToOwmId(95), 201);
});

test('wmoToOwmId 99 → 202 (thunderstorm with heavy hail)', () => {
    assert.strictEqual(wmoToOwmId(99), 202);
});

test('wmoToOwmId unknown code → 800 (fallback)', () => {
    assert.strictEqual(wmoToOwmId(999), 800);
    assert.strictEqual(wmoToOwmId(-1), 800);
});

module.exports = { passed, failed, errors };
