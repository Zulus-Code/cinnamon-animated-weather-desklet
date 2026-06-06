/* weather-animated@zulus - desklet.js
 * Animated real-time weather desklet for Cinnamon (Linux Mint)
 */

const Desklet = imports.ui.desklet;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Soup = imports.gi.Soup;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Cairo = imports.cairo;
const ByteArray = imports.byteArray;

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
        no_api_key:        "No API key configured.\nGet one free at openweathermap.org/api",
        check_key_short:   'Check API key in desklet settings',
        check_key_long:    'Check API key in desklet settings \u2192 right click, Configure',
        unknown_api_err:   'Unknown API error',
        parse_err:         'Parse error',
        api_err:           'Weather API error',
        http_err:          'HTTP error (exit',
        failed_req:        'Failed to create request',
        http_prefix:       'HTTP',
        no_soup:           'No Soup async method available',
        wind_unit:         'km/h',
        pressure_unit:     'hPa',
    },
    ru: {
        feels_like:        '\u041E\u0449\u0443\u0449\u0430\u0435\u0442\u0441\u044F \u043A\u0430\u043A',
        humidity:          '\u0412\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u044C',
        wind:              '\u0412\u0435\u0442\u0435\u0440',
        pressure:          '\u0414\u0430\u0432\u043B\u0435\u043D\u0438\u0435',
        forecast:          '\u041F\u0440\u043E\u0433\u043D\u043E\u0437',
        loading:           '\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043F\u043E\u0433\u043E\u0434\u044B...',
        no_api_key:        'API \u043A\u043B\u044E\u0447 \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D.\n\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u0435 \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E \u043D\u0430 openweathermap.org/api',
        check_key_short:   '\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 API \u043A\u043B\u044E\u0447 \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445',
        check_key_long:    '\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 API \u043A\u043B\u044E\u0447 \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u2192 \u041F\u041A\u041C, Configure',
        unknown_api_err:   '\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 API',
        parse_err:         '\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0430\u0440\u0441\u0438\u043D\u0433\u0430',
        api_err:           '\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u043E\u0433\u043E\u0434\u043D\u043E\u0433\u043E API',
        http_err:          '\u041E\u0448\u0438\u0431\u043A\u0430 HTTP (\u043A\u043E\u0434',
        failed_req:        '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441',
        http_prefix:       'HTTP',
        no_soup:           '\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0433\u043E \u043C\u0435\u0442\u043E\u0434\u0430 Soup async',
        wind_unit:         '\u043C/\u0441',
        pressure_unit:     '\u0433\u041F\u0430',
    }
};

function Particle(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.vx = 0;
    this.vy = 0;
    this.size = 0;
    this.alpha = 1;
    this.life = 1;
    this.maxLife = 1;
    this.speed = 0;
    this.wobble = 0;
    this.wobbleSpeed = 0;
    this.wobbleOffset = 0;
    this._init(type);
}

Particle.prototype._init = function(type) {
    switch (type) {
        case 'rain':
            this.size = Math.random() * 2 + 1.5;
            this.speed = 300 + Math.random() * 400;
            this.vy = this.speed;
            this.vx = -20 - Math.random() * 30;
            this.alpha = 0.4 + Math.random() * 0.5;
            break;
        case 'snow':
            this.size = Math.random() * 4 + 2;
            this.speed = 40 + Math.random() * 60;
            this.vy = this.speed;
            this.wobble = Math.random() * 30 + 10;
            this.wobbleSpeed = 1 + Math.random() * 2;
            this.wobbleOffset = Math.random() * Math.PI * 2;
            this.alpha = 0.6 + Math.random() * 0.4;
            break;
        case 'cloud':
            this.size = 40 + Math.random() * 80;
            this.vx = -5 - Math.random() * 10;
            this.alpha = 0.15 + Math.random() * 0.2;
            break;
        case 'star':
            this.size = 1 + Math.random() * 2;
            this.maxLife = 40 + Math.random() * 80;
            this.life = Math.random() * this.maxLife;
            this.alpha = 0.3 + Math.random() * 0.7;
            this.wobble = Math.random() * 0.002;
            break;
        case 'sparkle':
            this.size = 2 + Math.random() * 4;
            this.maxLife = 20 + Math.random() * 30;
            this.life = Math.random() * this.maxLife;
            this.vx = (Math.random() - 0.5) * 20;
            this.vy = -30 - Math.random() * 40;
            this.alpha = 1;
            break;
    }
};

