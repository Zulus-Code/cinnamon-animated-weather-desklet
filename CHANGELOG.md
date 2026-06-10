# Changelog

## [2.3.0] - 2026-06-10

### Added
- **MET Norway (yr.no) weather provider** — dual provider support, switchable in desklet settings. Works in regions where Open-Meteo is blocked (Russia, China, etc.)
- **Rounded corners** — 24px border-radius on desklet container with Cairo clipping for a modern glass-morph look
- **Ambient light integration** — rain, snow, and hail particles dynamically pick up sky tones for natural scene-weather blending
- **Symbol code → WMO mapping** — 40+ MET Norway symbol codes mapped to WMO weather codes
- **Sunrise/sunset API** — separate fetch from MET Norway's sunrise/3.0/sun endpoint
- **Wind chill approximation** — `feels_like` calculated from temperature + wind speed when >2 m/s
- **User-Agent header** — set on Soup.Session (required by MET Norway)
- **Hourly forecast from timeseries** — builder from MET Norway's flat timeseries array (up to 8 slots)
- **Daily forecast aggregation** — groups timeseries by date, uses majority vote for daily symbol
- **Renderer tests** — 3 new tests (total: 122) for fallback sky colors and _iconToEmoji

### Changed
- **README** — updated for MET Norway, dual providers, rounded corners, ambient light, config table
- **Sun rendering** — multi-stop radial gradient for realistic solar disc effect
- **Moon rendering** — softer glow falloff, smoother crescent shadows
- **Particle colors** — rain, snow, and hail now multiply base color by `ambientLight` from scene
- **Sky fallback** — inline RGB arrays replaced hex color lookups for faster static rendering
- **Rounded container** — `_setContainerTransparent` and `_buildUI` now always apply border-radius: 24px
- **Animation loop** — passes `scene.ambientLight` to particle system each frame
- **ESLint config** — updated for new file structure (no longer hardcodes 7 files)

### Fixed
- **St not defined error** — added explicit `const St = imports.gi.St;` for Cinnamon >= 6.x

---

## [2.2.0] - 2026-06-10

### Added
- **Daily forecast (3–5 days)** — new `forecast-type` setting (Daily / Hourly), shows day name + icon + hi/lo temps
- **Hail particles** — icy ball effect for severe thunderstorms (WMO 96, 99)
- **Lightning flashes** — random full-screen flashes with branches during thunderstorms
- **Rainbow effect** — appears when sun is low (5–35°) with light rain/drizzle
- **New themes**: Warm (golden/amber), Cool (blue/teal), Nature (green/earth)
- **ESLint** — flat config for GJS, all 7 JS files: 0 errors, 0 warnings
- **JSDoc types** — full `@param`/`@returns`/`@constructor` annotations on all 86 functions/methods
- **Test suite** — 119 tests for core logic (utils, constants, sceneBuilder, renderer, weatherService)

### Changed
- **Sun/Moon repositioned** to top-right corner — no longer hidden behind weather data
- **Removed large weather emoji** from the header area for a cleaner compact look
- **Sun, moon, clouds, and lightning** now render even when transparent background is enabled (`showBackground: false`)
- UI layout compacted: weather data shifted up by ~60px after emoji removal
- Forecast strip starts slightly higher (`h * 0.65` instead of `0.75`)
- Thunderstorm (`precipitationType`) now also triggers for 'hail'
- Weather API: `forecast_days=2` → `forecast_days=6`, added `daily` params
- Dead code removed: `_drawProceduralScene`, unused GJS imports (`Utils`, `Constants`, `St`, `ByteArray`), `getImagePath`

### Fixed
- Transparent mode no longer hides celestial bodies and cloud layers

## [2.1.1] - 2026-06-07

### Fixed
- Encapsulation: Renderer no longer accesses private fields (`_d._sceneBuilder`, `_d._sceneTime`); scene now carries `cloudOffsets`, Renderer has its own internal clock
- Double `_initParticles()` call on settings change (added `_skipParticleInit` flag)
- Unnecessary weather API refetch on cosmetic-only setting changes (track `_lastLocation`/`_lastUnits`)
- Moon phase calculation off-by-one on 31st day of month (`((dayOfMonth - 1) % 29.53) / 29.53`)
- Hardcoded forecast Y position now relative to desklet height (`Math.min(300, h * 0.75)`)
- Cairo context memory leak — `cr.$dispose()` at end of `draw()`
- Removed duplicate `_hexToRgba` from renderer.js (now uses `Utils._hexToRgba`)

---

## [2.1.0] - 2026-06-07

### Added
- Humidity, wind, pressure display toggles (`show-humidity`, `show-wind`, `show-pressure`)
- Error handling wrappers in animation loop, renderer, and cloud rendering
- `.gitignore`

### Changed
- Container transparency: reset style with `null` instead of empty string
- Cairo.Pattern constructor fallback for libsoup2/libsoup3 compatibility
- `install.sh` — now installs all 10 files + translations

---

## [2.0.0] - 2026-06-07

### Added
- Procedural scene rendering: Perlin noise, fBm (Fractal Brownian Motion), NoiseTexture
- 3-layer cloud system with parallax, drift animation, and dynamic density
- Dynamic sky colors: day/night/twilight/sunset transitions with weather-adaptive palette
- Moon phase and illumination calculation
- SceneBuilder module — transforms WMO weather codes into visual scene parameters
- Smooth interpolation between weather states (color, clouds, fog, precipitation)

### Changed
- **Major refactor:** monolithic `desklet.js` (1200+ lines) → **6 modular files**:
  `constants.js`, `utils.js`, `weatherService.js`, `renderer.js`, `particleSystem.js`, `sceneBuilder.js`
- Text rendering: Cairo → PangoCairo (emoji support)
- Particle system extracted into dedicated module
- README art replaced with real screenshot

---

## [1.3.0] - 2026-06-06

### Added
- `show-background` toggle — transparent mode with floating particles (sky gradient and glass panel hidden)
- Container transparency: recursive widget style override

### Changed
- Text rendering: Cairo `cr.showText()` → PangoCairo (emoji support in weather icons)

---

## [1.2.0] - 2026-06-06

### Added
- Open-Meteo API integration (current weather, hourly forecast, daily sunrise/sunset)
- Open-Meteo Geocoding API for city search
- WMO weather code → OWM ID mapping (`wmoToOwmId`)
- City name, `lat,lon`, and `auto` location modes
- Sunrise/sunset-based night detection

### Changed
- **Breaking:** OpenWeatherMap → Open-Meteo API (API key no longer required)
- Settings schema: removed `api-key` field and related strings
- Single API call for current + hourly + daily data (was separate current + forecast)
- Weather description lookup via WMO code table instead of OWM string

### Removed
- OpenWeatherMap API key requirement

---

## [1.1.0] - 2026-05-25

### Added
- Russian language support (Cairo strings via `STRINGS` dict)
- Gettext `po/` directory for settings dialog translations
- Language setting in desklet config (English / Русский)
- Russian wind unit (м/с) and pressure unit (гПа)

### Changed
- Wind and pressure units adapt to selected language

---

## [1.0.0] - 2026-05-24

### Added
- Initial release of animated weather desklet for Cinnamon
- Live particle effects: rain, snow, clouds, stars
- Glassmorphism UI with adaptive transparency
- Dynamic sky gradients based on weather and time
- OpenWeatherMap API integration
- Hourly forecast strip (6/12/24 h)
- IP geolocation for auto city detection
- Configurable: units, theme, opacity, width, refresh interval
- libsoup2/libsoup3/curl HTTP fallback
- ES6 class-based architecture with Cairo rendering
