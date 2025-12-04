# Workout Timer

A web app for circuit/interval/timed workouts with AI-powered workout parsing.

## Local Development Setup

### Prerequisites
- Python 3.10+
- Node.js 20+
- PostgreSQL

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Create `backend/.env` file:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/workout_timer
OPENAI_API_KEY=sk-your-api-key-here
APP_PASSWORD=your-password-here
```

Create the database:
```bash
# Connect to PostgreSQL and create database
psql -U postgres -c "CREATE DATABASE workout_timer;"
```

Run the backend:
```bash
cd backend
.\venv\Scripts\activate  # or source venv/bin/activate on macOS/Linux
python app.py
```

The backend runs on http://localhost:5000

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on http://localhost:5173 and proxies `/api` requests to the backend.

### Running Both

Open two terminals:

**Terminal 1 (Backend):**
```bash
cd backend
.\venv\Scripts\activate
python app.py
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Visit http://localhost:5173 to use the app.

## Deployment (Railway)

1. Create two services: web app and PostgreSQL database
2. Set environment variables: `DATABASE_URL` (auto-set by Railway), `OPENAI_API_KEY`
3. Backend start command: `gunicorn app:app`
4. Frontend: Build and serve static files or deploy separately
