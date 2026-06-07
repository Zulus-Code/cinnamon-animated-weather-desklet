/* constants.js — Shared constants for weather-animated@zulus */

var UUID = "weather-animated@zulus";
var DESKLET_ROOT = imports.ui.deskletManager.deskletMeta[UUID].path;

var COLORS = {
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

var STRINGS = {
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
        resolve_err:       'Could not determine location',
    },
    ru: {
        feels_like:        '\u041E\u0449\u0443\u0449\u0430\u0435\u0442\u0441\u044F \u043A\u0430\u043A',
        humidity:          '\u0412\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u044C',
        wind:              '\u0412\u0435\u0442\u0435\u0440',
        pressure:          '\u0414\u0430\u0432\u043B\u0435\u043D\u0438\u0435',
        forecast:          '\u041F\u0440\u043E\u0433\u043D\u043E\u0437',
        loading:           '\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043F\u043E\u0433\u043E\u0434\u044B...',
        unknown_api_err:   '\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 API',
        parse_err:         '\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0430\u0440\u0441\u0438\u043D\u0433\u0430',
        api_err:           '\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u043E\u0433\u043E\u0434\u043D\u043E\u0433\u043E API',
        http_err:          '\u041E\u0448\u0438\u0431\u043A\u0430 HTTP (\u043A\u043E\u0434',
        failed_req:        '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441',
        http_prefix:       'HTTP',
        no_soup:           '\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0433\u043E \u043C\u0435\u0442\u043E\u0434\u0430 Soup async',
        wind_unit:         '\u043C/\u0441',
        pressure_unit:     '\u0433\u041F\u0430',
        resolve_err:       '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435',
    }
};

var WMO_DESCRIPTIONS = {
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
        0: '\u044F\u0441\u043D\u043E',
        1: '\u043F\u0440\u0435\u0438\u043C\u0443\u0449\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E \u044F\u0441\u043D\u043E',
        2: '\u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u043E\u0431\u043B\u0430\u0447\u043D\u043E\u0441\u0442\u044C',
        3: '\u043F\u0430\u0441\u043C\u0443\u0440\u043D\u043E',
        45: '\u0442\u0443\u043C\u0430\u043D',
        48: '\u043B\u0435\u0434\u044F\u043D\u043E\u0439 \u0442\u0443\u043C\u0430\u043D',
        51: '\u043B\u0451\u0433\u043A\u0430\u044F \u043C\u043E\u0440\u043E\u0441\u044C',
        53: '\u0443\u043C\u0435\u0440\u0435\u043D\u043D\u0430\u044F \u043C\u043E\u0440\u043E\u0441\u044C',
        55: '\u0441\u0438\u043B\u044C\u043D\u0430\u044F \u043C\u043E\u0440\u043E\u0441\u044C',
        56: '\u043B\u0451\u0433\u043A\u0430\u044F \u043B\u0435\u0434\u044F\u043D\u0430\u044F \u043C\u043E\u0440\u043E\u0441\u044C',
        57: '\u0441\u0438\u043B\u044C\u043D\u0430\u044F \u043B\u0435\u0434\u044F\u043D\u0430\u044F \u043C\u043E\u0440\u043E\u0441\u044C',
        61: '\u043D\u0435\u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0434\u043E\u0436\u0434\u044C',
        63: '\u0443\u043C\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u0434\u043E\u0436\u0434\u044C',
        65: '\u0441\u0438\u043B\u044C\u043D\u044B\u0439 \u0434\u043E\u0436\u0434\u044C',
        66: '\u043D\u0435\u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u043B\u0435\u0434\u044F\u043D\u043E\u0439 \u0434\u043E\u0436\u0434\u044C',
        67: '\u0441\u0438\u043B\u044C\u043D\u044B\u0439 \u043B\u0435\u0434\u044F\u043D\u043E\u0439 \u0434\u043E\u0436\u0434\u044C',
        71: '\u043D\u0435\u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0441\u043D\u0435\u0433',
        73: '\u0443\u043C\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u0441\u043D\u0435\u0433',
        75: '\u0441\u0438\u043B\u044C\u043D\u044B\u0439 \u0441\u043D\u0435\u0433',
        77: '\u0441\u043D\u0435\u0436\u043D\u044B\u0435 \u0437\u0451\u0440\u043D\u0430',
        80: '\u043D\u0435\u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u043B\u0438\u0432\u0435\u043D\u044C',
        81: '\u0443\u043C\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u043B\u0438\u0432\u0435\u043D\u044C',
        82: '\u0441\u0438\u043B\u044C\u043D\u044B\u0439 \u043B\u0438\u0432\u0435\u043D\u044C',
        85: '\u043D\u0435\u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0441\u043D\u0435\u0433\u043E\u043F\u0430\u0434',
        86: '\u0441\u0438\u043B\u044C\u043D\u044B\u0439 \u0441\u043D\u0435\u0433\u043E\u043F\u0430\u0434',
        95: '\u0433\u0440\u043E\u0437\u0430',
        96: '\u0433\u0440\u043E\u0437\u0430 \u0441 \u0433\u0440\u0430\u0434\u043E\u043C',
        99: '\u0441\u0438\u043B\u044C\u043D\u0430\u044F \u0433\u0440\u043E\u0437\u0430 \u0441 \u0433\u0440\u0430\u0434\u043E\u043C'
    }
};
