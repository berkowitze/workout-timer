import os
from collections.abc import Generator
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from flask import Flask, send_from_directory
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from models import Base

load_dotenv()

# Serve frontend static files in production
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
static_folder = str(FRONTEND_DIST) if FRONTEND_DIST.exists() else None

app = Flask(__name__, static_folder=static_folder, static_url_path="")
CORS(app)

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/workout_timer")
# Handle Railway's postgres:// vs postgresql:// URL format
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


# Import and register routes
from routes.ai import ai_bp
from routes.auth import auth_bp
from routes.workouts import workouts_bp

app.register_blueprint(auth_bp, url_prefix="/api")
app.register_blueprint(workouts_bp, url_prefix="/api")
app.register_blueprint(ai_bp, url_prefix="/api")


@app.route("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok"}


# Serve frontend for all non-API routes (SPA support)
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path: str) -> Any:
    if app.static_folder is None:
        return {"error": "Frontend not built"}, 404
    # Serve the file if it exists, otherwise serve index.html for SPA routing
    file_path = Path(app.static_folder) / path
    if path and file_path.exists():
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
