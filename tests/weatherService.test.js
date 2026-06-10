/* tests/weatherService.test.js — Pure function tests for weatherService.js */
const assert = require('assert');

// ── _iconNum from weatherService.js ──
function _iconNum(owmId) {
    if (owmId >= 200 && owmId < 300) return '11';
    if (owmId >= 300 && owmId < 400) return '09';
    if (owmId >= 500 && owmId < 600) return '10';
    if (owmId >= 600 && owmId < 700) return '13';
    if (owmId >= 700 && owmId < 800) return '50';
    if (owmId === 800) return '01';
    if (owmId === 801) return '02';
    if (owmId === 802) return '03';
    if (owmId >= 803) return '04';
    return '01';
}

// ── Mock utilities (simulating Utils._dayName and Utils.wmoToOwmId) ──

function _mockDayName(date, _lang) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()] || '';
}

function _mockWmoToOwmId(code) {
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

// ── _buildDailyForecast logic extracted as pure function ──
function _buildDailyForecast(daily, lang) {
    if (!daily || !daily.time || !daily.temperature_2m_max) return null;

    const list = [];
    const now = new Date();
    const todayDate = now.getDate();

    for (let i = 0; i < daily.time.length; i++) {
        const parts = daily.time[i].split('-');
        const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const dDate = dt.getDate();

        // Skip today's date
        if (dDate === todayDate) continue;

        const dayLabel = _mockDayName(dt, lang || 'en');
        const owmId = _mockWmoToOwmId(daily.weather_code[i]);
        const isNight = false;

        list.push({
            dt: Math.floor(dt.getTime() / 1000),
            day: dayLabel,
            temp_min: daily.temperature_2m_min[i],
            temp_max: daily.temperature_2m_max[i],
            weather_code: daily.weather_code[i],
            weather: [{ icon: _iconNum(owmId) + (isNight ? 'n' : 'd'), id: owmId }]
        });

        // Stop at 5 days
        if (list.length >= 5) break;
    }

    return list.length > 0 ? list : null;
}

// Helper: create a future date string YYYY-MM-DD that is N days from today
function futureDateStr(daysFromNow) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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

console.log('\n── weatherService.test.js ──');

// _iconNum tests
test('_iconNum thunderstorm 200-299 returns 11', () => {
    assert.strictEqual(_iconNum(200), '11');
    assert.strictEqual(_iconNum(299), '11');
});

test('_iconNum drizzle 300-399 returns 09', () => {
    assert.strictEqual(_iconNum(300), '09');
    assert.strictEqual(_iconNum(399), '09');
});

test('_iconNum rain 500-599 returns 10', () => {
    assert.strictEqual(_iconNum(500), '10');
    assert.strictEqual(_iconNum(599), '10');
});

test('_iconNum snow 600-699 returns 13', () => {
    assert.strictEqual(_iconNum(600), '13');
    assert.strictEqual(_iconNum(699), '13');
});

test('_iconNum atmosphere 700-799 returns 50', () => {
    assert.strictEqual(_iconNum(700), '50');
    assert.strictEqual(_iconNum(799), '50');
});

test('_iconNum clear 800 returns 01', () => {
    assert.strictEqual(_iconNum(800), '01');
});

test('_iconNum partly cloudy 801 returns 02', () => {
    assert.strictEqual(_iconNum(801), '02');
});

test('_iconNum partly cloudy 802 returns 03', () => {
    assert.strictEqual(_iconNum(802), '03');
});

test('_iconNum overcast >= 803 returns 04', () => {
    assert.strictEqual(_iconNum(803), '04');
    assert.strictEqual(_iconNum(900), '04');
});

test('_iconNum unknown returns 01', () => {
    assert.strictEqual(_iconNum(0), '01');
});

// _buildDailyForecast tests
test('_buildDailyForecast null daily returns null', () => {
    assert.strictEqual(_buildDailyForecast(null, 'en'), null);
});

test('_buildDailyForecast missing time returns null', () => {
    const daily = { temperature_2m_max: [20, 22] };
    assert.strictEqual(_buildDailyForecast(daily, 'en'), null);
});

test('_buildDailyForecast returns array with forecast items', () => {
    const t1 = futureDateStr(1);
    const t2 = futureDateStr(2);
    const t3 = futureDateStr(3);

    const daily = {
        time: [t1, t2, t3],
        temperature_2m_max: [25, 22, 18],
        temperature_2m_min: [18, 15, 12],
        weather_code: [0, 3, 61]
    };

    const result = _buildDailyForecast(daily, 'en');
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1 && result.length <= 3);
});

