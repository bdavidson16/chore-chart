"""Data layer for the Chore Chart Streamlit app.

Ports the behaviour sketched in `components/`:
  * `components/chores/chore_list.jsx`   -> assignment listing, priority/due-date sorting, assign-to-user
  * `components/chores/chore_details.jsx` -> per-chore detail fields (frequency, points, last completed)
  * `components/points/PointHelpers.jsx` -> `calculate_points` and the point bar values
  * `components/points/rewards.json`     -> reward tiers (bronze/silver/gold)
  * `components/users/notify_user.jsx`    -> notification feed behind the bell
  * `components/hardcorded_data.json`     -> seed data for a fresh database
"""

import json
import sqlite3
from datetime import date, datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).parent / "chore_chart.db"
COMPONENTS = Path(__file__).parent / "components"

# PointHelpers.jsx: daily 10, weekly 5, monthly 2. Biweekly/one-time fill the gaps
# left by the sketch so every frequency the UI offers can be scored.
BASE_POINTS = {
    "daily": 10,
    "weekly": 5,
    "biweekly": 3,
    "monthly": 2,
    "one-time": 1,
}
MAX_STREAK_DAYS = 30  # PointHelpers.jsx caps the day multiplier at 30

FREQUENCIES = ["Daily", "Weekly", "Biweekly", "Monthly", "One-time"]
PRIORITIES = ["High", "Medium", "Low"]
STATUSES = ["Pending", "In Progress", "Done"]

# chore_list.jsx sortChoresByPriority; 'Normal' is the legacy value already in the db.
PRIORITY_ORDER = {"high": 1, "medium": 2, "normal": 2, "low": 3}


