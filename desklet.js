/**
 * @file weather-animated@zulus - desklet.js
 * @module desklet
 *
 * Animated real-time weather desklet for Cinnamon (Linux Mint)
 * Uses Open-Meteo API (no API key required)
 *
 * Enhanced with procedural scene rendering via SceneBuilder.
 */

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const UUID = 'weather-animated@zulus';

imports.searchPath.unshift(imports.ui.deskletManager.deskletMeta[UUID].path);
const Desklet = imports.ui.desklet;
const WeatherServiceModule = imports.weatherService;
const ParticleSystemModule = imports.particleSystem;
const RendererModule = imports.renderer;
const SceneBuilderModule = imports.sceneBuilder;

/* ── Main desklet class ──────────────────────────────────────────────────── */

/**
 * Main desklet class for the Animated Weather desklet.
 * @extends {Desklet.Desklet}
 */
class AnimatedWeatherDesklet extends Desklet.Desklet {
    /**
     * @param {Object} metadata - Desklet metadata
     * @param {number|string} desklet_id - Desklet ID
     * @returns {void}
     */
    constructor(metadata, desklet_id) {
        super(metadata, desklet_id);
        this._desklet_id = desklet_id;
        this._uuid = metadata.uuid;

        this._weather = null;
        this._forecast = null;
        this._dailyForecast = null;
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
        this._scene = this._sceneBuilder.getDefaultScene(); // initial scene
        this._sceneTime = 0;
        this._skipParticleInit = false;
        this._lastLocation = null;
        this._lastUnits = null;

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
        this.settings.bindProperty(Settings.BindingDirection.IN, 'forecast-type', 'forecastType', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'opacity', 'opacity', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'width', 'width', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'language', 'language', this._onSettingsChanged.bind(this));
        this.settings.bindProperty(Settings.BindingDirection.IN, 'api-provider', 'apiProvider', this._onSettingsChanged.bind(this));

        this._buildUI();
        this._onSettingsChanged();
        this._refreshWeather();
        this._startAnimation();
    }

    /* ── UI building ────────────────────────────────────────────────────── */

    /**
     * Build the desklet UI with a St.DrawingArea.
     * @returns {void}
     */
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

