# Sweet Floor Card 🏡

A modern, dependency-free **3D Dollhouse Dashboard Card** for **Home Assistant**, combining the sleek layout of **Sweet-Home** with the rich 3D depth and interactive room layers of **NextFloor**.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![HA Version](https://img.shields.io/badge/Home%20Assistant-2023.8%2B%20%7C%202026.11%2B-blue)

---

## ✨ Features

- ☀️ **Day & Night Lighting Cycle**: Sky, house exterior, room walls, and glassmorphic UI elements smoothly brighten or dim based on the time of day and sun position.
- 🌅 **East-to-West Sun Path**: The sun traverses across the sky along a realistic solar arc from East (morning/left) to West (evening/right), casting dynamic sunlight washes across the 3D isometric rooms. At night, stars twinkle and the glowing moon travels across the sky.
- 💡 **Dynamic Room Lighting & TV Screen Glow**:
  - Rooms light up automatically when lights, TVs, switches, or heaters are turned on.
  - Active lights accurately reflect brightness and color temperature (Kelvin, mireds, or RGB).
  - TVs emit a dynamic, flickering cool blue ambient glow across the floor and walls with custom animations.
  - Device pucks highlight with pulsating aura rings and floating bob animations.
- 🧍 **Animated Person Presence & Tracking**:
  - Person avatars in the header bar illuminate with active glowing aura and expanding radar pulse waves (`ping`).
  - Avatars automatically navigate to their exact room in the 3D dollhouse (via motion sensors or Bermuda/ESPresense area beacons).
  - Rooms with detected motion display an animated glowing boundary pulse wave (`presence`).
- ⚡ **Built-in Energy & Gas Tracking**:
  - Connects automatically to Home Assistant's built-in Energy Dashboard (`energy/get_prefs`) with zero configuration required.
  - Robust auto-discovery for all standard `power`, `energy`, and `gas` sensors (supports `m³`, `ft³`, `kWh`, `CCF`, `therms`).
  - Animated SVG live power flow diagram where particle flow speed dynamically scales with watts.
  - Dedicated Gas tile, live usage metrics (today and this hour), hourly consumption bar charts, and 7-day trend history.
- 🏢 **Multi-Floor Switcher**: Toggle between floors (Ground Floor, 1st Floor, Upstairs, Basement) with live presence beacon dots.
- 📱 **Interactive Slide-up Control Sheet**: Tap any room to slide up an iOS-style frosted glass control drawer with brightness sliders, temperature steppers, cover buttons, media playback controls, and sensor badges.
- 📑 **Four Comprehensive Tabs**:
  - **🏠 Home**: 3D dollhouse floor plan with moving sun, weather effects (rain, snow, clouds, fog), lit rooms, avatars, and bottom glance bar.
  - **⚡ Energy**: Live animated power flow diagram, solar, battery, grid, gas metrics, and hourly & 7-day bar charts.
  - **🌡️ Climate**: Room-by-room temperature cards (color-coded warm/cool) and interactive thermostat controls.
  - **🛡️ Security**: Doors, windows, locks, alarms, smoke, and moisture sensors with status badges and unlock toggles.

---

## 🚀 Installation

### Option 1: Home Assistant Marketplace / HACS (Recommended)
1. In Home Assistant, go to **Settings > Marketplace** (or **HACS > Custom Repositories**).
2. Add this repository URL and select Category: **Dashboard**.
3. Click **Download / Install**.
4. Reload your browser window.

### Option 2: Manual Installation
1. Copy `sweet-floor-card.js` (or `ha-sweet-home.js`) into your Home Assistant `/config/www/` folder.
2. In Home Assistant, go to **Settings > Dashboards > 3 dots (top right) > Resources**.
3. Add Resource:
   - URL: `/local/sweet-floor-card.js`
   - Resource Type: **JavaScript Module**
4. Hard refresh your browser (`Ctrl+F5` or `Cmd+Shift+R`).

---

## 🛠️ Usage

### Minimal Configuration (Zero Config)
The card automatically reads your Home Assistant Areas, Floors, and Devices via WebSocket, with fallback auto-detection:

```yaml
type: custom:sweet-floor-card
title: Sweet Home
```

*(Note: `type: custom:ha-sweet-home` and `type: custom:sweet-home-card` are also supported as aliases!)*

---

### Full Configuration Example

```yaml
type: custom:sweet-floor-card
title: Sweet Home
height: 700                           # Card height in pixels (default: 680)
weather: weather.home                 # Drives sky weather effects (rain, snow, clouds)
sun_entity: sun.sun                   # Drives sun & moon trajectory and day/night cycle
linger: 90                            # Seconds a room stays occupied after motion ceases
animations: true                      # Set false to disable particle & bob animations
tabs: [home, energy, climate, security] # Tabs to display

persons:
  - person.alex
  - entity: person.sam
    area_sensor: sensor.sam_phone_area # Optional Bermuda / ESPresense beacon sensor

modes:                                # Quick action chips on the Home glance bar
  - entity: scene.movie_night
    name: Movie Night
    icon: 🎬
  - entity: script.bedtime
    name: Good Night
    icon: 🌙

exclude:                              # Entities to hide from the card
  - light.all_lights_group

# Optional: Energy & Gas sensor overrides (only if you want to override Energy Dashboard defaults)
energy:
  grid_power: sensor.grid_power
  solar_power: sensor.solar_power
  battery_power: sensor.battery_power
  home_power: sensor.house_power
  grid_import: sensor.grid_import_energy
  grid_export: sensor.grid_export_energy
  solar_energy: sensor.solar_energy
  gas: sensor.gas_meter               # m³, ft³, or kWh meter
```

---

### Manual Room Layout (Optional)
If you prefer custom coordinates over automatic area layout:

```yaml
type: custom:sweet-floor-card
rooms:
  - { area: living_room, x: 0, y: 0, w: 6, h: 4 }
  - { area: kitchen,     x: 6, y: 0, w: 4, h: 4 }
  - { area: bedroom,     x: 0, y: 4, w: 5, h: 3.4, floor: upstairs }
```

---

## 🧪 Offline Preview & Testing
Open `preview.html` in any web browser to test all interactive features offline with simulated data:
- Adjust time of day slider to watch day turn to golden sunset and starry night.
- Click **▶ Play Sun (East→West)** to watch the live solar progression.
- Click **🧍 Move Person** to see the avatar navigate rooms with animated radar pulses.
- Click **📺 Toggle TV** to see the screen flicker and ambient blue floor wash.
- Click **💡 Toggle Lights** to see warm kelvin lighting fill the rooms.
- Click **🔥 Boost Gas Flow** and check the Energy tab to view live flow animations.

---

## 📄 License
MIT License. Free to use, modify, and distribute.
