/**
 * @file utils.js — Pure utility functions for weather-animated@zulus
 * @module utils
 */

/**
 * Map WMO weather code to pseudo-OWM id for particle/color/emoji compatibility.
 * @param {number} code - WMO weather code (0-99)
 * @returns {number} OWM-style weather ID
 */
function wmoToOwmId(code) {
    if (code <= 1) return 800;                // clear
    if (code === 2) return 801;               // partly cloudy
    if (code === 3) return 802;               // overcast
    if (code === 45 || code === 48) return 701; // fog
    if (code >= 51 && code <= 57) return 301; // drizzle
    if (code >= 61 && code <= 65) return code >= 65 ? 502 : 501; // rain
    if (code === 66 || code === 67) return 511; // freezing rain
    if (code >= 71 && code <= 77) return code >= 75 ? 602 : 601; // snow
    if (code >= 80 && code <= 82) return code === 82 ? 502 : 501; // rain showers
    if (code >= 85 && code <= 86) return code === 86 ? 602 : 601; // snow showers
    if (code >= 95 && code <= 99) return code === 95 ? 201 : 202; // thunderstorm
    return 800;
}

/**
 * Parse "2026-06-07T12:00" as local-time Date.
 * @param {string} str - ISO local time string
 * @returns {Date} Parsed Date object
 */
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

/**
 * Get minutes-since-midnight from an ISO local time string.
 * @param {string} str - ISO local time string (e.g. "2026-06-07T12:00")
 * @returns {number} Minutes since midnight
 */
function _getMinutes(str) {
    const timePart = str.split('T')[1]; // "HH:MM"
    const parts = timePart.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * Convert hex color to [r, g, b] in 0–1 range.
 * @param {string} hex - Hex color string (e.g. "#4facfe")
 * @returns {number[]} RGB components in 0–1 range [r, g, b]
 */
function _hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
}

/**
 * Get day name for a date (short, locale-aware).
 * @param {Date} date - Date object
 * @param {string} [lang] - Language code (e.g. 'en', 'ru')
 * @returns {string} Short day name
 */
function _dayName(date, lang) {
    try {
        return date.toLocaleDateString(lang || 'en', { weekday: 'short' });
    } catch (e) {
        const days = lang === 'ru' ? ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
            : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getDay()] || '';
    }
}

// eslint-disable-next-line no-var
var wmoToOwmId = wmoToOwmId;
// eslint-disable-next-line no-var
var _parseLocalDate = _parseLocalDate;
// eslint-disable-next-line no-var
var _getMinutes = _getMinutes;
// eslint-disable-next-line no-var
var _dayName = _dayName;
// eslint-disable-next-line no-var
var _hexToRgba = _hexToRgba;