class AnimatedWeatherDesklet extends Desklet.Desklet {
    constructor(metadata, desklet_id) {
        super(metadata, desklet_id);
        this._desklet_id = desklet_id;
        this._uuid = metadata.uuid;

        this._weather = null;
        this._forecast = null;
        this._animating = false;
        this._animationId = 0;
        this._weatherTimerId = 0;
        this._particles = [];
        this._width = 350;
        this._height = 400;
        this._time = 0;
        this._error = null;
        this._loading = true;

        this._httpSession = null;
        try {
            this._httpSession = new Soup.Session();
            this._httpSession.timeout = 10;
        } catch (e) {
            this._httpSession = null;
        }

        this.settings = new Settings.DeskletSettings(this, this._uuid, desklet_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'api-key', 'apiKey', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'location', 'location', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'units', 'units', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'refresh-interval', 'refreshInterval', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'theme', 'theme', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'show-forecast', 'showForecast', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'forecast-hours', 'forecastHours', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'opacity', 'opacity', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'width', 'width', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'language', 'language', this._onSettingsChanged.bind(this));

        this._buildUI();
        this._onSettingsChanged();
        this._refreshWeather();
        this._startAnimation();
    }

    _buildUI() {
        this.setHeader('');
        this._drawArea = new St.DrawingArea({
            reactive: true,
            width: this._width || 350,
            height: this._height || 400
        });
        this._drawArea.connect('repaint', Lang.bind(this, this._draw));
        this.setContent(this._drawArea);
    }

    on_desklet_view_geometry_changed() {
        let [w, h] = this.actor.get_size();
        if (w > 50 && h > 50) {
            this._width = w;
            this._height = h;
            this._drawArea.set_size(this._width, this._height);
            this._initParticles();
        }
    }

    _onSettingsChanged() {
        if (this._width !== this.width) {
            this._width = Math.max(200, Math.min(600, this.width));
            this._drawArea.set_size(this._width, this._height);
        }

        if (this._weatherTimerId) {
            Mainloop.source_remove(this._weatherTimerId);
            this._weatherTimerId = 0;
        }

        let intervalMs = Math.max(2, Math.min(60, this.refreshInterval || 10)) * 60 * 1000;
        this._weatherTimerId = Mainloop.timeout_add(intervalMs, Lang.bind(this, function() {
            this._refreshWeather();
            return true;
        }));

        this._initParticles();
    }

    _initParticles() {
        this._particles = [];
        let weatherId = this._weather ? this._weather.weather[0].id : 800;
        let isNight = this._isNight();

        if (weatherId >= 200 && weatherId < 300) {
            for (let i = 0; i < 200; i++) this._particles.push(new Particle(Math.random() * this._width, Math.random() * this._height, 'rain'));
        } else if (weatherId >= 300 && weatherId < 400) {
            for (let i = 0; i < 80; i++) this._particles.push(new Particle(Math.random() * this._width, Math.random() * this._height, 'rain'));
        } else if (weatherId >= 500 && weatherId < 600) {
            let count = weatherId >= 502 ? 180 : 100;
            for (let i = 0; i < count; i++) this._particles.push(new Particle(Math.random() * this._width, Math.random() * this._height, 'rain'));
        } else if (weatherId >= 600 && weatherId < 700) {
            for (let i = 0; i < 120; i++) this._particles.push(new Particle(Math.random() * this._width, Math.random() * this._height, 'snow'));
        } else if (weatherId === 800 && isNight) {
            for (let i = 0; i < 80; i++) this._particles.push(new Particle(Math.random() * this._width, Math.random() * this._height * 0.7, 'star'));
        } else if (weatherId === 800) {
            for (let i = 0; i < 15; i++) this._particles.push(new Particle(Math.random() * this._width, this._height * 0.3 + Math.random() * this._height * 0.4, 'sparkle'));
        } else if (weatherId >= 801 && weatherId < 900) {
            for (let i = 0; i < 4; i++) this._particles.push(new Particle(Math.random() * this._width, Math.random() * this._height * 0.5, 'cloud'));
            if (weatherId >= 803) {
                for (let i = 0; i < 20; i++) this._particles.push(new Particle(Math.random() * this._width, Math.random() * this._height, 'rain'));
            }
        } else if (weatherId >= 700 && weatherId < 800) {
            for (let i = 0; i < 6; i++) this._particles.push(new Particle(Math.random() * this._width, Math.random() * this._height * 0.6, 'cloud'));
        }
    }

