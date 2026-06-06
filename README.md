# ☀️ Animated Weather Desklet for Cinnamon

A beautiful, real-time animated weather desklet for Linux Mint Cinnamon desktop. Features live particle effects (rain, snow, drifting clouds, twinkling stars), glassmorphism UI, auto-detection of your location, and **full Russian language support**.

```
 ┌──────────────────────────────────┐
 │      ☀️    ✦  ✧   ☁️           │
 │   ✦                    ✧        │
 │    ┌──────────────────────┐      │
 │    │   ⛅                  │      │
 │    │   +24°C              │      │
 │    │   Partly Cloudy      │      │
 │    │   Feels like +21°C   │      │
 │    │                      │      │
 │    │  💧52% 💨12km/h 🌡️1012│     │
 │    │                      │      │
 │    │  12:00 15:00 18:00   │      │
 │    │   ⛅   ☀️   🌧️       │      │
 │    │  24°   27°   19°     │      │
 │    └──────────────────────┘      │
 │  ✧              ☁️               │
 └──────────────────────────────────┘
```

## ✨ Features

- **Live animated weather** — rain drops, snowflakes, drifting clouds, twinkling stars at night
- **Glassmorphism UI** — frosted glass panel with adaptive transparency
- **Sky gradient** — dynamic sky colours that adapt to weather condition and time of day
- **Auto location** — detects your city via IP geolocation (or set manually)
- **Real-time data** — powered by OpenWeatherMap (free API)
- **Hourly forecast** — 6/12/24 hour forecast strip
- **Configurable** — units, theme (Auto/Glass/Dark), opacity, width, refresh interval
- **🌐 Russian language** — interface and settings available in Русский
- **Lightweight** — ~30fps Cairo-rendered, no GPU needed

## 📦 Installation

### Prerequisites

- **Linux Mint 20+** (or any Cinnamon desktop ≥ 4.6)
- **OpenWeatherMap API key** — [get one free](https://openweathermap.org/api) (free tier: 60 calls/min)

### Install

```bash
# Clone and install in one go
git clone https://github.com/Zulus-Code/cinnamon-animated-weather-desklet.git \
  ~/.local/share/cinnamon/desklets/weather-animated@zulus/

# Restart Cinnamon
Ctrl+Alt+Esc
```

> ⚠️ **Note:** The one-liner `curl | bash` method is no longer recommended. Use `git clone` for reliable installation and easy updates (`git pull`).

### Activate

1. Right-click on desktop → **Add Desklet**
2. Find **Анимированная погода** (or **Animated Weather**) → click **Add**
3. Right-click the desklet → **Configure**
4. Enter your **OpenWeatherMap API Key**
5. Choose your **city** (or leave `auto`)
6. Select **Language** → **Русский** (optional)

### Updating

```bash
cd ~/.local/share/cinnamon/desklets/weather-animated@zulus/
git pull
Ctrl+Alt+Esc
```

## 🌐 Internationalisation

The desklet supports **English** and **Russian** interface languages.

**For the Cairo-rendered UI** (temperatures, labels, errors):
Switch language in desklet settings: **Configure → Language → Русский**

**For the settings dialog** (descriptions, tooltips):
Install gettext and compile the translations:
```bash
sudo apt install gettext
msgfmt ~/.local/share/cinnamon/desklets/weather-animated@zulus/po/ru.po \
  -o ~/.local/share/locale/ru/LC_MESSAGES/weather-animated@zulus.mo
Ctrl+Alt+Esc
```

When switching to Russian:
- Wind unit changes from `km/h` to `м/с`
- Pressure unit changes from `hPa` to `гПа`
- All labels, errors, and loading messages are translated
- Settings dialog descriptions and tooltips are translated (with `msgfmt`)

## ⚙️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| API Key | — | Your OpenWeatherMap API key (required) |
| Location | `auto` | City name or 'auto' for IP geolocation |
| Units | Celsius | °C or °F |
| Language | English | Interface language (English / Русский) |
| Refresh | 10 min | How often to fetch weather data |
| Theme | Auto | Auto (adapts), Glass (always light), Dark |
| Forecast | ✅ On | Show hourly forecast strip |
| Forecast hours | 6 h | Forecast range (3–24 h) |
| Opacity | 70% | Panel transparency |
| Width | 350 px | Desklet width |

## 🎨 Weather Animations

| Condition | Effect |
|-----------|--------|
| ☀️ Clear (day) | Warm golden glow, subtle sparkles |
| 🌙 Clear (night) | Deep blue sky, twinkling stars with cross flares |
| ☁️ Cloudy | Grey-white gradient, drifting cloud clusters |
| 🌧️ Rain | Dynamic rain streaks, steel-blue sky |
| ⛈️ Thunderstorm | Heavy rain, dark turbulent sky |
| ❄️ Snow | White gradient, falling snowflakes with drift |
| 🌫️ Fog/Mist | Soft grey gradient, fog wisps |

## 🛠️ Development

The desklet is a single self-contained file rendered entirely via Cairo. The structure:

```
weather-animated@zulus/
├── desklet.js           # Main logic: particles, sky, UI, weather API, i18n
├── settings-schema.json # Settings UI definition
├── metadata.json        # Desklet metadata
├── stylesheet.css       # Container styles
├── install.sh           # Legacy installer
├── po/
│   ├── weather-animated@zulus.pot  # Gettext translation template
│   └── ru.po                       # Russian translations
├── README.md            # This file
└── LICENSE              # GPL-3.0
```

### Architecture

- **Class-based** ES6 JavaScript (Cinnamon/GJS compatible)
- **Cairo rendering** — all UI drawn via Cairo on `St.DrawingArea`
- **Particle system** — lightweight physics for rain/snow/clouds/stars
- **HTTP** — libsoup2 (queue_message) / libsoup3 (send_and_read_async) / blocking curl fallback
- **i18n** — custom `STRINGS` dict + `_(key)` helper for Cairo text; Gettext `.po` files for settings dialog
- **No dependencies** — pure JavaScript, no Node.js, no WebKit

### Building from source

No build step required — pure JavaScript, drop-in install.

## 📄 License

GNU General Public License v3.0 — see [LICENSE](LICENSE).

---

*Made by [@Zulus-code](https://github.com/Zulus-code)*
