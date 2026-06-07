/* renderer.js — Cairo/Pango renderer for weather-animated@zulus */

const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const Cairo = imports.cairo;

// Sibling modules are loaded via searchPath (set up in desklet.js)
const Constants = imports.constants;

function Renderer(desklet) {
    this._d = desklet;
}

/* ── Theme-based text colours (repeated across draw methods) ────────────── */
Renderer.prototype._themeColors = function () {
    let d = this._d;
    let t = d.theme || 'auto';
    let isDark = (t === 'dark') || (t === 'auto' && d._isNight());
    return {
        isDark: isDark,
        text: isDark ? [0.878, 0.910, 1.000] : [1, 1, 1],
        dim:  isDark ? [0.533, 0.600, 0.800] : [1, 1, 1],
        faint:isDark ? [0.333, 0.400, 0.533] : [1, 1, 1],
        err:  isDark ? [1.000, 0.588, 0.588] : [1, 0.8, 0.8]
    };
};

/* ── Convenience: draw centred Pango text at x baseline ────────────────── */
Renderer.prototype._cpango = function (cr, txt, cx, y, sz, bold) {
    this._drawPango(cr, txt, cx - this._pangoWidth(cr, txt, sz, bold) / 2, y, sz, bold);
};

/* ── Main draw entry point ──────────────────────────────────────────────── */
Renderer.prototype.draw = function (area) {
    let cr = area.get_context();
    let d = this._d;
    let w = d._width, h = d._height;
    if (w < 50 || h < 50) return;

    cr.setSourceRGBA(0, 0, 0, 0);
    cr.paint();

    if (d.showBackground !== false) {
        this._drawSky(cr, w, h);
        this._drawGlassPanel(cr, w, h);
    }
    if (d._particleSystem) d._particleSystem.draw(cr);

    if (d._loading) this._drawLoading(cr, w, h);
    else if (d._error) this._drawError(cr, w, h, d._error);
    else if (d._weather) {
        this._drawWeather(cr, w);
        if (d.showForecast && d._forecast) this._drawForecast(cr, w);
    }
};

/* ── Sky gradient ────────────────────────────────────────────────────────── */
Renderer.prototype._drawSky = function (cr, w, h) {
    let d = this._d;
    let wid = d._weather ? d._weather.weather[0].id : 800;
    let night = d._isNight();
    let c;
    if (wid >= 200 && wid < 300) c = Constants.COLORS.sky.stormy;
    else if (wid >= 300 && wid < 600) c = night ? Constants.COLORS.sky.rainy_night : Constants.COLORS.sky.rainy_day;
    else if (wid >= 600 && wid < 700) c = night ? Constants.COLORS.sky.snowy_night : Constants.COLORS.sky.snowy_day;
    else if (wid >= 700 && wid < 800) c = Constants.COLORS.sky.foggy;
    else if (wid === 800) c = night ? Constants.COLORS.sky.clear_night : Constants.COLORS.sky.clear_day;
    else if (wid >= 801 && wid < 804) c = night ? Constants.COLORS.sky.cloudy_night : Constants.COLORS.sky.cloudy_day;
    else c = night ? Constants.COLORS.sky.stormy : Constants.COLORS.sky.cloudy_day;

    let pat = new Cairo.LinearGradient(0, 0, 0, h);
    let c1 = this._hexToRgba(c[0]), c2 = this._hexToRgba(c[1]);
    pat.addColorStopRGBA(0, c1[0], c1[1], c1[2], 1);
    pat.addColorStopRGBA(1, c2[0], c2[1], c2[2], 1);
    cr.setSource(pat);
    cr.rectangle(0, 0, w, h);
    cr.fill();

    if (wid === 800) {
        let glowY = night ? 30 : h * 0.15;
        let r = night ? 15 : Math.min(w, h) * 0.5;
        let glow = new Cairo.RadialGradient(w * 0.5, glowY, 0, w * 0.5, glowY, r);
        if (night) {
            glow.addColorStopRGBA(0, 0.3, 0.4, 0.8, 0.3);
            glow.addColorStopRGBA(1, 0.3, 0.4, 0.8, 0);
        } else {
            glow.addColorStopRGBA(0, 1, 0.9, 0.6, 0.4);
            glow.addColorStopRGBA(1, 1, 0.9, 0.6, 0);
        }
        cr.setSource(glow);
        cr.rectangle(0, 0, w, h);
        cr.fill();
    }
};

