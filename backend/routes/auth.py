import os
import secrets
from functools import wraps
from typing import Any, Callable

from flask import Blueprint, Response, jsonify, request

auth_bp = Blueprint("auth", __name__)

# Simple token storage (in production, use Redis or similar)
valid_tokens: set[str] = set()

APP_PASSWORD = os.getenv("APP_PASSWORD", "workout123")


def require_auth(f: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            if token in valid_tokens:
                return f(*args, **kwargs)
        return jsonify({"error": "Unauthorized"}), 401

    return decorated


@auth_bp.route("/auth", methods=["POST"])
def authenticate() -> tuple[Response, int] | Response:
    data = request.get_json() or {}
    password = data.get("password", "")

    if password == APP_PASSWORD:
        token = secrets.token_urlsafe(32)
        valid_tokens.add(token)
        return jsonify({"token": token})

    return jsonify({"error": "Invalid password"}), 401

