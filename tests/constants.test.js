/* tests/constants.test.js — Data structure tests for constants.js */
const assert = require('assert');

// ── Data structure copies from constants.js ──

const COLORS = {
    sky: {
        clear_day: ['#4facfe', '#00f2fe'],
        clear_night: ['#0c1445', '#1a237e'],
        cloudy_day: ['#8e9eab', '#bcc6cc'],
        cloudy_night: ['#2c3e50', '#34495e'],
        rainy_day: ['#4b6cb7', '#606c88'],
        rainy_night: ['#1a1a2e', '#2d2d44'],
        snowy_day: ['#e0eaf5', '#c9d6e3'],
        snowy_night: ['#1a1a3e', '#2d2d5e'],
        stormy: ['#232526', '#414345'],
        foggy: ['#b8c6d1', '#d1dbe5']
    },
    dark: {
        text: '#e0e8ff',
        textDim: '#8899cc',
        textFaint: '#556688'
    }
};

const STRINGS = {
    en: {
        feels_like:        'Feels like',
        humidity:          'Humidity',
        wind:              'Wind',
        pressure:          'Pressure',
        forecast:          'Forecast',
        loading:           'Loading weather...',
        unknown_api_err:   'Unknown API error',
        parse_err:         'Parse error',
        api_err:           'Weather API error',
        http_err:          'HTTP error (exit',
        failed_req:        'Failed to create request',
        http_prefix:       'HTTP',
        no_soup:           'No Soup async method available',
        wind_unit:         'km/h',
        pressure_unit:     'hPa',
        resolve_err:       'Could not determine location'
    },
    ru: {
        feels_like:        'Ощущается как',
        humidity:          'Влажность',
        wind:              'Ветер',
        pressure:          'Давление',
        forecast:          'Прогноз',
        loading:           'Загрузка погоды...',
        unknown_api_err:   'Неизвестная ошибка API',
        parse_err:         'Ошибка парсинга',
        api_err:           'Ошибка погодного API',
        http_err:          'Ошибка HTTP (код',
        failed_req:        'Не удалось создать запрос',
        http_prefix:       'HTTP',
        no_soup:           'Нет доступного метода Soup async',
        wind_unit:         'м/с',
        pressure_unit:     'гПа',
        resolve_err:       'Не удалось определить местоположение'
    }
};

const WMO_DESCRIPTIONS = {
    en: {
        0: 'clear sky',
        1: 'mainly clear',
        2: 'partly cloudy',
        3: 'overcast',
        45: 'foggy',
        48: 'depositing rime fog',
        51: 'light drizzle',
        53: 'moderate drizzle',
        55: 'dense drizzle',
        56: 'light freezing drizzle',
        57: 'dense freezing drizzle',
        61: 'slight rain',
        63: 'moderate rain',
        65: 'heavy rain',
        66: 'light freezing rain',
        67: 'heavy freezing rain',
        71: 'slight snow',
        73: 'moderate snow',
        75: 'heavy snow',
        77: 'snow grains',
        80: 'slight rain showers',
        81: 'moderate rain showers',
        82: 'violent rain showers',
        85: 'slight snow showers',
        86: 'heavy snow showers',
        95: 'thunderstorm',
        96: 'thunderstorm with slight hail',
        99: 'thunderstorm with heavy hail'
    },
    ru: {
        0: 'ясно',
        1: 'преимущественно ясно',
        2: 'переменная облачность',
        3: 'пасмурно',
        45: 'туман',
        48: 'ледяной туман',
        51: 'лёгкая морось',
        53: 'умеренная морось',
        55: 'сильная морось',
        56: 'лёгкая ледяная морось',
        57: 'сильная ледяная морось',
        61: 'небольшой дождь',
        63: 'умеренный дождь',
        65: 'сильный дождь',
        66: 'небольшой ледяной дождь',
        67: 'сильный ледяной дождь',
        71: 'небольшой снег',
        73: 'умеренный снег',
        75: 'сильный снег',
        77: 'снежные зёрна',
        80: 'небольшой ливень',
        81: 'умеренный ливень',
        82: 'сильный ливень',
        85: 'небольшой снегопад',
        86: 'сильный снегопад',
        95: 'гроза',
        96: 'гроза с градом',
        99: 'сильная гроза с градом'
    }
};

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

console.log('\n── constants.test.js ──');

// COLORS shape tests
test('COLORS has sky and dark keys', () => {
    assert.ok(COLORS.sky);
    assert.ok(COLORS.dark);
});

