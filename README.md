# Griblet

Free online GRIB file viewer for marine weather data. Visualize wind forecasts instantly in your browser.

**Live:** [griblet.app](https://griblet.app/)

## Features

- Upload and visualize GRIB/GRIB2 weather files
- Animated wind particle visualization on an interactive map
- Multi-time-step support (scrub through forecast hours)
- Saildocs email request builder
- No signup required, files processed in memory only

## Requirements

- [Bun](https://bun.sh) runtime
- [eccodes](https://confluence.ecmwf.int/display/ECC) for GRIB parsing

```bash
# macOS
brew install eccodes

# Ubuntu/Debian
apt-get install libeccodes-tools
```

## Development

```bash
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Production

```bash
bun run build
bun run start
```

## Deploy to Fly.io

```bash
fly launch
fly deploy
```

The app uses auto-stop machines to minimize costs when idle.

## Tech Stack

- React Router v7 (SSR)
- Bun runtime
- Leaflet + leaflet-velocity
- Tailwind CSS
- eccodes (GRIB parsing)