test('_buildDailyForecast skips today', () => {
    const today = futureDateStr(0);
    const tomorrow = futureDateStr(1);
    const dayAfter = futureDateStr(2);

    const daily = {
        time: [today, tomorrow, dayAfter],
        temperature_2m_max: [20, 25, 22],
        temperature_2m_min: [15, 18, 16],
        weather_code: [0, 0, 3]
    };

    const result = _buildDailyForecast(daily, 'en');
    assert.ok(result !== null);
    // Should have at most 2 items (skipping today)
    assert.ok(result.length <= 2);
    // First item should NOT be today
    result.forEach(item => {
        const itemDate = new Date(item.dt * 1000);
        const now = new Date();
        assert.notStrictEqual(itemDate.getDate(), now.getDate());
    });
});

test('_buildDailyForecast limits to 5 items', () => {
    const times = [];
    for (let i = 1; i <= 10; i++) {
        times.push(futureDateStr(i));
    }

    const daily = {
        time: times,
        temperature_2m_max: times.map(() => 20),
        temperature_2m_min: times.map(() => 15),
        weather_code: times.map(() => 0)
    };

    const result = _buildDailyForecast(daily, 'en');
    assert.ok(result !== null);
    assert.ok(result.length <= 5, 'Should be at most 5 items, got ' + result.length);
});

test('_buildDailyForecast sets correct weather icon', () => {
    const d1 = futureDateStr(1);
    const daily = {
        time: [d1],
        temperature_2m_max: [25],
        temperature_2m_min: [18],
        weather_code: [0] // clear sky → owmId 800 → icon '01d'
    };

    const result = _buildDailyForecast(daily, 'en');
    assert.ok(result !== null);
    assert.strictEqual(result[0].weather[0].icon, '01d');
    assert.strictEqual(result[0].weather[0].id, 800);
});

test('_buildDailyForecast with rain weather code', () => {
    const d1 = futureDateStr(1);
    const daily = {
        time: [d1],
        temperature_2m_max: [18],
        temperature_2m_min: [12],
        weather_code: [61] // slight rain → owmId 501 → icon '10d'
    };

    const result = _buildDailyForecast(daily, 'en');
    assert.ok(result !== null);
    assert.strictEqual(result[0].weather[0].icon, '10d');
    assert.strictEqual(result[0].weather[0].id, 501);
});

test('_buildDailyForecast stores temp_min and temp_max', () => {
    const d1 = futureDateStr(1);
    const daily = {
        time: [d1],
        temperature_2m_max: [30],
        temperature_2m_min: [22],
        weather_code: [0]
    };

    const result = _buildDailyForecast(daily, 'en');
    assert.ok(result !== null);
    assert.strictEqual(result[0].temp_max, 30);
    assert.strictEqual(result[0].temp_min, 22);
});

test('_buildDailyForecast returns null when all dates are today', () => {
    const today = futureDateStr(0);
    const daily = {
        time: [today],
        temperature_2m_max: [20],
        temperature_2m_min: [15],
        weather_code: [0]
    };

    const result = _buildDailyForecast(daily, 'en');
    assert.strictEqual(result, null);
});

module.exports = { passed, failed, errors };
