/**
 * @file weatherService.js — Open-Meteo API client for weather-animated@zulus
 * @module weatherService
 */

const Soup = imports.gi.Soup;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const Lang = imports.lang;

// Sibling modules are loaded via searchPath (set up in desklet.js)
const Constants = imports.constants;
const Utils = imports.utils;

/* ── MET Norway symbol code → WMO code mapping ─────────────────────────── */
const SYMBOL_TO_WMO = {
    clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3,
    fog: 45, fog_patches: 48,
    lightdrizzle: 51, drizzle: 53, heavydrizzle: 55,
    lightfreezingdrizzle: 56, freezingdrizzle: 57,
    lightrain: 61, rain: 63, heavyrain: 65,
    lightfreezingrain: 66, freezingrain: 67,
    lightsnow: 71, snow: 73, heavysnow: 75, snowgrains: 77,
    lightrainshowers: 80, rainshowers: 81, heavyrainshowers: 82,
    lightsnowshowers: 85, snowshowers: 86, heavysnowshowers: 86,
    lightssleetshowers: 66, sleetshowers: 67, heavysleetshowers: 67,
    sleet: 67, heavysleet: 67, lightsleet: 66,
    thunder: 95, thunderstorm: 95,
    rainandthunder: 95, snowandthunder: 95,
    heavyrainandthunder: 96, rainshowersandthunder: 96,
    sleetshowersandthunder: 96, snowshowersandthunder: 96
};

/* ── WeatherService constructor ──────────────────────────────────────────── */

/**
 * Create a new WeatherService instance.
 * @constructor
 * @returns {void}
 */
function WeatherService() {
    this._httpSession = null;
    this._provider = 'met-norway';
    try {
        this._httpSession = new Soup.Session();
        this._httpSession.timeout = 10;
        this._httpSession.user_agent = 'weather-animated-desklet/2.0 (weather-animated@zulus)';
    } catch (e) {
        this._httpSession = null;
    }
}

/* ── Internal helpers ────────────────────────────────────────────────────── */

/**
 * Convert binary data to string.
 * @param {Object|null|undefined} data - Binary data, string, or null
 * @returns {string} String representation
 */
WeatherService.prototype._bytesToString = function (data) {
    if (data === null || data === undefined) return '';
    if (typeof data === 'string') return data;
    try { return ByteArray.toString(data); } catch (e) { return '' + data; }
};

/**
 * Perform an HTTP GET request via Soup or curl fallback.
 * @param {string} url - URL to fetch
 * @param {Function} onSuccess - Callback on success, receives response string
 * @param {Function} [onError] - Callback on error, receives error string
 * @returns {void}
 */
WeatherService.prototype._httpGet = function (url, onSuccess, onError) {
    const session = this._httpSession;
    const self = this;

    if (!session) {
        try {
            const curlCmd = 'curl -s --connect-timeout 10 --max-time 15 ' + GLib.shell_quote(url);
            const [ok, stdout, _stderr, exitStatus] = GLib.spawn_command_line_sync(curlCmd);
            const out = self._bytesToString(stdout);
            if (ok && exitStatus === 0 && out.length > 0) {
                onSuccess(out);
            } else {
                if (onError) onError('HTTP error (exit ' + exitStatus + ')');
            }
        } catch (e) {
            if (onError) onError(e.toString());
        }
        return;
    }

    let msg;
    try { msg = Soup.Message.new('GET', url); } catch (e) {
        try { msg = new Soup.Message({ method: 'GET', uri: GLib.Uri.parse(url, GLib.UriFlags.NONE) }); } catch (e) { if (onError) onError('Failed to create request'); return; }
    }

    if (typeof session.queue_message === 'function') {
        session.queue_message(msg, Lang.bind(self, function (sess, resp) {
            if (resp.status_code === 200) { onSuccess(self._bytesToString(resp.response_body.data)); } else if (onError) onError('HTTP ' + resp.status_code);
        }));
        return;
    }

    if (typeof session.send_and_read_async === 'function') {
        session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, Lang.bind(self, function (sess, result) {
            try {
                const bytes = sess.send_and_read_finish(result);
                let data = '';
                if (bytes && typeof bytes.get_data === 'function') { data = self._bytesToString(bytes.get_data()); }
                onSuccess(data);
            } catch (e) { if (onError) onError(e.toString()); }
        }));
        return;
    }

    if (typeof session.send_async === 'function') {
        session.send_async(msg, GLib.PRIORITY_DEFAULT, null, Lang.bind(self, function (sess, result) {
            try {
                const stream = sess.send_finish(result);
                const dis = new Gio.DataInputStream({ base_stream: stream });
                const chunks = [];
                while (true) { const [line] = dis.read_line_utf8(null); if (line === null) break; chunks.push(line); }
                onSuccess(chunks.join('\n'));
            } catch (e) { if (onError) onError(e.toString()); }
        }));
        return;
    }

    if (onError) onError('No Soup async method available');
};