    _updateParticles(dt) {
        let w = this._width;
        let h = this._height;

        for (let i = this._particles.length - 1; i >= 0; i--) {
            let p = this._particles[i];

            switch (p.type) {
                case 'rain':
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    if (p.y >= h + 10) {
                        p.y = -10;
                        p.x = Math.random() * w;
                    }
                    if (p.x < -20) p.x = w + 20;
                    break;

                case 'snow':
                    p.wobbleOffset += p.wobbleSpeed * dt;
                    p.x += p.vx * dt + Math.sin(p.wobbleOffset) * p.wobble * dt;
                    p.y += p.vy * dt;
                    if (p.y >= h + 5) {
                        p.y = -5;
                        p.x = Math.random() * w;
                        p.wobbleOffset = Math.random() * Math.PI * 2;
                    }
                    if (p.x < -20) p.x = w + 20;
                    if (p.x > w + 20) p.x = -20;
                    break;

                case 'cloud':
                    p.x += p.vx * dt;
                    if (p.x + p.size < -50) {
                        p.x = w + Math.random() * 100;
                        p.y = Math.random() * h * 0.5;
                    }
                    break;

                case 'star':
                    p.life -= 1;
                    if (p.life <= 0) {
                        p.life = p.maxLife;
                        p.alpha = 0.3 + Math.random() * 0.7;
                    }
                    p.alpha += (Math.sin(this._time * p.wobble + p.wobbleOffset) * 0.002);
                    p.alpha = Math.max(0.2, Math.min(1, p.alpha));
                    break;

                case 'sparkle':
                    p.life -= 1;
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    p.alpha = p.life / p.maxLife;
                    if (p.life <= 0) {
                        p.life = p.maxLife;
                        p.y = h * 0.3 + Math.random() * h * 0.4;
                        p.x = Math.random() * w;
                        p.vx = (Math.random() - 0.5) * 20;
                        p.vy = -30 - Math.random() * 40;
                    }
                    break;
            }
        }
    }

    _draw(area) {
        let cr = area.get_context();
        let w = this._width;
        let h = this._height;
        if (w < 50 || h < 50) return;

        cr.setSourceRGBA(0, 0, 0, 0);
        cr.paint();

        this._drawSky(cr, w, h);
        this._drawParticles(cr, w, h);
        this._drawGlassPanel(cr, w, h);

        if (this._loading) {
            this._drawLoading(cr, w, h);
        } else if (this._error) {
            this._drawError(cr, w, h, this._error);
        } else if (this._weather) {
            this._drawWeather(cr, w, h);
            if (this.showForecast && this._forecast) {
                this._drawForecast(cr, w, h);
            }
        }
    }