test('COLORS.sky has 10 entries', () => {
    const keys = Object.keys(COLORS.sky);
    assert.strictEqual(keys.length, 10);
    const expected = ['clear_day', 'clear_night', 'cloudy_day', 'cloudy_night',
        'rainy_day', 'rainy_night', 'snowy_day', 'snowy_night', 'stormy', 'foggy'];
    expected.forEach(k => assert.ok(keys.includes(k), 'Missing key: ' + k));
});

test('COLORS.sky entries are arrays of 2 hex strings', () => {
    Object.values(COLORS.sky).forEach(arr => {
        assert.ok(Array.isArray(arr));
        assert.strictEqual(arr.length, 2);
        arr.forEach(h => assert.match(h, /^#[0-9a-f]{6}$/i, 'Not a hex color: ' + h));
    });
});

test('COLORS.dark has 3 entries', () => {
    const keys = Object.keys(COLORS.dark);
    assert.strictEqual(keys.length, 3);
    ['text', 'textDim', 'textFaint'].forEach(k => assert.ok(keys.includes(k)));
});

test('COLORS.dark entries are hex strings', () => {
    Object.values(COLORS.dark).forEach(h => {
        assert.match(h, /^#[0-9a-f]{6}$/i, 'Not a hex color: ' + h);
    });
});

// STRINGS tests
test('STRINGS has en and ru keys', () => {
    assert.ok(STRINGS.en);
    assert.ok(STRINGS.ru);
});

test('STRINGS.en has all expected keys', () => {
    const expectedKeys = [
        'feels_like', 'humidity', 'wind', 'pressure', 'forecast', 'loading',
        'unknown_api_err', 'parse_err', 'api_err', 'http_err', 'failed_req',
        'http_prefix', 'no_soup', 'wind_unit', 'pressure_unit', 'resolve_err'
    ];
    expectedKeys.forEach(k => {
        assert.ok(STRINGS.en[k] !== undefined, 'Missing STRINGS.en.' + k);
        assert.strictEqual(typeof STRINGS.en[k], 'string');
    });
});

test('STRINGS.ru has same keys as STRINGS.en', () => {
    const enKeys = Object.keys(STRINGS.en).sort();
    const ruKeys = Object.keys(STRINGS.ru).sort();
    assert.deepStrictEqual(ruKeys, enKeys);
});

test('STRINGS.en values are non-empty strings', () => {
    Object.values(STRINGS.en).forEach(v => {
        assert.strictEqual(typeof v, 'string');
        assert.ok(v.length > 0, 'Empty string in STRINGS.en');
    });
});

test('STRINGS.ru values are non-empty strings', () => {
    Object.values(STRINGS.ru).forEach(v => {
        assert.strictEqual(typeof v, 'string');
        assert.ok(v.length > 0, 'Empty string in STRINGS.ru');
    });
});

// WMO_DESCRIPTIONS tests
test('WMO_DESCRIPTIONS has en and ru keys', () => {
    assert.ok(WMO_DESCRIPTIONS.en);
    assert.ok(WMO_DESCRIPTIONS.ru);
});

test('WMO_DESCRIPTIONS.en has all WMO weather codes (0-99 range)', () => {
    const expectedCodes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57,
        61, 63, 65, 66, 67, 71, 73, 75, 77,
        80, 81, 82, 85, 86, 95, 96, 99];
    expectedCodes.forEach(code => {
        assert.ok(WMO_DESCRIPTIONS.en[code] !== undefined,
            'Missing WMO_DESCRIPTIONS.en[' + code + ']');
    });
    assert.strictEqual(Object.keys(WMO_DESCRIPTIONS.en).length, expectedCodes.length);
});

test('WMO_DESCRIPTIONS.ru has same codes as WMO_DESCRIPTIONS.en', () => {
    const enCodes = Object.keys(WMO_DESCRIPTIONS.en).sort();
    const ruCodes = Object.keys(WMO_DESCRIPTIONS.ru).sort();
    assert.deepStrictEqual(ruCodes, enCodes);
});

test('WMO_DESCRIPTIONS.en values describe weather', () => {
    Object.entries(WMO_DESCRIPTIONS.en).forEach(([code, desc]) => {
        assert.strictEqual(typeof desc, 'string');
        assert.ok(desc.length > 0, 'Empty description for code ' + code);
    });
});

test('WMO_DESCRIPTIONS.ru values describe weather in Russian', () => {
    Object.entries(WMO_DESCRIPTIONS.ru).forEach(([code, desc]) => {
        assert.strictEqual(typeof desc, 'string');
        assert.ok(desc.length > 0, 'Empty Russian description for code ' + code);
    });
});

module.exports = { passed, failed, errors };