/**
 * Map OWM id to icon number string (shared by current & forecast).
 * @param {number} owmId - OWM weather ID
 * @returns {string} Two-digit icon number as string
 */
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

/* ── Location resolve (geocoding / IP auto-detect) ───────────────────────── */

/**
 * Resolve a location name to lat/lon coordinates, or auto-detect via IP.
 * @param {string} location - Location name or 'auto' for IP-based detection
 * @param {string} language - Language code ('en' or 'ru')
 * @param {Function} onSuccess - Callback on success, receives (lat, lon, name, countryCode)
 * @param {Function} onError - Callback on error, receives error object
 * @returns {void}
 */
WeatherService.prototype.resolveLocation = function (location, language, onSuccess, onError) {
    if (location && location !== 'auto') {
        const url = 'https://geocoding-api.open-meteo.com/v1/search?name='
            + GLib.uri_escape_string(location, null, true)
            + '&count=1&language=' + (language === 'ru' ? 'ru' : 'en') + '&format=json';

        this._httpGet(url, function (data) {
            try {
                const json = JSON.parse(data);
                if (json.results && json.results.length > 0) {
                    const r = json.results[0];
                    onSuccess(r.latitude, r.longitude, r.name || location, r.country_code || '');
                    return;
                }
            } catch (e) {}
            // fallback: try as lat,lon pair
            const parts = location.split(',');
            if (parts.length === 2) {
                const lat = parseFloat(parts[0]), lon = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lon)) { onSuccess(lat, lon, location, ''); return; }
            }
            onError({ key: 'resolve_err', detail: location });
        }, function (err) { onError({ key: 'resolve_err', detail: err }); });
    } else {
        // Auto-detect via ip-api.com, fallback Moscow
        this._httpGet('http://ip-api.com/json/?fields=city,countryCode,lat,lon&lang=en',
            function (data) {
                try {
                    const json = JSON.parse(data);
                    const city = json.city || '', country = json.countryCode || '', lat = json.lat, lon = json.lon;
                    if (city && lat !== undefined && lon !== undefined) { onSuccess(lat, lon, city, country); return; }
                } catch (e) {}
                onSuccess(55.75, 37.62, 'Moscow', 'RU');
            },
            function () { onSuccess(55.75, 37.62, 'Moscow', 'RU'); }
        );
    }
};

/* ── Fetch weather + hourly forecast from Open-Meteo ─────────────────────── */

/**
 * Fetch current weather and forecast data from Open-Meteo API.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} name - Location name
 * @param {string} country - Country code
 * @param {string} units - Unit system ('metric' or 'imperial')
 * @param {string} language - Language code ('en' or 'ru')
 * @param {Function} onSuccess - Callback on success, receives weather data object
 * @param {Function} onError - Callback on error, receives error object
 * @returns {void}
 */
