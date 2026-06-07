/* weatherService.js — Open-Meteo API client for weather-animated@zulus */

const Soup = imports.gi.Soup;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const Lang = imports.lang;

// Sibling modules are loaded via searchPath (set up in desklet.js)
const Constants = imports.constants;
const Utils = imports.utils;

/* ── WeatherService constructor ──────────────────────────────────────────── */
function WeatherService() {
    this._httpSession = null;
    try {
        this._httpSession = new Soup.Session();
        this._httpSession.timeout = 10;
    } catch (e) {
        this._httpSession = null;
    }
}

/* ── Internal helpers ────────────────────────────────────────────────────── */

WeatherService.prototype._bytesToString = function (data) {
    if (data === null || data === undefined) return '';
    if (typeof data === 'string') return data;
    try { return ByteArray.toString(data); } catch (e) { return '' + data; }
};

WeatherService.prototype._httpGet = function (url, onSuccess, onError) {
    let session = this._httpSession;
    let self = this;

    if (!session) {
        try {
            let curlCmd = 'curl -s --connect-timeout 10 --max-time 15 ' + GLib.shell_quote(url);
            let [ok, stdout, stderr, exitStatus] = GLib.spawn_command_line_sync(curlCmd);
            let out = self._bytesToString(stdout);
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
    try { msg = Soup.Message.new('GET', url); }
    catch (e) {
        try { msg = new Soup.Message({ method: 'GET', uri: GLib.Uri.parse(url, GLib.UriFlags.NONE) }); }
        catch (e2) { if (onError) onError('Failed to create request'); return; }
    }

    if (typeof session.queue_message === 'function') {
        session.queue_message(msg, Lang.bind(self, function (sess, resp) {
            if (resp.status_code === 200)
                onSuccess(self._bytesToString(resp.response_body.data));
            else if (onError) onError('HTTP ' + resp.status_code);
        }));
        return;
    }

    if (typeof session.send_and_read_async === 'function') {
        session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, Lang.bind(self, function (sess, result) {
            try {
                let bytes = sess.send_and_read_finish(result);
                let data = '';
                if (bytes && typeof bytes.get_data === 'function')
                    data = self._bytesToString(bytes.get_data());
                onSuccess(data);
            } catch (e) { if (onError) onError(e.toString()); }
        }));
        return;
    }

    if (typeof session.send_async === 'function') {
        session.send_async(msg, GLib.PRIORITY_DEFAULT, null, Lang.bind(self, function (sess, result) {
            try {
                let stream = sess.send_finish(result);
                let dis = new Gio.DataInputStream({ base_stream: stream });
                let chunks = [];
                while (true) { let [line] = dis.read_line_utf8(null); if (line === null) break; chunks.push(line); }
                onSuccess(chunks.join('\n'));
            } catch (e) { if (onError) onError(e.toString()); }
        }));
        return;
    }

    if (onError) onError('No Soup async method available');
};

/* Map OWM id → icon number string (shared by current & forecast) */
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
WeatherService.prototype.resolveLocation = function (location, language, onSuccess, onError) {
    if (location && location !== 'auto') {
        let url = 'https://geocoding-api.open-meteo.com/v1/search?name='
            + GLib.uri_escape_string(location, null, true)
            + '&count=1&language=' + (language === 'ru' ? 'ru' : 'en') + '&format=json';

        this._httpGet(url, function (data) {
            try {
                let json = JSON.parse(data);
                if (json.results && json.results.length > 0) {
                    let r = json.results[0];
                    onSuccess(r.latitude, r.longitude, r.name || location, r.country_code || '');
                    return;
                }
            } catch (e) {}
            // fallback: try as lat,lon pair
            let parts = location.split(',');
            if (parts.length === 2) {
                let lat = parseFloat(parts[0]), lon = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lon)) { onSuccess(lat, lon, location, ''); return; }
            }
            onError({ key: 'resolve_err', detail: location });
        }, function (err) { onError({ key: 'resolve_err', detail: err }); });
    } else {
        // Auto-detect via ip-api.com, fallback Moscow
        this._httpGet('http://ip-api.com/json/?fields=city,countryCode,lat,lon&lang=en',
            function (data) {
                try {
                    let json = JSON.parse(data);
                    let city = json.city || '', country = json.countryCode || '', lat = json.lat, lon = json.lon;
                    if (city && lat !== undefined && lon !== undefined) { onSuccess(lat, lon, city, country); return; }
                } catch (e) {}
                onSuccess(55.75, 37.62, 'Moscow', 'RU');
            },
            function () { onSuccess(55.75, 37.62, 'Moscow', 'RU'); }
        );
    }
};

