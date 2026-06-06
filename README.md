# ☀️ Animated Weather Desklet for Cinnamon

A beautiful, real-time animated weather desklet for Linux Mint Cinnamon desktop. Features live particle effects (rain, snow, drifting clouds, twinkling stars), glassmorphism UI, and auto-detection of your location.

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
- **Lightweight** — ~30fps Cairo-rendered, no GPU needed

## 📦 Installation

### Prerequisites

- **Linux Mint 20+** (or any Cinnamon desktop ≥ 4.6)
- **OpenWeatherMap API key** — [get one free](https://openweathermap.org/api) (free tier: 60 calls/min)

### Method 1: Manual

```bash
# Clone or download
git clone https://github.com/Zulus-Code/cinnamon-animated-weather-desklet.git

# Install
mkdir -p ~/.local/share/cinnamon/desklets/weather-animated@zulus/
cp -r cinnamon-animated-weather-desklet/* ~/.local/share/cinnamon/desklets/weather-animated@zulus/

# Restart Cinnamon
Ctrl+Alt+Esc
```

### Method 2: One-liner

```bash
curl -sL https://github.com/Zulus-Code/cinnamon-animated-weather-desklet/raw/main/install.sh | bash
```

### Activate

1. Right-click on desktop → **Add Desklet**
2. Find **Animated Weather** → click **Add**
3. Right-click the desklet → **Configure**
4. Enter your **OpenWeatherMap API Key**
5. Choose your **city** (or leave `auto`)

## ⚙️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| API Key | — | Your OpenWeatherMap API key (required) |
| Location | `auto` | City name or 'auto' for IP geolocation |
| Units | Celsius | °C or °F |
| Refresh | 10 min | How often to fetch weather data |
| Theme | Auto | Auto (adapts), Glass (always light), Dark |
| Forecast | ✅ On | Show hourly forecast strip |
| Opacity | 70% | Panel transparency |
| Width | 350px | Desklet width |

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
├── desklet.js          # Main logic: particles, sky, UI, weather API
├── settings-schema.json # Settings UI definition
├── metadata.json        # Desklet metadata
├── stylesheet.css       # Container styles
├── README.md            # This file
└── LICENSE              # GPL-3.0
```

### Building from source

No build step required — pure JavaScript, drop-in install.

## 📄 License

GNU General Public License v3.0 — see [LICENSE](LICENSE).

---

*Made by [@Zulus-code](https://github.com/Zulus-code)*