WeatherService.prototype.fetchWeather = function (lat, lon, name, country, units, language, onSuccess, onError) {
    const self = this;
    this._lang = language || 'en';

    if (this._provider === 'met-norway') {
        this._fetchMetNorway(lat, lon, name, country, units, language, onSuccess, onError);
        return;
    }

    // ── Open-Meteo (default) ──
    const tempUnit = units === 'metric' ? 'celsius' : 'fahrenheit';
    const windUnit = units === 'metric' ? 'kmh' : 'mph';

    const url = 'https://api.open-meteo.com/v1/forecast'
        + '?latitude=' + lat + '&longitude=' + lon
        + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure'
        + '&hourly=temperature_2m,weather_code'
        + '&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset'
        + '&timezone=auto&forecast_days=6'
        + '&temperature_unit=' + tempUnit + '&wind_speed_unit=' + windUnit;

    this._httpGet(url, function (data) {
        try {
            const json = JSON.parse(data);
            if (json.error) { onError({ key: 'api_err', detail: json.reason || 'unknown' }); return; }

            const current = json.current, hourly = json.hourly, daily = json.daily;

            let sunrise = null, sunset = null;
            if (daily && daily.sunrise && daily.sunrise.length > 0) {
                sunrise = Utils._getMinutes(daily.sunrise[0]);
                sunset = Utils._getMinutes(daily.sunset[0]);
            }

            const now = new Date();
            const curMin = now.getHours() * 60 + now.getMinutes();
            const isNight = (sunrise !== null && sunset !== null)
                ? (curMin < sunrise || curMin > sunset)
                : (now.getHours() < 6 || now.getHours() >= 21);

            const wmoCode = current.weather_code;
            const owmId = Utils.wmoToOwmId(wmoCode);
            const icon = _iconNum(owmId) + (isNight ? 'n' : 'd');

            const lang = language || 'en';
            const desc = (Constants.WMO_DESCRIPTIONS[lang] && Constants.WMO_DESCRIPTIONS[lang][wmoCode])
                || Constants.WMO_DESCRIPTIONS.en[wmoCode] || 'clear sky';

            const weatherData = {
                name: name || '',
                sys: { country: country || '' },
                main: {
                    temp: current.temperature_2m,
                    feels_like: current.apparent_temperature,
                    humidity: current.relative_humidity_2m,
                    pressure: Math.round(current.surface_pressure)
                },
                wind: { speed: current.wind_speed_10m },
                weather: [{ id: owmId, main: desc, description: desc, icon: icon }]
            };

            onSuccess({
                weather: weatherData,
                forecast: self._buildForecastFromHourly(hourly, daily),
                dailyForecast: self._buildDailyForecast(daily, self._lang),
                sunriseMinutes: sunrise,
                sunsetMinutes: sunset
            });
        } catch (e) { onError({ key: 'parse_err', detail: e.toString().slice(0, 60) }); }
    }, function (err) { onError({ key: 'api_err', detail: err }); });
};

/* ── Build forecast list from Open-Meteo hourly arrays ───────────────────── */

/**
 * Build hourly forecast list from Open-Meteo data.
 * @param {Object} hourly - Open-Meteo hourly data object
 * @param {Object} daily - Open-Meteo daily data object
 * @returns {Object|null} Forecast object with list, or null if no data
 */
WeatherService.prototype._buildForecastFromHourly = function (hourly, daily) {
    if (!hourly || !hourly.time || !hourly.temperature_2m || !hourly.weather_code) return null;

    let sr = null, ss = null;
    if (daily && daily.sunrise && daily.sunrise.length > 0) {
        sr = Utils._getMinutes(daily.sunrise[0]);
        ss = Utils._getMinutes(daily.sunset[0]);
    }

    const now = new Date(), list = [];
    for (let i = 0; i < hourly.time.length && list.length < 8; i++) {
        const slotMinutes = Utils._getMinutes(hourly.time[i]);
        const slotDate = Utils._parseLocalDate(hourly.time[i]);
        if (slotDate <= now) continue;

        let slotNight = false;
        if (sr !== null && ss !== null) slotNight = slotMinutes < sr || slotMinutes > ss;
        else { const h = slotDate.getHours(); slotNight = h < 6 || h >= 21; }

        const owmId = Utils.wmoToOwmId(hourly.weather_code[i]);
        list.push({
            dt: Math.floor(slotDate.getTime() / 1000),
            main: { temp: hourly.temperature_2m[i] },
            weather: [{ icon: _iconNum(owmId) + (slotNight ? 'n' : 'd'), id: owmId }]
        });
    }
    return list.length > 0 ? { list: list } : null;
};

