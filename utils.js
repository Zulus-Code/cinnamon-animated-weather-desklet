/* utils.js — Pure utility functions for weather-animated@zulus */

/* Map WMO weather code → pseudo-OWM id for particle/color/emoji compatibility */
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

/* Parse "2026-06-07T12:00" as local-time Date */
function _parseLocalDate(str) {
    let parts = str.split('T');
    let dateParts = parts[0].split('-');
    let timeParts = parts[1].split(':');
    return new Date(
        parseInt(dateParts[0], 10),
        parseInt(dateParts[1], 10) - 1,
        parseInt(dateParts[2], 10),
        parseInt(timeParts[0], 10),
        parseInt(timeParts[1], 10)
    );
}

/* Get minutes-since-midnight from an ISO local time string */
function _getMinutes(str) {
    let timePart = str.split('T')[1]; // "HH:MM"
    let parts = timePart.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/* Convert hex color → [r, g, b] in 0–1 range */
function _hexToRgba(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
}

var wmoToOwmId = wmoToOwmId;
var _parseLocalDate = _parseLocalDate;
var _getMinutes = _getMinutes;
var _hexToRgba = _hexToRgba;
