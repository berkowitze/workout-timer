import os
from collections.abc import Generator
from typing import Any

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from models import Base

load_dotenv()

app = Flask(__name__)
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


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
