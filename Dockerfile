# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Production image
FROM python:3.12-slim
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Set working directory to backend
WORKDIR /app/backend

# Run migrations and start server
CMD alembic upgrade head && gunicorn app:app --workers 2 --threads 4 --bind 0.0.0.0:$PORT

