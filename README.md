# FloodSpot - Community Flood Monitoring & Safe Navigation

FloodSpot is a community-driven flood monitoring, alert, and safe navigation application.

## Directory Structure

```text
floodspot/
├── .env                  # Master environment variable file (Vite + FastAPI)
├── package.json          # Master orchestration script
├── README.md             # Project documentation
├── frontend/             # React + Vite application
│   ├── public/           # Static public assets
│   ├── src/              # React components, hooks, and services
│   ├── index.html        # Main HTML entrypoint
│   ├── package.json      # Frontend dependencies and scripts
│   └── vite.config.js    # Vite configuration (envDir configured to '../')
├── backend/              # Python FastAPI server
│   ├── main.py           # FastAPI main application
│   ├── config.py         # Pydantic settings loading from '../.env'
│   ├── routes/           # API endpoints (alerts, reports, routes)
│   ├── services/         # Weather and Supabase integrations
│   └── requirements.txt  # Backend dependencies
└── models/               # ML models, computer vision & hydrology inference scripts
```

## Running Locally

### Run Both Frontend & Backend Concurrently (Root)
```bash
npm run dev
```

### Run Frontend Only
```bash
npm run dev:frontend
# or
cd frontend && npm run dev
```

### Run Backend Only
```bash
npm run dev:backend
# or
cd backend && uvicorn main:app --reload
```