    _drawSky(cr, w, h) {
        let weatherId = this._weather ? this._weather.weather[0].id : 800;
        let isNight = this._isNight();
        let colors;

        if (weatherId >= 200 && weatherId < 300) colors = COLORS.sky.stormy;
        else if (weatherId >= 300 && weatherId < 600) colors = isNight ? COLORS.sky.rainy_night : COLORS.sky.rainy_day;
        else if (weatherId >= 600 && weatherId < 700) colors = isNight ? COLORS.sky.snowy_night : COLORS.sky.snowy_day;
        else if (weatherId >= 700 && weatherId < 800) colors = COLORS.sky.foggy;
        else if (weatherId === 800) colors = isNight ? COLORS.sky.clear_night : COLORS.sky.clear_day;
        else if (weatherId >= 801 && weatherId < 804) colors = isNight ? COLORS.sky.cloudy_night : COLORS.sky.cloudy_day;
        else colors = isNight ? COLORS.sky.stormy : COLORS.sky.cloudy_day;

        let pat = cr.createLinearGradient(0, 0, 0, h);
        let c1 = this._hexToRgba(colors[0]);
        let c2 = this._hexToRgba(colors[1]);
        pat.addColorStopRGBA(0, c1[0], c1[1], c1[2], 1);
        pat.addColorStopRGBA(1, c2[0], c2[1], c2[2], 1);
        cr.setSource(pat);
        cr.rectangle(0, 0, w, h);
        cr.fill();

        if (weatherId === 800) {
            let glowY = isNight ? 30 : h * 0.15;
            let r = isNight ? 15 : Math.min(w, h) * 0.5;
            let glow = cr.createRadialGradient(w * 0.5, glowY, 0, w * 0.5, glowY, r);
            if (isNight) {
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
    }

    _drawParticles(cr) {
        for (let i = 0; i < this._particles.length; i++) {
            let p = this._particles[i];
            cr.save();
            switch (p.type) {
                case 'rain':
                    cr.setSourceRGBA(0.7, 0.8, 1, p.alpha * 0.6);
                    cr.setLineWidth(p.size * 0.5);
                    cr.moveTo(p.x, p.y);
                    cr.lineTo(p.x + p.vx * 0.03, p.y + p.vy * 0.03);
                    cr.stroke();
                    break;
                case 'snow':
                    cr.setSourceRGBA(1, 1, 1, p.alpha);
                    cr.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
                    cr.fill();
                    break;
                case 'cloud':
                    cr.setSourceRGBA(1, 1, 1, p.alpha * 0.5);
                    cr.arc(p.x, p.y, p.size * 0.3, 0, Math.PI * 2);
                    cr.arc(p.x + p.size * 0.3, p.y - p.size * 0.1, p.size * 0.25, 0, Math.PI * 2);
                    cr.arc(p.x + p.size * 0.5, p.y + p.size * 0.05, p.size * 0.2, 0, Math.PI * 2);
                    cr.fill();
                    break;
                case 'star': {
                    cr.setSourceRGBA(1, 1, 1, p.alpha);
                    let twinkle = 0.5 + 0.5 * Math.sin(this._time * 3 + p.wobbleOffset * 10);
                    let s = p.size * (0.5 + twinkle * 0.5);
                    cr.arc(p.x, p.y, s, 0, Math.PI * 2);
                    cr.fill();
                    cr.setLineWidth(0.5);
                    cr.setSourceRGBA(1, 1, 1, p.alpha * 0.3);
                    cr.moveTo(p.x - s * 3, p.y);
                    cr.lineTo(p.x + s * 3, p.y);
                    cr.moveTo(p.x, p.y - s * 3);
                    cr.lineTo(p.x, p.y + s * 3);
                    cr.stroke();
                    break;
                }
                case 'sparkle':
                    cr.setSourceRGBA(1, 1, 0.8, p.alpha * 0.8);
                    cr.arc(p.x, p.y, p.size * 0.5 * p.alpha, 0, Math.PI * 2);
                    cr.fill();
                    break;
            }
            cr.restore();
        }
    }

    _drawGlassPanel(cr, w, h) {
        let t = this.theme || 'auto';
        let isDark = (t === 'dark') || (t === 'auto' && this._isNight());
        let o = (this.opacity || 70) / 100;

        let pad = 20;
        let panelH = h - pad * 2;
        let panelY = pad;
        let radius = 20;

        cr.setSourceRGBA(0, 0, 0, 0.2 * o);
        this._roundRect(cr, pad + 2, panelY + 2, w - pad * 2 - 4, panelH - 4, radius);
        cr.fill();

        if (isDark) {
            cr.setSourceRGBA(10 / 255, 10 / 255, 30 / 255, 0.75 * o);
        } else {
            cr.setSourceRGBA(1, 1, 1, 0.12 * o);
        }
        this._roundRect(cr, pad, panelY, w - pad * 2, panelH, radius);
        cr.fill();

        cr.setLineWidth(1.5);
        if (isDark) {
            cr.setSourceRGBA(100 / 255, 140 / 255, 1, 0.15 * o);
        } else {
            cr.setSourceRGBA(1, 1, 1, 0.25 * o);
        }
        this._roundRect(cr, pad, panelY, w - pad * 2, panelH, radius);
        cr.stroke();

        if (!isDark) {
            cr.setSourceRGBA(1, 1, 1, 0.06 * o);
            this._roundRect(cr, pad, panelY, w - pad * 2, panelH * 0.15, radius);
            cr.fill();
        }
    }

    _drawWeather(cr, w) {
        let t = this.theme || 'auto';
        let isDark = (t === 'dark') || (t === 'auto' && this._isNight());
        let textColor = isDark ? [224 / 255, 232 / 255, 1] : [1, 1, 1];
        let dimColor = isDark ? [136 / 255, 153 / 255, 204 / 255] : [1, 1, 1];
        let faintColor = isDark ? [85 / 255, 102 / 255, 136 / 255] : [1, 1, 1];

        let wData = this._weather;
        let main = wData.weather[0];
        let temp = Math.round(wData.main.temp);
        let feels = Math.round(wData.main.feels_like);
        let hum = wData.main.humidity;
        let wind = Math.round(wData.wind.speed);
        let desc = main.description;
        let icon = main.icon;

        let emoji = this._iconToEmoji(icon, main.id);

        let cx = w / 2;
        let topY = 45;
        let unit = this.units === 'metric' ? '°C' : '°F';

        cr.setFontSize(56);
        cr.setSourceRGBA(1, 1, 1, 1);
        cr.moveTo(cx - 28, topY + 20);
        cr.showText(emoji);

        cr.setFontSize(54);
        cr.selectFontFace('Ubuntu, Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        cr.setSourceRGBA(textColor[0], textColor[1], textColor[2], 1);
        let tempStr = temp + unit;
        cr.moveTo(cx - this._textWidth(cr, tempStr) / 2, topY + 90);
        cr.showText(tempStr);

        cr.setFontSize(16);
        cr.selectFontFace('Ubuntu, Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
        cr.setSourceRGBA(dimColor[0], dimColor[1], dimColor[2], 0.9);
        let descStr = desc.charAt(0).toUpperCase() + desc.slice(1);
        cr.moveTo(cx - this._textWidth(cr, descStr) / 2, topY + 118);
        cr.showText(descStr);

        cr.setFontSize(13);
        cr.setSourceRGBA(faintColor[0], faintColor[1], faintColor[2], 0.7);
        let feelsStr = this._('feels_like') + ' ' + feels + unit;
        cr.moveTo(cx - this._textWidth(cr, feelsStr) / 2, topY + 140);
        cr.showText(feelsStr);

        let detailY = topY + 175;
        let detailW = Math.min(w - 80, 300);
        let startX = cx - detailW / 2;
        let colW = detailW / 3;

        let icons = ['💧', '💨', '🌡️'];
        let vals = [hum + '%', wind + ' ' + this._('wind_unit'), wData.main.pressure + ' ' + this._('pressure_unit')];
        let lbls = [this._('humidity'), this._('wind'), this._('pressure')];

        cr.setFontSize(20);
        for (let i = 0; i < 3; i++) {
            let ix = startX + colW * i + colW / 2;
            cr.selectFontFace('Ubuntu, Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
            cr.setSourceRGBA(dimColor[0], dimColor[1], dimColor[2], 0.8);
            cr.moveTo(ix - this._textWidth(cr, icons[i]) / 2, detailY);
            cr.showText(icons[i]);

            cr.setFontSize(15);
            cr.selectFontFace('Ubuntu, Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
            cr.setSourceRGBA(textColor[0], textColor[1], textColor[2], 0.95);
            cr.moveTo(ix - this._textWidth(cr, vals[i]) / 2, detailY + 22);
            cr.showText(vals[i]);

            cr.setFontSize(10);
            cr.selectFontFace('Ubuntu, Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
            cr.setSourceRGBA(faintColor[0], faintColor[1], faintColor[2], 0.6);
            cr.moveTo(ix - this._textWidth(cr, lbls[i]) / 2, detailY + 37);
            cr.showText(lbls[i]);
        }

        cr.setFontSize(13);
        cr.setSourceRGBA(faintColor[0], faintColor[1], faintColor[2], 0.6);
        let cityStr = wData.name + ', ' + (wData.sys.country || '');
        cr.moveTo(cx - this._textWidth(cr, cityStr) / 2, topY + 218);
        cr.showText(cityStr);
    }

    _drawForecast(cr, w) {
        if (!this._forecast || !this._forecast.list) return;

        let t = this.theme || 'auto';
        let isDark = (t === 'dark') || (t === 'auto' && this._isNight());
        let textColor = isDark ? [224 / 255, 232 / 255, 1] : [1, 1, 1];
        let dimColor = isDark ? [136 / 255, 153 / 255, 204 / 255] : [1, 1, 1];
        let faintColor = isDark ? [85 / 255, 102 / 255, 136 / 255] : [1, 1, 1];

        let forecastY = 295;
        let pad = 30;
        let fw = w - pad * 2;
        let maxSlots = Math.min(this.forecastHours / 3 || 6, 8);
        let step = fw / maxSlots;

        cr.save();
        cr.setSourceRGBA(faintColor[0], faintColor[1], faintColor[2], 0.15);
        cr.setLineWidth(1);
        cr.moveTo(pad + 5, forecastY - 5);
        cr.lineTo(w - pad - 5, forecastY - 5);
        cr.stroke();

        cr.setFontSize(10);
        cr.selectFontFace('Ubuntu, Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
        cr.setSourceRGBA(faintColor[0], faintColor[1], faintColor[2], 0.5);
        cr.moveTo(pad + 5, forecastY - 10);
        cr.showText(this._('forecast'));

        let list = this._forecast.list.slice(0, maxSlots);
        for (let i = 0; i < list.length; i++) {
            let fx = pad + step * i + step / 2;
            let item = list[i];

            let dt = new Date(item.dt * 1000);
            let hours = dt.getHours().toString().padStart(2, '0');
            let mins = dt.getMinutes().toString().padStart(2, '0');

            cr.setFontSize(10);
            cr.selectFontFace('Ubuntu, Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
            cr.setSourceRGBA(dimColor[0], dimColor[1], dimColor[2], 0.7);
            let timeStr = hours + ':' + mins;
            cr.moveTo(fx - this._textWidth(cr, timeStr) / 2, forecastY + 10);
            cr.showText(timeStr);

            let emoji = this._iconToEmoji(item.weather[0].icon, item.weather[0].id);
            cr.setFontSize(20);
            cr.selectFontFace('Ubuntu, Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
            cr.setSourceRGBA(1, 1, 1, 0.9);
            cr.moveTo(fx - 10, forecastY + 40);
            cr.showText(emoji);

            let ft = Math.round(item.main.temp);
            let unit = this.units === 'metric' ? '°' : '°F';
            cr.setFontSize(13);
            cr.selectFontFace('Ubuntu, Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
            cr.setSourceRGBA(textColor[0], textColor[1], textColor[2], 0.95);
            let ftStr = ft + unit;
            cr.moveTo(fx - this._textWidth(cr, ftStr) / 2, forecastY + 65);
            cr.showText(ftStr);
        }

        cr.restore();
    }

    _drawLoading(cr, w, h) {
        let t = this.theme || 'auto';
        let isDark = (t === 'dark') || (t === 'auto' && this._isNight());
        let textColor = isDark ? [224 / 255, 232 / 255, 1] : [1, 1, 1];

        cr.setFontSize(18);
        cr.selectFontFace('Ubuntu, Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
        cr.setSourceRGBA(textColor[0], textColor[1], textColor[2], 0.7);
        let msg = this._('loading');
        cr.moveTo(w / 2 - this._textWidth(cr, msg) / 2, h / 2);
        cr.showText(msg);
    }

    _drawError(cr, w, h, errMsg) {
        let t = this.theme || 'auto';
        let isDark = (t === 'dark') || (t === 'auto' && this._isNight());
        let textColor = isDark ? [1, 150 / 255, 150 / 255] : [1, 0.8, 0.8];

        cr.setFontSize(14);
        cr.selectFontFace('Ubuntu, Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
        cr.setSourceRGBA(textColor[0], textColor[1], textColor[2], 0.8);

        let lines = errMsg.split('\n');
        let ly = h / 2 - lines.length * 10;
        for (let li = 0; li < lines.length; li++) {
            let line = lines[li];
            if (this._textWidth(cr, line) > w - 60) {
                while (this._textWidth(cr, line + '...') > w - 60 && line.length > 3)
                    line = line.slice(0, -1);
                line += '...';
            }
            cr.moveTo(w / 2 - this._textWidth(cr, line) / 2, ly);
            cr.showText(line);
            ly += 22;
        }

        cr.setFontSize(11);
        cr.setSourceRGBA(textColor[0], textColor[1], textColor[2], 0.5);
        let tip = this._('check_key_long');
        if (this._textWidth(cr, tip) > w - 60) {
            tip = this._('check_key_short');
        }
        cr.moveTo(w / 2 - this._textWidth(cr, tip) / 2, ly + 15);
        cr.showText(tip);
    }

    _textWidth(cr, text) {
        try {
            let extents = cr.textExtents(text);
            return extents.xAdvance || extents.width || text.length * 9;
        } catch (e) {
            return text.length * 9;
        }
    }

    _roundRect(cr, x, y, w, h, r) {
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
    }

    _hexToRgba(hex) {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;
        return [r, g, b];
    }

    _(key) {
        let lang = this.language || 'en';
        let dict = STRINGS[lang] || STRINGS.en;
        return dict[key] !== undefined ? dict[key] : STRINGS.en[key] || key;
    }

    _iconToEmoji(icon, id) {
        if (!icon) return '🌤️';
        let isNight = icon.endsWith('n');

        if (id >= 200 && id < 300) return '⛈️';
        if (id >= 300 && id < 400) return '🌦️';
        if (id >= 500 && id < 511) return '🌧️';
        if (id >= 511 && id < 600) return '🌨️';
        if (id >= 600 && id < 700) return '❄️';
        if (id >= 701 && id < 800) return '🌫️';
        if (id === 800) return isNight ? '🌙' : '☀️';
        if (id === 801) return isNight ? '🌙☁️' : '🌤️';
        if (id === 802) return isNight ? '☁️🌙' : '⛅';
        if (id >= 803) return '☁️';
        return '🌤️';
    }

    _isNight() {
        if (!this._weather || !this._weather.weather || !this._weather.weather[0]) return false;
        let icon = this._weather.weather[0].icon;
        return icon && icon.endsWith('n');
    }

    _bytesToString(data) {
        if (data === null || data === undefined) return '';
        if (typeof data === 'string') return data;
        try {
            return ByteArray.toString(data);
        } catch (e) {
            return '' + data;
        }
    }

    _httpGet(url, onSuccess, onError) {
        let session = this._httpSession;
        if (!session) {
            try {
                let curlCmd = 'curl -s --connect-timeout 10 --max-time 15 ' + GLib.shell_quote(url);
                let [ok, stdout, stderr, exitStatus] = GLib.spawn_command_line_sync(curlCmd);
                let out = this._bytesToString(stdout);
                if (ok && exitStatus === 0 && out.length > 0) {
                    onSuccess(out);
                } else {
                    if (onError) onError(this._('http_err') + ' ' + exitStatus + ')');
                }
            } catch (e) {
                if (onError) onError(e.toString());
            }
            return;
        }

        let msg;
        try {
            msg = Soup.Message.new('GET', url);
        } catch (e) {
            try {
                msg = new Soup.Message({ method: 'GET', uri: GLib.Uri.parse(url, GLib.UriFlags.NONE) });
            } catch (e2) {
                if (onError) onError(this._('failed_req'));
                return;
            }
        }

        if (typeof session.queue_message === 'function') {
            session.queue_message(msg, Lang.bind(this, function(sess, resp) {
                if (resp.status_code === 200) {
                    onSuccess(this._bytesToString(resp.response_body.data));
                } else {
                    if (onError) onError(this._('http_prefix') + ' ' + resp.status_code);
                }
            }));
            return;
        }

        // libsoup3 path. The previous code used send_async() with incorrect
        // argument order, which made GJS treat callback as a GCancellable.
        if (typeof session.send_and_read_async === 'function') {
            session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, Lang.bind(this, function(sess, result) {
                try {
                    let bytes = sess.send_and_read_finish(result);
                    let data = '';
                    if (bytes && typeof bytes.get_data === 'function') {
                        data = this._bytesToString(bytes.get_data());
                    }
                    onSuccess(data);
                } catch (e) {
                    if (onError) onError(e.toString());
                }
            }));
            return;
        }

        if (typeof session.send_async === 'function') {
            session.send_async(msg, GLib.PRIORITY_DEFAULT, null, Lang.bind(this, function(sess, result) {
                try {
                    let stream = sess.send_finish(result);
                    let dis = new Gio.DataInputStream({ base_stream: stream });
                    let chunks = [];
                    while (true) {
                        let [line] = dis.read_line_utf8(null);
                        if (line === null) break;
                        chunks.push(line);
                    }
                    onSuccess(chunks.join('\n'));
                } catch (e) {
                    if (onError) onError(e.toString());
                }
            }));
            return;
        }

        if (onError) onError(this._('no_soup'));
    }

    _refreshWeather() {
        let key = this.apiKey;
        if (!key || key === '') {
            this._error = this._('no_api_key');
            this._loading = false;
            this._drawArea.queue_repaint();
            return;
        }

        this._loading = true;
        this._error = null;
        this._drawArea.queue_repaint();
        this._resolveLocation(key);
    }

    _resolveLocation(key) {
        let loc = this.location || 'auto';

        if (loc && loc !== 'auto') {
            let url = 'https://api.openweathermap.org/data/2.5/weather?q='
                + GLib.uri_escape_string(loc, null, true)
                + '&appid=' + key + '&units=' + (this.units || 'metric');
            this._fetchWeather(url, key);
        } else {
            let geoUrl = 'http://ip-api.com/json/?fields=city,countryCode&lang=en';
            this._httpGet(
                geoUrl,
                Lang.bind(this, function(data) {
                    try {
                        let json = JSON.parse(data);
                        let city = json.city || '';
                        let country = json.countryCode || '';
                        if (city) {
                            let locStr = city + (country ? ',' + country : '');
                            let url = 'https://api.openweathermap.org/data/2.5/weather?q='
                                + GLib.uri_escape_string(locStr, null, true)
                                + '&appid=' + key + '&units=' + (this.units || 'metric');
                            this._fetchWeather(url, key);
                            return;
                        }
                    } catch (e) {}

                    let url = 'https://api.openweathermap.org/data/2.5/weather?q=Moscow&appid='
                        + key + '&units=' + (this.units || 'metric');
                    this._fetchWeather(url, key);
                }),
                Lang.bind(this, function() {
                    let url = 'https://api.openweathermap.org/data/2.5/weather?q=Moscow&appid='
                        + key + '&units=' + (this.units || 'metric');
                    this._fetchWeather(url, key);
                })
            );
        }
    }

    _fetchWeather(url, key) {
        this._httpGet(
            url,
            Lang.bind(this, function(data) {
                try {
                    this._weather = JSON.parse(data);
                    if (this._weather && this._weather.cod && parseInt(this._weather.cod, 10) !== 200) {
                        let message = this._weather.message || this._('unknown_api_err');
                        this._error = this._('api_err') + ': ' + message;
                        this._loading = false;
                        this._drawArea.queue_repaint();
                        return;
                    }
                    this._loading = false;
                    this._error = null;
                    this._initParticles();
                    this._fetchForecast(key);
                    this._drawArea.queue_repaint();
                } catch (e) {
                    this._error = this._('parse_err') + ': ' + e.toString().slice(0, 60);
                    this._loading = false;
                    this._drawArea.queue_repaint();
                }
            }),
            Lang.bind(this, function(err) {
                this._error = this._('api_err') + ': ' + err;
                this._loading = false;
                this._drawArea.queue_repaint();
            })
        );
    }

    _fetchForecast(key) {
        if (!this._weather) return;
        let lat = this._weather.coord.lat;
        let lon = this._weather.coord.lon;
        let url = 'https://api.openweathermap.org/data/2.5/forecast?lat='
            + lat + '&lon=' + lon + '&appid=' + key
            + '&units=' + (this.units || 'metric') + '&cnt=8';

        this._httpGet(url, Lang.bind(this, function(data) {
            try {
                this._forecast = JSON.parse(data);
            } catch (e) {
                this._forecast = null;
            }
            this._drawArea.queue_repaint();
        }));
    }

    _startAnimation() {
        if (this._animating) return;
        this._animating = true;
        this._lastFrameTime = Date.now();
        this._time = 0;
        this._animationLoop();
    }

    _animationLoop() {
        if (!this._animating) return;

        let now = Date.now();
        let dt = (now - this._lastFrameTime) / 1000;
        this._lastFrameTime = now;
        this._time += dt;
        if (dt > 0.1) dt = 0.1;

        if (this._weather && !this._loading && !this._error) {
            this._updateParticles(dt);
        }

        this._drawArea.queue_repaint();
        this._animationId = Mainloop.timeout_add(33, Lang.bind(this, this._animationLoop));
    }

    _stopAnimation() {
        this._animating = false;
        if (this._animationId) {
            Mainloop.source_remove(this._animationId);
            this._animationId = 0;
        }
    }

    on_desklet_removed() {
        this._stopAnimation();
        if (this._weatherTimerId) {
            Mainloop.source_remove(this._weatherTimerId);
            this._weatherTimerId = 0;
        }
    }
}

function main(metadata, desklet_id) {
    return new AnimatedWeatherDesklet(metadata, desklet_id);
}