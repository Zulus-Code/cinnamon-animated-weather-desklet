# Changelog

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