/* ── Fetch weather + hourly forecast from Open-Meteo ─────────────────────── */
WeatherService.prototype.fetchWeather = function (lat, lon, name, country, units, language, onSuccess, onError) {
    let self = this;
    let tempUnit = units === 'metric' ? 'celsius' : 'fahrenheit';
    let windUnit = units === 'metric' ? 'kmh' : 'mph';

    let url = 'https://api.open-meteo.com/v1/forecast'
        + '?latitude=' + lat + '&longitude=' + lon
        + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure'
        + '&hourly=temperature_2m,weather_code'
        + '&daily=sunrise,sunset&timezone=auto&forecast_days=2'
        + '&temperature_unit=' + tempUnit + '&wind_speed_unit=' + windUnit;

    this._httpGet(url, function (data) {
        try {
            let json = JSON.parse(data);
            if (json.error) { onError({ key: 'api_err', detail: json.reason || 'unknown' }); return; }

            let current = json.current, hourly = json.hourly, daily = json.daily;

            let sunrise = null, sunset = null;
            if (daily && daily.sunrise && daily.sunrise.length > 0) {
                sunrise = Utils._getMinutes(daily.sunrise[0]);
                sunset = Utils._getMinutes(daily.sunset[0]);
            }

            let now = new Date();
            let curMin = now.getHours() * 60 + now.getMinutes();
            let isNight = (sunrise !== null && sunset !== null)
                ? (curMin < sunrise || curMin > sunset)
                : (now.getHours() < 6 || now.getHours() >= 21);

            let wmoCode = current.weather_code;
            let owmId = Utils.wmoToOwmId(wmoCode);
            let icon = _iconNum(owmId) + (isNight ? 'n' : 'd');

            let lang = language || 'en';
            let desc = (Constants.WMO_DESCRIPTIONS[lang] && Constants.WMO_DESCRIPTIONS[lang][wmoCode])
                || Constants.WMO_DESCRIPTIONS.en[wmoCode] || 'clear sky';

            let weatherData = {
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
                sunriseMinutes: sunrise,
                sunsetMinutes: sunset
            });
        } catch (e) { onError({ key: 'parse_err', detail: e.toString().slice(0, 60) }); }
    }, function (err) { onError({ key: 'api_err', detail: err }); });
};

/* ── Build forecast list from Open-Meteo hourly arrays ───────────────────── */
WeatherService.prototype._buildForecastFromHourly = function (hourly, daily) {
    if (!hourly || !hourly.time || !hourly.temperature_2m || !hourly.weather_code) return null;

    let sr = null, ss = null;
    if (daily && daily.sunrise && daily.sunrise.length > 0) {
        sr = Utils._getMinutes(daily.sunrise[0]);
        ss = Utils._getMinutes(daily.sunset[0]);
    }

    let now = new Date(), list = [];
    for (let i = 0; i < hourly.time.length && list.length < 8; i++) {
        let slotMinutes = Utils._getMinutes(hourly.time[i]);
        let slotDate = Utils._parseLocalDate(hourly.time[i]);
        if (slotDate <= now) continue;

        let slotNight = false;
        if (sr !== null && ss !== null) slotNight = slotMinutes < sr || slotMinutes > ss;
        else { let h = slotDate.getHours(); slotNight = h < 6 || h >= 21; }

        let owmId = Utils.wmoToOwmId(hourly.weather_code[i]);
        list.push({
            dt: Math.floor(slotDate.getTime() / 1000),
            main: { temp: hourly.temperature_2m[i] },
            weather: [{ icon: _iconNum(owmId) + (slotNight ? 'n' : 'd'), id: owmId }]
        });
    }
    return list.length > 0 ? { list: list } : null;
};

var WeatherService = WeatherService;
