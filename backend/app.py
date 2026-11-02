import json
import os
import secrets
import threading
from datetime import datetime, timezone
from functools import wraps

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sock import Sock
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORIES_PATH = os.path.join(BASE_DIR, "stories.json")
USERS_PATH = os.path.join(BASE_DIR, "users.json")
SESSIONS_PATH = os.path.join(BASE_DIR, "sessions.json")
BOOKMARKS_PATH = os.path.join(BASE_DIR, "bookmarks.json")
BUILD_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "build"))

DATASET = {
    "id": "digital-divide",
    "title": "The Global Digital Divide",
    "subtitle": "Who got online between 2015 and 2022?",
    "metric": "internet_users",
    "metric_label": "Internet users (% of population)",
    "unit": "%",
    "source": "Illustrative demo dataset for storytelling (not an official statistical release).",
    "countries": ["India", "USA", "China", "Brazil", "Nigeria", "Japan"],
    "years": [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022],
}

# Plausible illustrative values for demos / portfolio storytelling.
RAW_VALUES = {
    "India": [27, 29, 32, 34, 36, 40, 43, 47],
    "USA": [74, 80, 84, 88, 89, 90, 91, 92],
    "China": [50, 53, 55, 57, 60, 65, 70, 73],
    "Brazil": [58, 60, 64, 67, 70, 74, 78, 81],
    "Nigeria": [21, 24, 27, 30, 33, 36, 39, 42],
    "Japan": [91, 92, 92, 93, 93, 93, 94, 94],
}

CHART_MODES = {"line", "bars"}

app = Flask(__name__, static_folder=BUILD_DIR, static_url_path="/")
CORS(app, supports_credentials=True)
sock = Sock(app)

lock = threading.Lock()
clients = set()


def now():
    return datetime.now(timezone.utc).isoformat()


def build_data():
    rows = []
    for country, values in RAW_VALUES.items():
        for year, value in zip(DATASET["years"], values):
            rows.append(
                {
                    "country": country,
                    "year": year,
                    "metric": DATASET["metric"],
                    "value": value,
                }
            )
    return rows


data = build_data()


def read_json(path, fallback):
    if not os.path.exists(path):
        return fallback
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return fallback


def write_json(path, payload):
    tmp_path = path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    os.replace(tmp_path, path)


def public_user(user):
    return {"id": user["id"], "name": user["name"], "email": user["email"]}


def compute_insights(rows):
    by_country = {}
    for row in rows:
        by_country.setdefault(row["country"], []).append(row)
    gains = []
    latest = []
    for country, points in by_country.items():
        ordered = sorted(points, key=lambda item: item["year"])
        start, end = ordered[0], ordered[-1]
        gains.append(
            {
                "country": country,
                "start_year": start["year"],
                "end_year": end["year"],
                "start_value": start["value"],
                "end_value": end["value"],
                "gain": round(end["value"] - start["value"], 1),
            }
        )
        latest.append({"country": country, "year": end["year"], "value": end["value"]})
    gains.sort(key=lambda item: item["gain"], reverse=True)
    latest.sort(key=lambda item: item["value"], reverse=True)
    gap = round(latest[0]["value"] - latest[-1]["value"], 1) if latest else 0
    return {
        "fastest_climber": gains[0] if gains else None,
        "highest_access": latest[0] if latest else None,
        "lowest_access": latest[-1] if latest else None,
        "latest_gap": gap,
        "gains": gains,
        "latest": latest,
    }


def normalize_chapter(raw, index):
    if not isinstance(raw, dict):
        return None
    title = raw.get("title")
    body = raw.get("body") or raw.get("content")
    if not isinstance(title, str) or not title.strip():
        return None
    if not isinstance(body, str) or not body.strip():
        return None
    chart = raw.get("chart") if isinstance(raw.get("chart"), dict) else {}
    mode = chart.get("mode", "line")
    if mode not in CHART_MODES:
        mode = "line"
    focus = chart.get("focus_countries", [])
    if not isinstance(focus, list):
        focus = []
    focus = [c for c in focus if c in DATASET["countries"]]
    year = chart.get("year")
    if year not in DATASET["years"]:
        year = DATASET["years"][-1] if mode == "bars" else None
    return {
        "id": index + 1,
        "title": title.strip()[:120],
        "body": body.strip()[:4000],
        "chart": {
            "mode": mode,
            "focus_countries": focus,
            "year": year,
        },
    }