        // Apply rounded corners directly to the outer container
        // St clips children to parent's border-radius, so this ensures
        // the entire desklet (including background, glass, and UI) has rounded corners.
        if (this.actor) {
            try { this.actor.set_style('border-radius: 24px;'); } catch (e) {}
        }
    }

    /**
     * Recursively force all widgets to transparent.
     * @param {boolean} transparent - Whether to set transparent styles
     * @returns {void}
     */
    _setContainerTransparent(transparent) {
        // Always keep border-radius; add transparent background when needed
        const style = transparent
            ? 'border-radius: 24px !important; background: transparent !important; background-color: transparent !important; border: none !important; box-shadow: none !important;'
            : 'border-radius: 24px;';

        const apply = function (widget) {
            if (!widget || typeof widget.set_style !== 'function') return;
            try { widget.set_style(style); } catch (e) {}
            if (typeof widget.get_children === 'function') {
                const kids = widget.get_children();
                for (let i = 0; i < kids.length; i++) apply(kids[i]);
            }
        };

        if (this.actor) apply(this.actor);
        if (this._drawArea) {
            try { this._drawArea.set_style(style); } catch (e) {}
        }
    }

    /* ── Geometry change ────────────────────────────────────────────────── */

    /**
     * Handle desklet view geometry changes.
     * @override
     * @returns {void}
     */
    on_desklet_view_geometry_changed() {
        const [w, h] = this.actor.get_size();
        if (w > 50 && h > 50) {
            this._width = w;
            this._height = h;
            this._drawArea.set_size(this._width, this._height);
            this._initParticles();
        }
    }

    /* ── Settings handler ───────────────────────────────────────────────── */

    /**
     * Handle settings changes.
     * @returns {void}
     */
    _onSettingsChanged() {
        // Normalise combobox values
        if (this.units === 'Celsius °C' || this.units === '°C') this.units = 'metric';
        if (this.units === 'Fahrenheit °F' || this.units === '°F') this.units = 'imperial';
        if (this.theme === 'Auto (adapts to weather/sky)') this.theme = 'auto';
        if (this.theme === 'Glass (frosted, always light)') this.theme = 'glass';
        if (this.theme === 'Dark (night mode)') this.theme = 'dark';
        if (this.theme === 'Warm (golden/amber tones)') this.theme = 'warm';
        if (this.theme === 'Cool (blue/teal tones)') this.theme = 'cool';
        if (this.theme === 'Nature (green/earth tones)') this.theme = 'nature';
        if (this.language === 'English') this.language = 'en';
        if (this.language === 'Русский') this.language = 'ru';
        if (this.apiProvider === 'Open-Meteo') this.apiProvider = 'open-meteo';
        if (this.apiProvider === 'MET Norway (yr.no)') this.apiProvider = 'met-norway';

        if (this._width !== this.width) {
            this._width = Math.max(200, Math.min(600, this.width));
            if (this._drawArea) this._drawArea.set_size(this._width, this._height);
        }

        if (this._weatherTimerId) {
            Mainloop.source_remove(this._weatherTimerId);
            this._weatherTimerId = 0;
        }

        const intervalMs = Math.max(2, Math.min(60, this.refreshInterval || 10)) * 60 * 1000;
        this._weatherTimerId = Mainloop.timeout_add(intervalMs, Lang.bind(this, function () {
            this._refreshWeather();
            return true;
        }));

        this._setContainerTransparent(this.showBackground === false);

        // Refresh weather only when location or units actually changed (Fix #3)
        const locationChanged = (this._lastLocation !== this.location) ||
                              (this._lastUnits !== this.units);
        this._lastLocation = this.location;
        this._lastUnits = this.units;

        if (locationChanged) {
            this._skipParticleInit = true; // _onWeatherLoaded will handle init (Fix #2)
            this._refreshWeather();
        } else {
            this._initParticles();
        }

        if (this._drawArea) this._drawArea.queue_repaint();
    }

    /* ── Particle initialisation ────────────────────────────────────────── */

    /**
     * Initialise particles based on current weather.
     * @returns {void}
     */
    _initParticles() {
        const weatherId = this._weather ? this._weather.weather[0].id : 800;
        const isNight = this._isNight();
        this._particleSystem.init(this._width, this._height, weatherId, isNight);
    }

    /* ── Weather fetch flow ─────────────────────────────────────────────── */

    /**
     * Refresh weather data from the API.
     * @returns {void}
     */
    _refreshWeather() {
        this._loading = true;
        this._error = null;
        if (this._drawArea) this._drawArea.queue_repaint();

        this._weatherService.resolveLocation(
            this.location,
            this.language,
            Lang.bind(this, function (lat, lon, name, country) {
                this._weatherService._provider = this.apiProvider || 'met-norway';
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

    /**
     * Handle successfully loaded weather data.
     * @param {Object} data - Weather data object from fetchWeather
     * @returns {void}
     */
    _onWeatherLoaded(data) {
        this._weather = data.weather;
        this._forecast = data.forecast;
        this._dailyForecast = data.dailyForecast;
        this._sunriseMinutes = data.sunriseMinutes;
        this._sunsetMinutes = data.sunsetMinutes;
        this._loading = false;
        this._error = null;

        // _onWeatherLoaded always re-inits particles with fresh weather data.
        // The _skipParticleInit flag marks that this call originated from
        // _onSettingsChanged (which removed its own direct call), so the
        // init always happens exactly once here (Fix #2).
        this._skipParticleInit = false;
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

    /**
     * Handle weather fetch errors.
     * @param {Object|string} err - Error information
     * @returns {void}
     */
    _onWeatherError(err) {
        this._error = err;
        this._loading = false;
        if (this._drawArea) this._drawArea.queue_repaint();
    }

    /* ── Night detection via sunrise/sunset ─────────────────────────────── */

    /**
     * Determine whether it is currently night.
     * @returns {boolean} True if it is night
     */
    _isNight() {
        if (this._sunriseMinutes === null || this._sunsetMinutes === null) {
            const h = new Date().getHours();
            return h < 6 || h >= 21;
        }
        const now = new Date();
        const curMin = now.getHours() * 60 + now.getMinutes();
        return curMin < this._sunriseMinutes || curMin > this._sunsetMinutes;
    }

    /* ── Animation loop (≈30 fps) ───────────────────────────────────────── */

    /**
     * Start the animation loop.
     * @returns {void}
     */
    _startAnimation() {
        if (this._animating) return;
        this._animating = true;
        this._lastFrameTime = Date.now();
        this._animationLoop();
    }

    /**
     * Main animation loop (≈30 fps via Mainloop.timeout_add).
     * @returns {void}
     */
    _animationLoop() {
        if (!this._animating) return;

        try {
            const now = Date.now();
            let dt = (now - this._lastFrameTime) / 1000;
            this._lastFrameTime = now;
            if (dt > 0.1) dt = 0.1;

            // ── Update scene interpolation ──
            if (this._sceneBuilder) {
                this._sceneBuilder.update(dt);
                this._scene = this._sceneBuilder._current;
                this._sceneTime += dt;
                // Pass ambient light to particle system for natural color integration
                if (this._particleSystem && this._scene.ambientLight) {
                    this._particleSystem.ambientLight = this._scene.ambientLight;
                }
            }

            // ── Update particles ──
            if (this._weather && !this._loading && !this._error) {
                this._particleSystem.update(dt, this._width, this._height);
            }

            this._drawArea.queue_repaint();
        } catch (e) {
            global.logError('Animation error: ' + e);
        }

        this._animationId = Mainloop.timeout_add(33, Lang.bind(this, this._animationLoop));
    }

    /**
     * Stop the animation loop.
     * @returns {void}
     */
    _stopAnimation() {
        this._animating = false;
        if (this._animationId) {
            Mainloop.source_remove(this._animationId);
            this._animationId = 0;
        }
    }

    /* ── Cleanup ────────────────────────────────────────────────────────── */

    /**
     * Handle desklet removal (cleanup).
     * @override
     * @returns {void}
     */
    on_desklet_removed() {
        this._stopAnimation();
        if (this._weatherTimerId) {
            Mainloop.source_remove(this._weatherTimerId);
            this._weatherTimerId = 0;
        }
    }
}

/* ── Entry point ─────────────────────────────────────────────────────────── */

/**
 * Desklet entry point.
 * @param {Object} metadata - Desklet metadata
 * @param {number|string} desklet_id - Desklet ID
 * @returns {AnimatedWeatherDesklet} New desklet instance
 */
// eslint-disable-next-line no-unused-vars
function main(metadata, desklet_id) {
    return new AnimatedWeatherDesklet(metadata, desklet_id);
}
