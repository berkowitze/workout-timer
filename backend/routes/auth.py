import os
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any

import bcrypt
import jwt
from authlib.integrations.flask_client import OAuth
from flask import Blueprint, Response, jsonify, redirect, request
from jwt.api_jwt import PyJWT

auth_bp = Blueprint("auth", __name__)
oauth = OAuth()

JWT_SECRET = os.getenv("JWT_SECRET_KEY", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7


def _make_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return PyJWT().encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_jwt(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])  # type: ignore[no-any-return]
    except jwt.PyJWTError:
        return None


def _get_db() -> Any:
    from app import SessionLocal

    return SessionLocal()


def require_auth(f: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = _decode_jwt(token)
            if payload:
                return f(*args, **kwargs)
        return jsonify({"error": "Unauthorized"}), 401

    return decorated


@auth_bp.route("/auth/register", methods=["POST"])
def register() -> tuple[Response, int] | Response:
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    db = _get_db()
    try:
        from models import User

        existing = db.query(User).filter(User.email == email).first()
        if existing:
            return jsonify({"error": "Email already registered"}), 409

        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        user = User(email=email, password_hash=password_hash)
        db.add(user)
        db.commit()
        db.refresh(user)

        token = _make_jwt(str(user.id))
        return jsonify({"token": token})
    finally:
        db.close()


@auth_bp.route("/auth/login", methods=["POST"])
def login() -> tuple[Response, int] | Response:
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    db = _get_db()
    try:
        from models import User

        user = db.query(User).filter(User.email == email).first()
        if not user or not user.password_hash:
            return jsonify({"error": "Invalid credentials"}), 401

        if not bcrypt.checkpw(password.encode(), user.password_hash.encode()):
            return jsonify({"error": "Invalid credentials"}), 401

        token = _make_jwt(str(user.id))
        return jsonify({"token": token})
    finally:
        db.close()


@auth_bp.route("/auth/google/login", methods=["GET"])
def google_login() -> Response:
    redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI", "http://localhost:5001/api/auth/google/callback"
    )
    return oauth.google.authorize_redirect(redirect_uri)  # type: ignore[no-any-return]


@auth_bp.route("/auth/google/callback", methods=["GET"])
def google_callback() -> Response:
    token = oauth.google.authorize_access_token()
    userinfo = token.get("userinfo") or oauth.google.userinfo()

    google_id = userinfo["sub"]
    email = userinfo.get("email", "").lower()

    db = _get_db()
    try:
        from models import User

        user = db.query(User).filter(User.google_id == google_id).first()

        if not user and email:
            # Link to existing email/password account if email matches
            user = db.query(User).filter(User.email == email).first()
            if user:
                user.google_id = google_id
                db.commit()

        if not user:
            user = User(email=email, google_id=google_id)
            db.add(user)
            db.commit()
            db.refresh(user)

        jwt_token = _make_jwt(str(user.id))
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        return redirect(f"{frontend_url}/?token={jwt_token}")  # type: ignore[return-value]
    finally:
        db.close()