def normalize_story(item):
    if not isinstance(item, dict) or not isinstance(item.get("id"), int):
        return None
    title = item.get("title")
    summary = item.get("summary")
    if not isinstance(title, str) or not title.strip():
        return None
    if not isinstance(summary, str):
        summary = ""
    tags = item.get("tags") if isinstance(item.get("tags"), list) else []
    tags = [str(tag).strip()[:32] for tag in tags if str(tag).strip()][:6]
    chapters_raw = item.get("chapters")
    if not isinstance(chapters_raw, list) or not chapters_raw:
        # Migrate old flat stories into a single chapter.
        body = item.get("content") if isinstance(item.get("content"), str) else summary
        focus = item.get("focus_countries") if isinstance(item.get("focus_countries"), list) else []
        chapters_raw = [
            {
                "title": "The story",
                "body": body or summary or title,
                "chart": {"mode": "line", "focus_countries": focus, "year": None},
            }
        ]
    chapters = []
    for index, chapter in enumerate(chapters_raw[:8]):
        cleaned = normalize_chapter(chapter, index)
        if cleaned:
            chapters.append(cleaned)
    if not chapters:
        return None
    created = item.get("created_at") if isinstance(item.get("created_at"), str) else now()
    updated = item.get("updated_at") if isinstance(item.get("updated_at"), str) else created
    return {
        "id": item["id"],
        "title": title.strip()[:160],
        "summary": summary.strip()[:280],
        "tags": tags,
        "chapters": chapters,
        "author_id": item.get("author_id") if isinstance(item.get("author_id"), int) else None,
        "author_name": item.get("author_name") if isinstance(item.get("author_name"), str) else "Editorial",
        "featured": bool(item.get("featured")),
        "created_at": created,
        "updated_at": updated,
    }


