# fwf-open-science-monitor

A dashboard for monitoring open-science compliance across FWF-funded research projects.

## Setup

1. Copy the example environment file and fill in your values:
   ```bash
   cp .env.example .env
   ```
   See `.env.example` for required variables. Get your FWF API key at https://openapi.fwf.ac.at/fwfkey.

## Development

Start the database:
```bash
docker-compose up db
```

Start the web app:
```bash
cd apps/web
npm install
npm run dev
```

The app will be available at http://localhost:3000.