/* ── Build daily forecast list from Open-Meteo daily arrays ───────────────── */

/**
 * Build daily forecast list from Open-Meteo data.
 * @param {Object} daily - Open-Meteo daily data object
 * @returns {Array|null} Array of daily forecast items, or null if no data
 */
WeatherService.prototype._buildDailyForecast = function (daily, lang) {
    if (!daily || !daily.time || !daily.temperature_2m_max) return null;

    lang = lang || 'en';
    const list = [];
    const now = new Date();
    const todayDate = now.getDate();

    for (let i = 0; i < daily.time.length; i++) {
        const parts = daily.time[i].split('-');
        const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const dDate = dt.getDate();

        // Skip today's date (already shown as current weather) — show from tomorrow
        if (dDate === todayDate) continue;

        const dayLabel = Utils._dayName(dt, lang);
        const owmId = Utils.wmoToOwmId(daily.weather_code[i]);
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
};

/* ══════════════════════════════════════════════════════════════════════════
 *  MET NORWAY (yr.no) PROVIDER
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Parse a MET Norway symbol_code into { base, isNight }.
 * Symbol codes like "partlycloudy_day", "fog", "rainshowers_night".
 * @param {string} code - Symbol code from MET Norway
 * @returns {Object} { base: string, isNight: boolean }
 */
WeatherService.prototype._parseMetSymbol = function (code) {
    if (!code) return { base: 'fair', isNight: false };
    let base = code;
    let isNight = false;
    if (code.endsWith('_night')) {
        isNight = true;
        base = code.slice(0, -6);
    } else if (code.endsWith('_day')) {
        base = code.slice(0, -4);
    }
    return { base: base || 'fair', isNight: isNight };
};

/**
 * Fetch sunrise/sunset times from MET Norway Sunrise API.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Function} onResult - Callback (sunriseMinutes, sunsetMinutes) or (null, null)
 * @returns {void}
 */
WeatherService.prototype._getMetNorwaySunrise = function (lat, lon, onResult) {
    const now = new Date();
    const dateStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
    const tzOffset = -now.getTimezoneOffset();
    const offsetStr = (tzOffset >= 0 ? '+' : '-') +
        String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0') + ':' +
        String(Math.abs(tzOffset) % 60).padStart(2, '0');
    const url = 'https://api.met.no/weatherapi/sunrise/3.0/sun?lat=' + lat + '&lon=' + lon +
        '&date=' + dateStr + '&offset=' + encodeURIComponent(offsetStr);

    this._httpGet(url, function (data) {
        try {
            const json = JSON.parse(data);
            if (json.properties && json.properties.sunrise && json.properties.sunset) {
                const sr = Utils._getMinutes(json.properties.sunrise.time);
                const ss = Utils._getMinutes(json.properties.sunset.time);
                onResult(sr, ss);
                return;
            }
        } catch (e) {}
        onResult(null, null);
    }, function () { onResult(null, null); });
};

/**
 * Fetch weather from MET Norway (yr.no) Locationforecast 2.0 API.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} name - Location name
 * @param {string} country - Country code
 * @param {string} units - Unit system ('metric' or 'imperial')
 * @param {string} language - Language code
 * @param {Function} onSuccess - Callback on success
 * @param {Function} onError - Callback on error
 * @returns {void}
 */
WeatherService.prototype._fetchMetNorway = function (lat, lon, name, country, units, language, onSuccess, onError) {
    const self = this;
    const url = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' + lat + '&lon=' + lon;

    this._httpGet(url, function (data) {
        try {
            const json = JSON.parse(data);
            if (!json.properties || !json.properties.timeseries || json.properties.timeseries.length === 0) {
                onError({ key: 'api_err', detail: 'No data from MET Norway' });
                return;
            }

            const timeseries = json.properties.timeseries;
            const meta = json.properties.meta || {};

            // Find the closest time point to now
            const now = Date.now();
            let closest = timeseries[0];
            let minDiff = Infinity;
            for (let i = 0; i < timeseries.length; i++) {
                const t = new Date(timeseries[i].time).getTime();
                const diff = Math.abs(t - now);
                if (diff < minDiff) { minDiff = diff; closest = timeseries[i]; }
            }

            const inst = closest.data.instant.details;
            const symbol1h = (closest.data.next_1_hours && closest.data.next_1_hours.summary)
                ? closest.data.next_1_hours.summary.symbol_code : null;
            const symbol6h = (closest.data.next_6_hours && closest.data.next_6_hours.summary)
                ? closest.data.next_6_hours.summary.symbol_code : null;

            // Parse symbol code → base + day/night
            const symCode = symbol1h || symbol6h || 'fair_day';
            const parsed = self._parseMetSymbol(symCode);
            const wmoCode = SYMBOL_TO_WMO[parsed.base] !== undefined ? SYMBOL_TO_WMO[parsed.base] : 0;
            const owmId = Utils.wmoToOwmId(wmoCode);
            const icon = _iconNum(owmId) + (parsed.isNight ? 'n' : 'd');

            // Temperature
            let temp = inst.air_temperature;
            let feels = inst.air_temperature;
            // Wind chill approximation when windy
            if (inst.wind_speed > 2) {
                feels = inst.air_temperature - 1.5 * Math.sqrt(inst.wind_speed);
            }

            // Wind speed: MET Norway returns m/s, desklet shows km/h (metric)
            let windSpeed = inst.wind_speed;
            if (units === 'metric') windSpeed = inst.wind_speed * 3.6; // m/s → km/h

            const lang = language || 'en';
            const desc = (Constants.WMO_DESCRIPTIONS[lang] && Constants.WMO_DESCRIPTIONS[lang][wmoCode])
                || Constants.WMO_DESCRIPTIONS.en[wmoCode] || 'clear sky';

            const weatherData = {
                name: name || '',
                sys: { country: country || '' },
                main: {
                    temp: temp,
                    feels_like: Math.round(feels * 10) / 10,
                    humidity: inst.relative_humidity,
                    pressure: Math.round(inst.air_pressure_at_sea_level || 1013)
                },
                wind: { speed: Math.round(windSpeed * 10) / 10 },
                weather: [{ id: owmId, main: desc, description: desc, icon: icon }]
            };

            // ── Fetch sunrise/sunset separately ──
            self._getMetNorwaySunrise(lat, lon, function (sunriseMin, sunsetMin) {
                const nowMin = new Date();
                const curMin = nowMin.getHours() * 60 + nowMin.getMinutes();
                const isNight = (sunriseMin !== null && sunsetMin !== null)
                    ? (curMin < sunriseMin || curMin > sunsetMin)
                    : parsed.isNight;

                // Override icon if night
                if (isNight && !weatherData.weather[0].icon.endsWith('n')) {
                    weatherData.weather[0].icon = _iconNum(owmId) + 'n';
                }

                onSuccess({
                    weather: weatherData,
                    forecast: self._buildHourlyFromMetNorway(timeseries, sunriseMin, sunsetMin),
                    dailyForecast: self._buildDailyFromMetNorway(timeseries, self._lang),
                    sunriseMinutes: sunriseMin,
                    sunsetMinutes: sunsetMin
                });
            });
        } catch (e) {
            onError({ key: 'parse_err', detail: e.toString().slice(0, 60) });
        }
    }, function (err) { onError({ key: 'api_err', detail: 'MET Norway: ' + err }); });
};

/**
 * Build hourly forecast from MET Norway timeseries.
 * @param {Array} timeseries - MET Norway timeseries array
 * @param {number|null} sunriseMin - Sunrise minutes-since-midnight
 * @param {number|null} sunsetMin - Sunset minutes-since-midnight
 * @returns {Object|null} Forecast object with list, or null
 */
WeatherService.prototype._buildHourlyFromMetNorway = function (timeseries, sunriseMin, sunsetMin) {
    const now = Date.now();
    const list = [];

    for (let i = 0; i < timeseries.length && list.length < 8; i++) {
        const t = timeseries[i];
        const dt = new Date(t.time);
        if (dt.getTime() <= now) continue;

        const inst = t.data.instant.details;
        const sym = (t.data.next_1_hours && t.data.next_1_hours.summary)
            ? t.data.next_1_hours.summary.symbol_code : null;

        if (!sym) continue;

        const parsed = this._parseMetSymbol(sym || 'fair_day');
        const wmoCode = SYMBOL_TO_WMO[parsed.base] !== undefined ? SYMBOL_TO_WMO[parsed.base] : 0;
        const owmId = Utils.wmoToOwmId(wmoCode);

        const slotMinutes = dt.getHours() * 60 + dt.getMinutes();
        let slotNight = parsed.isNight;
        if (sunriseMin !== null && sunsetMin !== null) {
            slotNight = slotMinutes < sunriseMin || slotMinutes > sunsetMin;
        }

        list.push({
            dt: Math.floor(dt.getTime() / 1000),
            main: { temp: inst.air_temperature },
            weather: [{ icon: _iconNum(owmId) + (slotNight ? 'n' : 'd'), id: owmId }]
        });
    }
    return list.length > 0 ? { list: list } : null;
};

/**
 * Build daily forecast from MET Norway timeseries.
 * Groups points by calendar date, uses most common symbol per day.
 * @param {Array} timeseries - MET Norway timeseries array
 * @param {string} lang - Language code
 * @returns {Array|null} Array of daily forecast items, or null
 */
WeatherService.prototype._buildDailyFromMetNorway = function (timeseries, lang) {
    lang = lang || 'en';

    // Group by date
    const days = {};
    for (let i = 0; i < timeseries.length; i++) {
        const t = timeseries[i];
        const dt = new Date(t.time);
        const dateKey = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') +
            '-' + String(dt.getDate()).padStart(2, '0');

        if (!days[dateKey]) days[dateKey] = [];
        days[dateKey].push(t);
    }

    const now = new Date();
    const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') +
        '-' + String(now.getDate()).padStart(2, '0');

    const sortedKeys = Object.keys(days).sort();
    const list = [];

    for (let k = 0; k < sortedKeys.length && list.length < 5; k++) {
        const key = sortedKeys[k];
        if (key === todayStr) continue; // skip today

        const pts = days[key];
        let minTemp = Infinity, maxTemp = -Infinity;
        const symCounts = {};

        for (let p = 0; p < pts.length; p++) {
            const inst = pts[p].data.instant.details;
            if (inst.air_temperature < minTemp) minTemp = inst.air_temperature;
            if (inst.air_temperature > maxTemp) maxTemp = inst.air_temperature;

            const sym = (pts[p].data.next_6_hours && pts[p].data.next_6_hours.summary)
                ? pts[p].data.next_6_hours.summary.symbol_code
                : (pts[p].data.next_12_hours && pts[p].data.next_12_hours.summary
                    ? pts[p].data.next_12_hours.summary.symbol_code : 'fair_day');
            const parsed = this._parseMetSymbol(sym);
            symCounts[parsed.base] = (symCounts[parsed.base] || 0) + 1;
        }

        // Most common symbol for the day
        let bestSym = 'fair';
        let bestCount = 0;
        for (const s in symCounts) {
            if (symCounts[s] > bestCount) { bestCount = symCounts[s]; bestSym = s; }
        }

        const wmoCode = SYMBOL_TO_WMO[bestSym] !== undefined ? SYMBOL_TO_WMO[bestSym] : 0;
        const owmId = Utils.wmoToOwmId(wmoCode);

        const parts = key.split('-');
        const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const dayLabel = Utils._dayName(dt, lang);

        list.push({
            dt: Math.floor(dt.getTime() / 1000),
            day: dayLabel,
            temp_min: minTemp === Infinity ? null : minTemp,
            temp_max: maxTemp === -Infinity ? null : maxTemp,
            weather_code: wmoCode,
            weather: [{ icon: _iconNum(owmId) + 'd', id: owmId }]
        });
    }

    return list.length > 0 ? list : null;
};

// eslint-disable-next-line no-var
var WeatherService = WeatherService;