/* ── Frosted glass panel ─────────────────────────────────────────────────── */
Renderer.prototype._drawGlassPanel = function (cr, w, h) {
    let d = this._d;
    let isDark = this._themeColors().isDark;
    let o = (d.opacity || 70) / 100, pad = 20, r = 20;
    let pH = h - pad * 2, pY = pad;

    cr.setSourceRGBA(0, 0, 0, 0.2 * o);
    this._roundRect(cr, pad + 2, pY + 2, w - pad * 2 - 4, pH - 4, r);
    cr.fill();

    cr.setSourceRGBA(isDark ? 0.039 : 1, isDark ? 0.039 : 1, isDark ? 0.118 : 1, (isDark ? 0.75 : 0.12) * o);
    this._roundRect(cr, pad, pY, w - pad * 2, pH, r);
    cr.fill();

    cr.setLineWidth(1.5);
    cr.setSourceRGBA(isDark ? 0.392 : 1, isDark ? 0.549 : 1, isDark ? 1 : 1, (isDark ? 0.15 : 0.25) * o);
    this._roundRect(cr, pad, pY, w - pad * 2, pH, r);
    cr.stroke();

    if (!isDark) {
        cr.setSourceRGBA(1, 1, 1, 0.06 * o);
        this._roundRect(cr, pad, pY, w - pad * 2, pH * 0.15, r);
        cr.fill();
    }
};

/* ── Current weather display ─────────────────────────────────────────────── */
Renderer.prototype._drawWeather = function (cr, w) {
    let d = this._d;
    let tc = this._themeColors();
    let wd = d._weather, m = wd.weather[0];
    let temp = Math.round(wd.main.temp), feels = Math.round(wd.main.feels_like);
    let hum = Math.round(wd.main.humidity), wind = Math.round(wd.wind.speed);
    let unit = d.units === 'metric' ? '°C' : '°F';
    let cx = w / 2, topY = 45;

    cr.setSourceRGBA(1, 1, 1, 1);
    let emoji = this._iconToEmoji(m.icon, m.id);
    this._cpango(cr, emoji, cx, topY + 20, 56, false);

    cr.setSourceRGBA(tc.text[0], tc.text[1], tc.text[2], 1);
    this._cpango(cr, temp + unit, cx, topY + 90, 54, true);

    cr.setSourceRGBA(tc.dim[0], tc.dim[1], tc.dim[2], 0.9);
    let desc = m.description.charAt(0).toUpperCase() + m.description.slice(1);
    this._cpango(cr, desc, cx, topY + 118, 16, false);

    cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.7);
    this._cpango(cr, this._('feels_like') + ' ' + feels + unit, cx, topY + 140, 13, false);

    let detailY = topY + 175, detailW = Math.min(w - 80, 300), sX = cx - detailW / 2, cW = detailW / 3;
    let vals = [hum + '%', wind + ' ' + this._('wind_unit'), wd.main.pressure + ' ' + this._('pressure_unit')];
    let lbls = [this._('humidity'), this._('wind'), this._('pressure')];
    for (let i = 0; i < 3; i++) {
        let ix = sX + cW * i + cW / 2;
        cr.setSourceRGBA(tc.text[0], tc.text[1], tc.text[2], 0.95);
        this._cpango(cr, vals[i], ix, detailY + 19, 18, true);
        cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.6);
        this._cpango(cr, lbls[i], ix, detailY + 37, 10, false);
    }
    cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.6);
    this._cpango(cr, wd.name + ', ' + (wd.sys.country || ''), cx, topY + 230, 13, false);
};

/* ── Forecast display ────────────────────────────────────────────────────── */
Renderer.prototype._drawForecast = function (cr, w) {
    let d = this._d;
    if (!d._forecast || !d._forecast.list) return;
    let tc = this._themeColors();
    let fY = 300, pad = 30, fw = w - pad * 2;
    let maxSlots = Math.min(d.forecastHours / 3 || 6, 8), step = fw / maxSlots;

    cr.save();
    cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.15);
    cr.setLineWidth(1);
    cr.moveTo(pad + 5, fY - 5);
    cr.lineTo(w - pad - 5, fY - 5);
    cr.stroke();
    cr.setSourceRGBA(tc.faint[0], tc.faint[1], tc.faint[2], 0.5);
    this._drawPango(cr, this._('forecast'), pad + 5, fY - 10, 10, false);

    let list = d._forecast.list.slice(0, maxSlots);
    for (let i = 0; i < list.length; i++) {
        let fx = pad + step * i + step / 2, item = list[i];
        let dt = new Date(item.dt * 1000);
        let time = dt.getHours().toString().padStart(2, '0') + ':' + dt.getMinutes().toString().padStart(2, '0');

        cr.setSourceRGBA(tc.dim[0], tc.dim[1], tc.dim[2], 0.7);
        this._cpango(cr, time, fx, fY + 10, 10, false);
        cr.setSourceRGBA(1, 1, 1, 0.9);
        this._cpango(cr, this._iconToEmoji(item.weather[0].icon, item.weather[0].id), fx, fY + 40, 20, false);
        cr.setSourceRGBA(tc.text[0], tc.text[1], tc.text[2], 0.95);
        this._cpango(cr, Math.round(item.main.temp) + (d.units === 'metric' ? '°' : '°F'), fx, fY + 65, 13, true);
    }
    cr.restore();
};

