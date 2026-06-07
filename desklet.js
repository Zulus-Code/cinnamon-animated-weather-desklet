/* weather-animated@zulus - desklet.js
 * Animated real-time weather desklet for Cinnamon (Linux Mint)
 * Uses Open-Meteo API (no API key required)
 *
 * Enhanced with procedural scene rendering via SceneBuilder.
 */

const Desklet = imports.ui.desklet;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

const UUID = "weather-animated@zulus";
const DESKLET_ROOT = imports.ui.deskletManager.deskletMeta[UUID].path;

// Add desklet directory to GJS import search path so sibling modules can be loaded
imports.searchPath.unshift(DESKLET_ROOT);

const Constants = imports.constants;
const Utils = imports.utils;
const WeatherServiceModule = imports.weatherService;
const ParticleSystemModule = imports.particleSystem;
const RendererModule = imports.renderer;
const SceneBuilderModule = imports.sceneBuilder;

/* ── Main desklet class ──────────────────────────────────────────────────── */

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
        this._width = 350;
        this._height = 400;
        this._error = null;
        this._loading = true;
        this._sunriseMinutes = null;
        this._sunsetMinutes = null;

        // ── Scene system ──
        this._sceneBuilder = new SceneBuilderModule.SceneBuilder();
        this._scene = this._sceneBuilder._defaultScene(); // initial scene
        this._sceneTime = 0;

        // Create service modules
        this._weatherService = new WeatherServiceModule.WeatherService();
        this._particleSystem = new ParticleSystemModule.ParticleSystem();
        this._renderer = new RendererModule.Renderer(this);

        // Pass noise texture to renderer for cloud/fog masks
        this._renderer.setNoiseTexture(this._sceneBuilder.getNoiseTex());

        this.settings = new Settings.DeskletSettings(this, this._uuid, desklet_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'location', 'location', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'units', 'units', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'refresh-interval', 'refreshInterval', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'theme', 'theme', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'show-forecast', 'showForecast', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'forecast-hours', 'forecastHours', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'show-background', 'showBackground', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'show-humidity', 'showHumidity', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'show-wind', 'showWind', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'show-pressure', 'showPressure', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'opacity', 'opacity', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'width', 'width', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'language', 'language', this._onSettingsChanged.bind(this));

        this._buildUI();
        this._onSettingsChanged();
        this._refreshWeather();
        this._startAnimation();
    }

    /* ── UI building ────────────────────────────────────────────────────── */

    _buildUI() {
        this.setHeader('');
        this._drawArea = new St.DrawingArea({
            reactive: true,
            width: this._width || 350,
            height: this._height || 400
        });
        this._drawArea.connect('repaint', Lang.bind(this, function () {
            this._renderer.draw(this._drawArea);
        }));
        this.setContent(this._drawArea);
    }

    /* Recursively force all widgets to transparent */
    _setContainerTransparent(transparent) {
        let style = transparent
            ? 'background: transparent !important; background-color: transparent !important; border: none !important; box-shadow: none !important;'
            : '';

        let apply = function (widget) {
            if (!widget || typeof widget.set_style !== 'function') return;
            try { widget.set_style(style); } catch (e) {}
            if (typeof widget.get_children === 'function') {
                let kids = widget.get_children();
                for (let i = 0; i < kids.length; i++) apply(kids[i]);
            }
        };

        if (this.actor) apply(this.actor);
        if (this._drawArea) {
            try { this._drawArea.set_style(style); } catch (e) {}
        }
    }

    /* ── Geometry change ────────────────────────────────────────────────── */

    on_desklet_view_geometry_changed() {
        let [w, h] = this.actor.get_size();
        if (w > 50 && h > 50) {
            this._width = w;
            this._height = h;
            this._drawArea.set_size(this._width, this._height);
            this._initParticles();
        }
    }

    /* ── Settings handler ───────────────────────────────────────────────── */

    _onSettingsChanged() {
        // Normalise combobox values
        if (this.units === 'Celsius \u00B0C' || this.units === '\u00B0C') this.units = 'metric';
        if (this.units === 'Fahrenheit \u00B0F' || this.units === '\u00B0F') this.units = 'imperial';
        if (this.theme === 'Auto (adapts to weather/sky)') this.theme = 'auto';
        if (this.theme === 'Glass (frosted, always light)') this.theme = 'glass';
        if (this.theme === 'Dark (night mode)') this.theme = 'dark';
        if (this.language === 'English') this.language = 'en';
        if (this.language === '\u0420\u0443\u0441\u0441\u043A\u0438\u0439') this.language = 'ru';

        if (this._width !== this.width) {
            this._width = Math.max(200, Math.min(600, this.width));
            if (this._drawArea) this._drawArea.set_size(this._width, this._height);
        }

        if (this._weatherTimerId) {
            Mainloop.source_remove(this._weatherTimerId);
            this._weatherTimerId = 0;
        }

        let intervalMs = Math.max(2, Math.min(60, this.refreshInterval || 10)) * 60 * 1000;
        this._weatherTimerId = Mainloop.timeout_add(intervalMs, Lang.bind(this, function () {
            this._refreshWeather();
            return true;
        }));

        this._setContainerTransparent(this.showBackground === false);
        this._initParticles();
        if (this._drawArea) this._drawArea.queue_repaint();
        this._refreshWeather();
    }

    /* ── Particle initialisation ────────────────────────────────────────── */

    _initParticles() {
        let weatherId = this._weather ? this._weather.weather[0].id : 800;
        let isNight = this._isNight();
        this._particleSystem.init(this._width, this._height, weatherId, isNight);
    }

    /* ── Weather fetch flow ─────────────────────────────────────────────── */

    _refreshWeather() {
        this._loading = true;
        this._error = null;
        if (this._drawArea) this._drawArea.queue_repaint();

        this._weatherService.resolveLocation(
            this.location,
            this.language,
            Lang.bind(this, function (lat, lon, name, country) {
                this._weatherService.fetchWeather(
                    lat, lon, name, country,
                    this.units, this.language,
                    Lang.bind(this, this._onWeatherLoaded),
                    Lang.bind(this, this._onWeatherError)
                );
            }),
            Lang.bind(this, this._onWeatherError)
        );
    }

    _onWeatherLoaded(data) {
        this._weather = data.weather;
        this._forecast = data.forecast;
        this._sunriseMinutes = data.sunriseMinutes;
        this._sunsetMinutes = data.sunsetMinutes;
        this._loading = false;
        this._error = null;
        this._initParticles();

        // Update scene target from weather data
        if (this._sceneBuilder) {
            this._sceneBuilder.buildScene(
                this._weather,
                this._sunriseMinutes,
                this._sunsetMinutes,
                this.language
            );
        }

        if (this._drawArea) this._drawArea.queue_repaint();
    }

    _onWeatherError(err) {
        this._error = err;
        this._loading = false;
        if (this._drawArea) this._drawArea.queue_repaint();
    }

    /* ── Night detection via sunrise/sunset ─────────────────────────────── */
    /* (kept for backwards compatibility with theme colors) */

    _isNight() {
        if (this._sunriseMinutes === null || this._sunsetMinutes === null) {
            let h = new Date().getHours();
            return h < 6 || h >= 21;
        }
        let now = new Date();
        let curMin = now.getHours() * 60 + now.getMinutes();
        return curMin < this._sunriseMinutes || curMin > this._sunsetMinutes;
    }

    /* ── Animation loop (≈30 fps) ───────────────────────────────────────── */

    _startAnimation() {
        if (this._animating) return;
        this._animating = true;
        this._lastFrameTime = Date.now();
        this._animationLoop();
    }

    _animationLoop() {
        if (!this._animating) return;

        let now = Date.now();
        let dt = (now - this._lastFrameTime) / 1000;
        this._lastFrameTime = now;
        if (dt > 0.1) dt = 0.1;

        // ── Update scene interpolation ──
        if (this._sceneBuilder) {
            this._sceneBuilder.update(dt);
            this._scene = this._sceneBuilder._current;
            this._sceneTime += dt;
        }

        // ── Update particles ──
        if (this._weather && !this._loading && !this._error) {
            this._particleSystem.update(dt, this._width, this._height);
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

    /* ── Cleanup ────────────────────────────────────────────────────────── */

    on_desklet_removed() {
        this._stopAnimation();
        if (this._weatherTimerId) {
            Mainloop.source_remove(this._weatherTimerId);
            this._weatherTimerId = 0;
        }
    }
}

/* ── Entry point ─────────────────────────────────────────────────────────── */

function main(metadata, desklet_id) {
    return new AnimatedWeatherDesklet(metadata, desklet_id);
}