# -----------------------------
# Connection / schema
# -----------------------------

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                email TEXT,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                frequency TEXT NOT NULL DEFAULT 'One-time',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chore_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                due_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending',
                priority TEXT NOT NULL DEFAULT 'Medium',
                last_update TEXT,
                completed_at TEXT,
                notified_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS updates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assignment_id INTEGER NOT NULL,
                update_text TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
            );

            -- Point ledger: one row per points award, so reopening a chore can
            -- take the points back (PointHelpers.removePointsAnimation).
            CREATE TABLE IF NOT EXISTS points_ledger (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                assignment_id INTEGER,
                points INTEGER NOT NULL,
                reason TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                assignment_id INTEGER,
                message TEXT NOT NULL,
                read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
    seed_if_empty()


HARDCODED_DATA = COMPONENTS / "hardcorded_data.json"


def read_hardcoded_data():
    """The raw contents of components/hardcorded_data.json, or None if unusable."""
    if not HARDCODED_DATA.exists():
        return None
    try:
        return json.loads(HARDCODED_DATA.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def load_hardcoded_data(create_missing_users=True, default_frequency="Weekly"):
    """Import components/hardcorded_data.json into the SQLite database.

    Additive and safe to run repeatedly: users match on name, chores on title and
    assignments on (chore, user, due date), so nothing is duplicated or
    overwritten. The file has no frequency, so chores get `default_frequency`.

    The file's `assigned_to` names (Alice, Bob, Charlie) are not in its own
    `users` list; with `create_missing_users` they are added as users so the
    assignments can be created, otherwise those chores are imported unassigned.

    Returns a summary dict of what changed.
    """
    summary = {
        "users_added": 0,
        "chores_added": 0,
        "assignments_added": 0,
        "skipped": 0,
        "notes": [],
    }

    seed = read_hardcoded_data()
    if seed is None:
        summary["notes"].append(f"Could not read {HARDCODED_DATA.name}.")
        return summary

    with get_conn() as conn:

        def user_id_for(name):
            row = conn.execute("SELECT id FROM users WHERE name = ?", (name,)).fetchone()
            return row["id"] if row else None

        for user in seed.get("users", []):
            name = (user.get("name") or "").strip()
            if not name:
                continue
            cur = conn.execute(
                "INSERT OR IGNORE INTO users (name, email) VALUES (?, ?)",
                (name, user.get("email")),
            )
            if cur.rowcount:
                summary["users_added"] += 1
            else:
                summary["skipped"] += 1

        for chore in seed.get("chores", []):
            title = (chore.get("name") or "").strip()
            if not title:
                continue

            existing = conn.execute(
                "SELECT id FROM chores WHERE title = ?", (title,)
            ).fetchone()
            if existing:
                chore_id = existing["id"]
                summary["skipped"] += 1
            else:
                chore_id = conn.execute(
                    "INSERT INTO chores (title, description, frequency) VALUES (?, ?, ?)",
                    (title, chore.get("description", ""), default_frequency),
                ).lastrowid
                summary["chores_added"] += 1

            assignee = (chore.get("assigned_to") or "").strip()
            if not assignee:
                continue

            user_id = user_id_for(assignee)
            if user_id is None:
                if not create_missing_users:
                    summary["notes"].append(f"No user named {assignee}; {title} left unassigned.")
                    summary["skipped"] += 1
                    continue
                conn.execute("INSERT INTO users (name) VALUES (?)", (assignee,))
                user_id = user_id_for(assignee)
                summary["users_added"] += 1
                summary["notes"].append(f"Added {assignee} as a user for {title}.")

            due_date = to_iso_date(chore.get("due_date")) or date.today().isoformat()
            duplicate = conn.execute(
                "SELECT id FROM assignments WHERE chore_id = ? AND user_id = ? AND due_date = ?",
                (chore_id, user_id, due_date),
            ).fetchone()
            if duplicate:
                summary["skipped"] += 1
                continue

            conn.execute(
                "INSERT INTO assignments (chore_id, user_id, due_date, priority)"
                " VALUES (?, ?, ?, 'Medium')",
                (chore_id, user_id, due_date),
            )
            summary["assignments_added"] += 1

    return summary


def seed_if_empty():
    """Load the hardcoded data automatically when there is nothing to show yet."""
    with get_conn() as conn:
        has_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        has_chores = conn.execute("SELECT COUNT(*) FROM chores").fetchone()[0]
    if has_users and has_chores:
        return
    load_hardcoded_data()


def _run(query, params=()):
    with get_conn() as conn:
        cur = conn.execute(query, params)
        conn.commit()
        return cur.lastrowid


def _rows(query, params=()):
    with get_conn() as conn:
        return [dict(row) for row in conn.execute(query, params)]


def _now():
    return datetime.now().isoformat(timespec="seconds")


def to_iso_date(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)[:10]


def parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


# -----------------------------
# Users & chores
# -----------------------------

def get_users(active_only=True):
    where = "WHERE active = 1" if active_only else ""
    return _rows(f"SELECT id, name, email FROM users {where} ORDER BY name")


def add_user(name, email=None):
    return _run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        (name.strip(), (email or "").strip() or None),
    )


def get_chores(active_only=True):
    where = "WHERE active = 1" if active_only else ""
    return _rows(
        f"""
        SELECT c.id, c.title, c.description, c.frequency,
               (SELECT MAX(a.completed_at) FROM assignments a
                 WHERE a.chore_id = c.id AND a.status = 'Done') AS last_completed,
               (SELECT COUNT(*) FROM assignments a
                 WHERE a.chore_id = c.id AND a.status != 'Done') AS open_assignments
        FROM chores c {where}
        ORDER BY c.title
        """
    )


def add_chore(title, description, frequency):
    return _run(
        "INSERT INTO chores (title, description, frequency) VALUES (?, ?, ?)",
        (title.strip(), (description or "").strip(), frequency),
    )


def get_unassigned_chores():
    """Chores with no open assignment — the '+' rows in chore_list.jsx."""
    return [c for c in get_chores() if not c["open_assignments"]]


# -----------------------------
# Assignments
# -----------------------------

ASSIGNMENT_SELECT = """
    SELECT
        a.id,
        a.chore_id,
        a.user_id,
        c.title AS chore,
        c.description,
        c.frequency,
        u.name AS assigned_to,
        u.email,
        a.due_date,
        a.status,
        a.priority,
        a.last_update,
        a.completed_at,
        (a.status = 'Done') AS completed,
        (SELECT MAX(x.completed_at) FROM assignments x
          WHERE x.chore_id = a.chore_id AND x.status = 'Done' AND x.id != a.id
        ) AS chore_last_completed,
        (SELECT SUM(p.points) FROM points_ledger p WHERE p.assignment_id = a.id) AS points_awarded,
        CASE
            WHEN a.status = 'Done' THEN 'Completed'
            WHEN date(a.due_date) < date('now') THEN 'Past due'
            WHEN date(a.due_date) <= date('now', '+2 day') THEN 'Due soon'
            ELSE 'Upcoming'
        END AS due_state
    FROM assignments a
    JOIN chores c ON c.id = a.chore_id
    JOIN users u ON u.id = a.user_id
"""


def get_assignments(status="All", user_id=None, chore_query="", sort_by="Priority"):
    """chore_list.jsx: sortChoresByPriority / sortChoresByDueDate plus the
    filterChoresByCompletion / filterChoresByAssignedUser filters."""
    clauses, params = [], []

    if status == "Open":
        clauses.append("a.status != 'Done'")
    elif status != "All":
        clauses.append("a.status = ?")
        params.append(status)

    if user_id:
        clauses.append("a.user_id = ?")
        params.append(user_id)

    if chore_query:
        clauses.append("LOWER(c.title) LIKE ?")
        params.append(f"%{chore_query.lower()}%")

    query = ASSIGNMENT_SELECT
    if clauses:
        query += " WHERE " + " AND ".join(clauses)

    rows = _rows(query, tuple(params))

    def priority_key(row):
        return PRIORITY_ORDER.get((row["priority"] or "").lower(), 99)

    def due_key(row):
        return parse_date(row["due_date"]) or date.max

    if sort_by == "Priority":
        rows.sort(key=lambda r: (r["status"] == "Done", priority_key(r), due_key(r)))
    elif sort_by == "Due date":
        rows.sort(key=lambda r: (r["status"] == "Done", due_key(r), priority_key(r)))
    else:  # Assigned user
        rows.sort(key=lambda r: (r["assigned_to"].lower(), due_key(r)))

    return rows


def get_assignment(assignment_id):
    rows = _rows(ASSIGNMENT_SELECT + " WHERE a.id = ?", (assignment_id,))
    return rows[0] if rows else None


def assign_chore(chore_id, user_id, due_date, priority="Medium"):
    """The '+' action: assign a chore and notify the user (notify_user.jsx)."""
    assignment_id = _run(
        "INSERT INTO assignments (chore_id, user_id, due_date, priority) VALUES (?, ?, ?, ?)",
        (chore_id, user_id, to_iso_date(due_date), priority),
    )
    chore = _rows("SELECT title FROM chores WHERE id = ?", (chore_id,))
    title = chore[0]["title"] if chore else "a chore"
    notify_user(user_id, f"You have been assigned the chore: {title}", assignment_id)
    return assignment_id


def set_status(assignment_id, status):
    _run("UPDATE assignments SET status = ? WHERE id = ?", (status, assignment_id))


def update_assignment(assignment_id, due_date=None, priority=None, user_id=None):
    fields, params = [], []
    if due_date is not None:
        fields.append("due_date = ?")
        params.append(to_iso_date(due_date))
    if priority is not None:
        fields.append("priority = ?")
        params.append(priority)
    if user_id is not None:
        fields.append("user_id = ?")
        params.append(user_id)
    if not fields:
        return
    params.append(assignment_id)
    _run(f"UPDATE assignments SET {', '.join(fields)} WHERE id = ?", tuple(params))


def delete_assignment(assignment_id):
    _run("DELETE FROM points_ledger WHERE assignment_id = ?", (assignment_id,))
    _run("DELETE FROM assignments WHERE id = ?", (assignment_id,))


def add_update(assignment_id, text):
    text = text.strip()
    _run(
        "INSERT INTO updates (assignment_id, update_text) VALUES (?, ?)",
        (assignment_id, text),
    )
    _run("UPDATE assignments SET last_update = ? WHERE id = ?", (text, assignment_id))


def get_updates(assignment_id):
    return _rows(
        """
        SELECT update_text, created_at FROM updates
        WHERE assignment_id = ? ORDER BY datetime(created_at) DESC
        """,
        (assignment_id,),
    )


# -----------------------------
# Points (PointHelpers.jsx)
# -----------------------------

def calculate_points(frequency, last_completed):
    """Base points for the frequency times days since the chore was last done,
    capped at 30 days. A chore done twice in one day still scores its base
    points once (the JS version would have scored 0)."""
    base = BASE_POINTS.get((frequency or "").lower(), 0)
    if not base:
        return 0

    last = parse_date(last_completed)
    days = 1 if last is None else (date.today() - last).days
    return base * max(1, min(days, MAX_STREAK_DAYS))


def complete_assignment(assignment_id):
    """Mark done and award points. Returns (points, chore_title)."""
    row = get_assignment(assignment_id)
    if row is None:
        return 0, None

    points = calculate_points(row["frequency"], row["chore_last_completed"])

    _run(
        "UPDATE assignments SET status = 'Done', completed_at = ? WHERE id = ?",
        (_now(), assignment_id),
    )
    _run("DELETE FROM points_ledger WHERE assignment_id = ?", (assignment_id,))
    if points:
        _run(
            "INSERT INTO points_ledger (user_id, assignment_id, points, reason)"
            " VALUES (?, ?, ?, ?)",
            (row["user_id"], assignment_id, points, f"Completed {row['chore']}"),
        )
    notify_user(
        row["user_id"],
        f"{row['assigned_to']} completed {row['chore']} (+{points} points)",
        assignment_id,
    )
    return points, row["chore"]


def reopen_assignment(assignment_id):
    """Reopen and claw the points back (removePointsAnimation). Returns points removed."""
    row = get_assignment(assignment_id)
    if row is None:
        return 0

    removed = row["points_awarded"] or 0
    _run("DELETE FROM points_ledger WHERE assignment_id = ?", (assignment_id,))
    _run(
        "UPDATE assignments SET status = 'Pending', completed_at = NULL WHERE id = ?",
        (assignment_id,),
    )
    return removed


def _reward_tiers():
    """Reward thresholds from components/points/rewards.json."""
    default = {
        "bronze": {"title": "Bronze Reward", "threshold": 10},
        "silver": {"title": "Silver Reward", "threshold": 25},
        "gold": {"title": "Gold Reward", "threshold": 50},
    }
    rewards_file = COMPONENTS / "points" / "rewards.json"
    if not rewards_file.exists():
        return default

    try:
        rewards = json.loads(rewards_file.read_text()).get("user_rewards", {})
    except (json.JSONDecodeError, OSError):
        return default

    tiers = {}
    for key, meta in rewards.items():
        fallback = default.get(key, {}).get("threshold", 0)
        digits = [int(w) for w in meta.get("description", "").split() if w.isdigit()]
        tiers[key] = {
            "title": meta.get("title", key.title()),
            "description": meta.get("description", ""),
            "threshold": digits[0] if digits else fallback,
        }
    return dict(sorted(tiers.items(), key=lambda kv: kv[1]["threshold"])) or default


REWARD_TIERS = None


def reward_tiers():
    global REWARD_TIERS
    if REWARD_TIERS is None:
        REWARD_TIERS = _reward_tiers()
    return REWARD_TIERS


def get_user_progress():
    """Point bar data per user: total points, chores completed, reward tier."""
    rows = _rows(
        """
        SELECT u.id, u.name,
               COALESCE((SELECT SUM(p.points) FROM points_ledger p WHERE p.user_id = u.id), 0) AS points,
               (SELECT COUNT(*) FROM assignments a
                 WHERE a.user_id = u.id AND a.status = 'Done') AS completed,
               (SELECT COUNT(*) FROM assignments a
                 WHERE a.user_id = u.id AND a.status != 'Done') AS open_chores
        FROM users u WHERE u.active = 1 ORDER BY u.name
        """
    )

    tiers = list(reward_tiers().values())
    for row in rows:
        earned = [t for t in tiers if row["completed"] >= t["threshold"]]
        upcoming = [t for t in tiers if row["completed"] < t["threshold"]]
        row["tier"] = earned[-1]["title"] if earned else None
        row["next_tier"] = upcoming[0] if upcoming else None
        if row["next_tier"]:
            row["progress"] = min(1.0, row["completed"] / row["next_tier"]["threshold"])
        else:
            row["progress"] = 1.0
    return rows


def get_points_history(limit=25):
    return _rows(
        """
        SELECT p.points, p.reason, p.created_at, u.name AS user
        FROM points_ledger p JOIN users u ON u.id = p.user_id
        ORDER BY datetime(p.created_at) DESC LIMIT ?
        """,
        (limit,),
    )


# -----------------------------
# Notifications (notify_user.jsx)
# -----------------------------

def notify_user(user_id, message, assignment_id=None):
    _run(
        "INSERT INTO notifications (user_id, assignment_id, message) VALUES (?, ?, ?)",
        (user_id, assignment_id, message),
    )


def get_notifications(limit=20, unread_only=False):
    where = "WHERE n.read = 0" if unread_only else ""
    return _rows(
        f"""
        SELECT n.id, n.message, n.read, n.created_at, n.assignment_id, u.name AS user
        FROM notifications n LEFT JOIN users u ON u.id = n.user_id
        {where}
        ORDER BY datetime(n.created_at) DESC LIMIT ?
        """,
        (limit,),
    )


def unread_notification_count():
    return _rows("SELECT COUNT(*) AS n FROM notifications WHERE read = 0")[0]["n"]


def mark_notifications_read():
    _run("UPDATE notifications SET read = 1 WHERE read = 0")


# -----------------------------
# Calendar helpers (calendar.jsx)
# -----------------------------

def assignments_by_day(year, month, user_id=None, chore_query="", status="All"):
    """Map of date -> assignments due that day, for the calendar grid. Includes a
    few days of spill-over so the leading/trailing week cells are populated."""
    rows = get_assignments(
        status=status, user_id=user_id, chore_query=chore_query, sort_by="Due date"
    )

    start = date(year, month, 1) - timedelta(days=7)
    end = (date(year + (month == 12), month % 12 + 1, 1) - timedelta(days=1)) + timedelta(days=7)

    by_day = {}
    for row in rows:
        due = parse_date(row["due_date"])
        if due is None or due < start or due > end:
            continue
        by_day.setdefault(due, []).append(row)
    return by_day


if __name__ == "__main__":
    # python chore_data.py — create the schema and import the hardcoded data.
    init_db()
    result = load_hardcoded_data()
    print(
        f"Imported into {DB_PATH.name}: "
        f"{result['users_added']} user(s), {result['chores_added']} chore(s), "
        f"{result['assignments_added']} assignment(s); {result['skipped']} already present."
    )
    for note in result["notes"]:
        print(f"  - {note}")