def demo_stories():
    timestamp = now()
    return [
        {
            "id": 1,
            "title": "Who got online first?",
            "summary": "A guided tour of internet access across six countries — from near-universal Japan to fast-climbing India and Nigeria.",
            "tags": ["overview", "access", "guided"],
            "featured": True,
            "author_id": None,
            "author_name": "Editorial",
            "created_at": timestamp,
            "updated_at": timestamp,
            "chapters": [
                {
                    "title": "Start with the big picture",
                    "body": (
                        "This dataset tracks the share of people online in six countries from 2015 to 2022. "
                        "The chart begins with every country visible so you can feel the spread at a glance.\n\n"
                        "Notice Japan and the USA sit near the top. India and Nigeria start much lower. "
                        "That gap is the digital divide — and this story is about how it moved."
                    ),
                    "chart": {"mode": "line", "focus_countries": [], "year": None},
                },
                {
                    "title": "The leaders barely need to climb",
                    "body": (
                        "Japan was already above 90% in 2015. The USA was high too and edged toward 92%. "
                        "When almost everyone is online, the line looks flat — not because nothing happened, "
                        "but because the hard growth already happened earlier.\n\n"
                        "Click the highlighted countries or hover the points to read exact values."
                    ),
                    "chart": {"mode": "line", "focus_countries": ["Japan", "USA"], "year": None},
                },
                {
                    "title": "The climbers tell a different story",
                    "body": (
                        "India and Nigeria start lower, so every new year of access is more visible. "
                        "India rises from 27% to 47%. Nigeria climbs from 21% to 42%.\n\n"
                        "Those slopes matter: they show places where connectivity is still being built, "
                        "not just maintained."
                    ),
                    "chart": {"mode": "line", "focus_countries": ["India", "Nigeria"], "year": None},
                },
                {
                    "title": "Compare one year side by side",
                    "body": (
                        "Switch to a 2022 snapshot. Bars make the ranking obvious: Japan and the USA lead, "
                        "Brazil and China sit in the middle, India and Nigeria are still catching up.\n\n"
                        "A good data story uses more than one chart. Trends show change. Bars show position."
                    ),
                    "chart": {"mode": "bars", "focus_countries": [], "year": 2022},
                },
            ],
        },
        {
            "id": 2,
            "title": "India's climb",
            "summary": "Follow one country through eight years of growth and see why a steep line can matter more than a high starting point.",
            "tags": ["India", "growth"],
            "featured": True,
            "author_id": None,
            "author_name": "Editorial",
            "created_at": timestamp,
            "updated_at": timestamp,
            "chapters": [
                {
                    "title": "Begin lower, rise faster",
                    "body": (
                        "In 2015 only about 27% of people in India were online. By 2022 that share reaches 47%. "
                        "That is a 20-point climb — one of the largest gains in this dataset."
                    ),
                    "chart": {"mode": "line", "focus_countries": ["India"], "year": None},
                },
                {
                    "title": "Still room to grow",
                    "body": (
                        "Even after the climb, India sits below Brazil, China, the USA, and Japan in 2022. "
                        "The story is unfinished: access improved quickly, but the gap has not closed."
                    ),
                    "chart": {"mode": "bars", "focus_countries": ["India"], "year": 2022},
                },
            ],
        },
        {
            "id": 3,
            "title": "Bunny and the glowing tunnels",
            "summary": "A kid-friendly retelling of the same dataset — each bunny is a country, and the tunnels are internet access.",
            "tags": ["kids", "metaphor", "playful"],
            "featured": False,
            "author_id": None,
            "author_name": "Editorial",
            "created_at": timestamp,
            "updated_at": timestamp,
            "chapters": [
                {
                    "title": "Meet the tunnel bunnies",
                    "body": (
                        "Once upon a time, six bunny villages dug glowing internet tunnels. "
                        "Some villages already had bright tunnels. Others were still digging.\n\n"
                        "The chart shows every village at once. The higher the line, the brighter the tunnel."
                    ),
                    "chart": {"mode": "line", "focus_countries": [], "year": None},
                },
                {
                    "title": "India Bunny digs faster",
                    "body": (
                        "India Bunny starts with a short tunnel, then digs year after year. "
                        "Watch only India light up. Each hop upward is more of the village getting online."
                    ),
                    "chart": {"mode": "line", "focus_countries": ["India"], "year": None},
                },
                {
                    "title": "Race day in 2022",
                    "body": (
                        "On race day the bunnies line up as bars. Japan Bunny stands tallest. "
                        "Nigeria Bunny and India Bunny are still shorter — but they dug the farthest this decade.\n\n"
                        "Hover a bar to see the exact glow percentage!"
                    ),
                    "chart": {"mode": "bars", "focus_countries": ["India", "Nigeria", "Japan"], "year": 2022},
                },
            ],
        },
    ]


def load_users():
    raw = read_json(USERS_PATH, [])
    if not isinstance(raw, list):
        return []
    cleaned = []
    for item in raw:
        if not isinstance(item, dict) or not isinstance(item.get("id"), int):
            continue
        if not all(isinstance(item.get(key), str) for key in ("name", "email", "password_hash")):
            continue
        cleaned.append(
            {
                "id": item["id"],
                "name": item["name"],
                "email": item["email"].lower(),
                "password_hash": item["password_hash"],
                "created_at": item.get("created_at") if isinstance(item.get("created_at"), str) else now(),
            }
        )
    return cleaned


def load_sessions():
    raw = read_json(SESSIONS_PATH, {})
    return raw if isinstance(raw, dict) else {}


def load_bookmarks():
    raw = read_json(BOOKMARKS_PATH, {})
    return raw if isinstance(raw, dict) else {}


def load_stories():
    raw = read_json(STORIES_PATH, None)
    if raw is None:
        seeded = demo_stories()
        write_json(STORIES_PATH, seeded)
        return [normalize_story(item) for item in seeded]
    if not isinstance(raw, list):
        return []
    cleaned = []
    for item in raw:
        story = normalize_story(item)
        if story:
            cleaned.append(story)
    if not cleaned:
        seeded = demo_stories()
        write_json(STORIES_PATH, seeded)
        return [normalize_story(item) for item in seeded]
    return cleaned