/* ── Loading state ───────────────────────────────────────────────────────── */
Renderer.prototype._drawLoading = function (cr, w, h) {
    let tc = this._themeColors();
    cr.setSourceRGBA(tc.text[0], tc.text[1], tc.text[2], 0.7);
    this._cpango(cr, this._('loading'), w / 2, h / 2, 18, false);
};

/* ── Error state ─────────────────────────────────────────────────────────── */
Renderer.prototype._drawError = function (cr, w, h, errInfo) {
    let tc = this._themeColors();
    cr.setSourceRGBA(tc.err[0], tc.err[1], tc.err[2], 0.8);

    let errMsg = '';
    if (typeof errInfo === 'string') errMsg = errInfo;
    else if (errInfo && errInfo.key) errMsg = errInfo.detail !== undefined
        ? this._(errInfo.key) + ': ' + errInfo.detail : this._(errInfo.key);

    let lines = errMsg.split('\n');
    let ly = h / 2 - lines.length * 10;
    for (let li = 0; li < lines.length; li++) {
        let line = lines[li];
        if (this._pangoWidth(cr, line, 14, false) > w - 60) {
            while (this._pangoWidth(cr, line + '...', 14, false) > w - 60 && line.length > 3)
                line = line.slice(0, -1);
            line += '...';
        }
        this._cpango(cr, line, w / 2, ly, 14, false);
        ly += 22;
    }
};

/* ── Pango text rendering ────────────────────────────────────────────────── */
Renderer.prototype._drawPango = function (cr, text, x, y, size, bold) {
    let layout = PangoCairo.create_layout(cr);
    layout.set_text(text, -1);
    let fd = Pango.FontDescription.from_string('Ubuntu, Sans ' + size);
    if (bold) fd.set_weight(Pango.Weight.BOLD);
    layout.set_font_description(fd);
    cr.moveTo(x, y - layout.get_baseline() / Pango.SCALE);
    PangoCairo.show_layout(cr, layout);
};

/* ── Text width measurement ──────────────────────────────────────────────── */
Renderer.prototype._pangoWidth = function (cr, text, size, bold) {
    try {
        let layout = PangoCairo.create_layout(cr);
        layout.set_text(text, -1);
        let fd = Pango.FontDescription.from_string('Ubuntu, Sans ' + size);
        if (bold) fd.set_weight(Pango.Weight.BOLD);
        layout.set_font_description(fd);
        return layout.get_pixel_size()[0];
    } catch (e) {
        return text.length * 9;
    }
};

/* ── Rounded rectangle path ──────────────────────────────────────────────── */
Renderer.prototype._roundRect = function (cr, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    cr.moveTo(x + r, y);
    cr.lineTo(x + w - r, y);
    cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    cr.lineTo(x + w, y + h - r);
    cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    cr.lineTo(x + r, y + h);
    cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    cr.lineTo(x, y + r);
    cr.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
    cr.closePath();
};

/* ── Icon code → emoji ───────────────────────────────────────────────────── */
Renderer.prototype._iconToEmoji = function (icon, id) {
    if (!icon) return '☀️';
    let n = icon.endsWith('n');
    if (id >= 200 && id < 300) return '⛈️';
    if (id >= 300 && id < 400) return '🌦️';
    if (id >= 500 && id < 511) return '🌧️';
    if (id >= 511 && id < 600) return '🌨️';
    if (id >= 600 && id < 700) return '❄️';
    if (id >= 701 && id < 800) return '🌫️';
    if (id === 800) return n ? '🌙' : '☀️';
    if (id === 801) return n ? '🌙☁️' : '🌤️';
    if (id === 802) return n ? '☁️🌙' : '⛅';
    if (id >= 803) return '☁️';
    return '🌤️';
};

/* ── Localised string lookup ─────────────────────────────────────────────── */
Renderer.prototype._ = function (key) {
    let lang = this._d.language || 'en';
    let dict = Constants.STRINGS[lang] || Constants.STRINGS.en;
    return dict[key] !== undefined ? dict[key] : Constants.STRINGS.en[key] || key;
};

/* ── Hex → RGBA helper ───────────────────────────────────────────────────── */
Renderer.prototype._hexToRgba = function (hex) {
    return [
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255
    ];
};

var Renderer = Renderer;