users = load_users()
sessions = load_sessions()
bookmarks = load_bookmarks()
stories = load_stories()


def save_users():
    write_json(USERS_PATH, users)


def save_sessions():
    write_json(SESSIONS_PATH, sessions)


def save_bookmarks():
    write_json(BOOKMARKS_PATH, bookmarks)


def save_stories():
    write_json(STORIES_PATH, stories)


def current_user():
    header = request.headers.get("Authorization", "")
    token = header[7:].strip() if header.startswith("Bearer ") else ""
    if not token:
        return None
    with lock:
        session = sessions.get(token)
        if not session:
            return None
        user = next((item for item in users if item["id"] == session.get("user_id")), None)
        return public_user(user) if user else None


def require_auth(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify({"error": "Please log in first."}), 401
        return view(user, *args, **kwargs)

    return wrapped


def validate_auth_payload(payload, require_name=False):
    if not isinstance(payload, dict):
        return None, "Expected a JSON object."
    email = payload.get("email")
    password = payload.get("password")
    name = payload.get("name")
    if not isinstance(email, str) or not email.strip() or "@" not in email:
        return None, "A valid email is required."
    if not isinstance(password, str) or len(password) < 4:
        return None, "Password must be at least 4 characters."
    fields = {"email": email.strip().lower(), "password": password}
    if require_name:
        if not isinstance(name, str) or not name.strip():
            return None, "Name is required."
        fields["name"] = name.strip()[:80]
    return fields, None


def validate_story_payload(payload):
    if not isinstance(payload, dict):
        return None, "Expected a JSON object."
    title = payload.get("title")
    summary = payload.get("summary", "")
    tags = payload.get("tags", [])
    chapters = payload.get("chapters")
    if not isinstance(title, str) or not title.strip():
        return None, "Title is required."
    if not isinstance(summary, str):
        return None, "Summary must be text."
    if not isinstance(tags, list):
        return None, "Tags must be a list."
    if not isinstance(chapters, list) or not chapters:
        return None, "Add at least one chapter."
    cleaned_chapters = []
    for index, chapter in enumerate(chapters[:8]):
        item = normalize_chapter(chapter, index)
        if not item:
            return None, f"Chapter {index + 1} needs a title and body."
        cleaned_chapters.append(item)
    return {
        "title": title.strip()[:160],
        "summary": summary.strip()[:280],
        "tags": [str(tag).strip()[:32] for tag in tags if str(tag).strip()][:6],
        "chapters": cleaned_chapters,
    }, None


def broadcast(message):
    raw = json.dumps(message)
    with lock:
        current = list(clients)
    dead = []
    for client in current:
        try:
            client.send(raw)
        except Exception:
            dead.append(client)
    if dead:
        with lock:
            for client in dead:
                clients.discard(client)


def user_bookmark_ids(user_id):
    key = str(user_id)
    ids = bookmarks.get(key, [])
    return ids if isinstance(ids, list) else []


@app.route("/api/auth/signup", methods=["POST"])
def signup():
    fields, error = validate_auth_payload(request.get_json(silent=True), require_name=True)
    if error:
        return jsonify({"error": error}), 400
    with lock:
        if any(user["email"] == fields["email"] for user in users):
            return jsonify({"error": "An account with that email already exists."}), 409
        user = {
            "id": max((item["id"] for item in users), default=0) + 1,
            "name": fields["name"],
            "email": fields["email"],
            "password_hash": generate_password_hash(fields["password"]),
            "created_at": now(),
        }
        users.append(user)
        save_users()
        token = secrets.token_urlsafe(32)
        sessions[token] = {"user_id": user["id"], "created_at": now()}
        save_sessions()
        profile = public_user(user)
    return jsonify({"token": token, "user": profile}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    fields, error = validate_auth_payload(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400
    with lock:
        user = next((item for item in users if item["email"] == fields["email"]), None)
        if not user or not check_password_hash(user["password_hash"], fields["password"]):
            return jsonify({"error": "Email or password is incorrect."}), 401
        token = secrets.token_urlsafe(32)
        sessions[token] = {"user_id": user["id"], "created_at": now()}
        save_sessions()
        profile = public_user(user)
    return jsonify({"token": token, "user": profile})


@app.route("/api/auth/me")
@require_auth
def me(user):
    return jsonify({"user": user})


@app.route("/api/auth/logout", methods=["POST"])
@require_auth
def logout(user):
    header = request.headers.get("Authorization", "")
    token = header[7:].strip() if header.startswith("Bearer ") else ""
    with lock:
        sessions.pop(token, None)
        save_sessions()
    return jsonify({"ok": True})


@app.route("/api/dataset")
@require_auth
def dataset(user):
    return jsonify({**DATASET, "insights": compute_insights(data)})


@app.route("/api/data")
@require_auth
def get_data(user):
    return jsonify(data)


@app.route("/api/stories", methods=["GET", "POST"])
@require_auth
def story_list(user):
    if request.method == "GET":
        with lock:
            saved = set(user_bookmark_ids(user["id"]))
            payload = [{**story, "bookmarked": story["id"] in saved} for story in stories]
        return jsonify(payload)

    fields, error = validate_story_payload(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400
    timestamp = now()
    with lock:
        next_id = max((item["id"] for item in stories), default=0) + 1
        story = {
            "id": next_id,
            **fields,
            "author_id": user["id"],
            "author_name": user["name"],
            "featured": False,
            "created_at": timestamp,
            "updated_at": timestamp,
        }
        stories.append(story)
        save_stories()
        snapshot = {**story, "bookmarked": False}
    broadcast({"type": "story_created", "story": snapshot})
    return jsonify(snapshot), 201


@app.route("/api/stories/<int:story_id>", methods=["GET", "PUT"])
@require_auth
def story_detail(user, story_id):
    with lock:
        story = next((item for item in stories if item["id"] == story_id), None)
        if not story:
            return jsonify({"error": "Story not found."}), 404
        bookmarked = story_id in user_bookmark_ids(user["id"])
        if request.method == "GET":
            return jsonify({**story, "bookmarked": bookmarked})

    fields, error = validate_story_payload(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400

    with lock:
        for item in stories:
            if item["id"] != story_id:
                continue
            if item.get("author_id") is None:
                return jsonify({"error": "Editorial stories are read-only."}), 403
            if item.get("author_id") != user["id"]:
                return jsonify({"error": "You can only edit your own stories."}), 403
            item.update(fields)
            item["updated_at"] = now()
            save_stories()
            snapshot = {**item, "bookmarked": story_id in user_bookmark_ids(user["id"])}
            break
        else:
            return jsonify({"error": "Story not found."}), 404

    broadcast({"type": "story_updated", "story": snapshot})
    return jsonify(snapshot)


@app.route("/api/bookmarks/<int:story_id>", methods=["POST", "DELETE"])
@require_auth
def bookmark_story(user, story_id):
    with lock:
        if not any(story["id"] == story_id for story in stories):
            return jsonify({"error": "Story not found."}), 404
        key = str(user["id"])
        current = list(user_bookmark_ids(user["id"]))
        if request.method == "POST":
            if story_id not in current:
                current.append(story_id)
        else:
            current = [item for item in current if item != story_id]
        bookmarks[key] = current
        save_bookmarks()
    return jsonify({"story_id": story_id, "bookmarked": request.method == "POST"})


@sock.route("/ws")
def live_updates(ws):
    with lock:
        clients.add(ws)
    try:
        while True:
            message = ws.receive()
            if message is None:
                break
    finally:
        with lock:
            clients.discard(ws)


@app.route("/")
def index():
    index_path = os.path.join(BUILD_DIR, "index.html")
    if os.path.exists(index_path):
        return app.send_static_file("index.html")
    return jsonify(
        {
            "message": "API is running. Start the frontend with npm start, or build it into frontend/build."
        }
    )


if __name__ == "__main__":
    app.run(port=5000, threaded=True)
