import sqlite3
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from pathlib import Path
import smtplib

import pandas as pd
import streamlit as st

DB_PATH = Path("chore_chart.db")


def get_conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
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
                priority TEXT NOT NULL DEFAULT 'Normal',
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
            """
        )


def run_query(query, params=(), fetch=False):
    with get_conn() as conn:
        cur = conn.execute(query, params)
        conn.commit()
        if fetch:
            return cur.fetchall()
    return None


def df_query(query, params=()):
    with get_conn() as conn:
        return pd.read_sql_query(query, conn, params=params)


def normalize_date(value):
    if pd.isna(value):
        return None
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, datetime):
        return value.date().isoformat()
    return pd.to_datetime(value).date().isoformat()


# -----------------------------
# CRUD helpers
# -----------------------------

def add_user(name, email):
    run_query(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        (name.strip(), email.strip() if email else None),
    )


def add_chore(title, description, frequency):
    run_query(
        "INSERT INTO chores (title, description, frequency) VALUES (?, ?, ?)",
        (title.strip(), description.strip(), frequency),
    )


def add_assignment(chore_id, user_id, due_date, priority):
    run_query(
        "INSERT INTO assignments (chore_id, user_id, due_date, priority) VALUES (?, ?, ?, ?)",
        (chore_id, user_id, normalize_date(due_date), priority),
    )


def add_update(assignment_id, update_text):
    run_query(
        "INSERT INTO updates (assignment_id, update_text) VALUES (?, ?)",
        (assignment_id, update_text.strip()),
    )
    run_query(
        "UPDATE assignments SET last_update = ? WHERE id = ?",
        (update_text.strip(), assignment_id),
    )


def mark_done(assignment_id):
    run_query(
        "UPDATE assignments SET status = 'Done', completed_at = ? WHERE id = ?",
        (datetime.now().isoformat(timespec="seconds"), assignment_id),
    )


def reopen_assignment(assignment_id):
    run_query(
        "UPDATE assignments SET status = 'Pending', completed_at = NULL WHERE id = ?",
        (assignment_id,),
    )


def delete_assignment(assignment_id):
    run_query("DELETE FROM assignments WHERE id = ?", (assignment_id,))


def get_users(active_only=True):
    where = "WHERE active = 1" if active_only else ""
    rows = run_query(f"SELECT id, name, email FROM users {where} ORDER BY name", fetch=True)
    return [dict(row) for row in rows] if rows else []


def get_chores(active_only=True):
    where = "WHERE active = 1" if active_only else ""
    rows = run_query(f"SELECT id, title, description, frequency FROM chores {where} ORDER BY title", fetch=True)
    return [dict(row) for row in rows] if rows else []


def get_assignments(status_filter="All"):
    query = """
        SELECT
            a.id,
            c.title AS chore,
            c.description,
            u.name AS assigned_to,
            u.email,
            a.due_date,
            a.status,
            a.priority,
            a.last_update,
            a.completed_at,
            a.notified_at,
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

    params = ()
    if status_filter != "All":
        query += " WHERE a.status = ?"
        params = (status_filter,)

    query += """
        ORDER BY
            CASE
                WHEN a.status = 'Done' THEN 4
                WHEN date(a.due_date) < date('now') THEN 1
                WHEN date(a.due_date) <= date('now', '+2 day') THEN 2
                ELSE 3
            END,
            date(a.due_date) ASC
    """

    return df_query(query, params)


def get_assignment_updates(assignment_id):
    df = df_query(
        """
        SELECT update_text, created_at
        FROM updates
        WHERE assignment_id = ?
        ORDER BY datetime(created_at) DESC
        """,
        (assignment_id,),
    )
    return df


# -----------------------------
# Email notifications
# -----------------------------

def send_email_notification(to_email, subject, body):
    if "email" not in st.secrets:
        return False, "Email secrets are not configured."

    cfg = st.secrets["email"]

    msg = EmailMessage()
    msg["From"] = cfg["from_email"]
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(cfg["smtp_host"], int(cfg["smtp_port"])) as smtp:
            smtp.starttls()
            smtp.login(cfg["username"], cfg["password"])
            smtp.send_message(msg)
        return True, "Notification sent."
    except Exception as exc:
        return False, str(exc)


def notify_due_soon(assignments_df):
    due_soon = assignments_df[
        (assignments_df["due_state"].isin(["Due soon", "Past due"]))
        & (assignments_df["status"] != "Done")
    ]

    if due_soon.empty:
        return

    st.toast(f"{len(due_soon)} chore(s) are due soon or past due.", icon="⏰")

    with st.expander("Due soon / past due reminders", expanded=True):
        for _, row in due_soon.iterrows():
            icon = "🚨" if row["due_state"] == "Past due" else "⏰"
            st.warning(
                f"{icon} **{row['chore']}** assigned to **{row['assigned_to']}** is **{row['due_state'].lower()}**. Due: {row['due_date']}"
            )


def main():
    st.set_page_config(page_title="Chore Chart", page_icon="🧹", layout="wide")
    init_db()

    st.title("🧹 Chore Chart")
    st.caption("Track chores by user, due date, status, notes, and overdue reminders.")

    assignments = get_assignments()
    notify_due_soon(assignments)

    tab_dashboard, tab_add, tab_assign, tab_updates, tab_notify = st.tabs(
        [
            "Dashboard",
            "Add users & chores",
            "Assign chores",
            "Updates & completion",
            "Email notifications",
        ]
    )

    with tab_dashboard:
        st.subheader("Dashboard")

        status_filter = st.selectbox(
            "Filter by status",
            ["All", "Pending", "In Progress", "Done"],
            key="dashboard_status_filter",
        )

        df = get_assignments(status_filter)

        col1, col2, col3, col4 = st.columns(4)
        pending_count = len(df[df["status"] == "Pending"]) if not df.empty else 0
        in_progress_count = len(df[df["status"] == "In Progress"]) if not df.empty else 0
        done_count = len(df[df["status"] == "Done"]) if not df.empty else 0
        past_due_count = len(df[df["due_state"] == "Past due"]) if not df.empty else 0

        col1.metric("Pending", pending_count)
        col2.metric("In progress", in_progress_count)
        col3.metric("Done", done_count)
        col4.metric("Past due", past_due_count)

        if df.empty:
            st.info("No assignments yet. Add users, chores, and assign tasks.")
        else:
            def style_due_state(row):
                if row["due_state"] == "Past due":
                    return ["background-color: #ffe5e5"] * len(row)
                if row["due_state"] == "Due soon":
                    return ["background-color: #fff5cc"] * len(row)
                if row["due_state"] == "Completed":
                    return ["background-color: #e7f7e7"] * len(row)
                return [""] * len(row)

            visible = [
                "id",
                "chore",
                "assigned_to",
                "email",
                "due_date",
                "status",
                "priority",
                "due_state",
                "last_update",
                "completed_at",
            ]
            st.dataframe(df[visible].style.apply(style_due_state, axis=1), use_container_width=True, hide_index=True)

            with st.expander("Quick edit assignment table", expanded=False):
                quick_edit = df[
                    ["id", "chore", "assigned_to", "due_date", "status", "priority"]
                ].copy()
                edited = st.data_editor(
                    quick_edit,
                    num_rows="fixed",
                    use_container_width=True,
                    hide_index=True,
                    disabled=["id", "chore", "assigned_to"],
                )
                if st.button("Save table edits"):
                    updates = []
                    for original, new in zip(quick_edit.to_dict("records"), edited.to_dict("records")):
                        if original != new:
                            updates.append(new)
                    for row in updates:
                        run_query(
                            "UPDATE assignments SET due_date = ?, status = ?, priority = ? WHERE id = ?",
                            (normalize_date(row["due_date"]), row["status"], row["priority"], int(row["id"])),
                        )
                    if updates:
                        st.success(f"Saved {len(updates)} update(s).")
                        st.experimental_rerun()
                    else:
                        st.info("No changes detected.")

    with tab_add:
        left, right = st.columns(2)

        with left:
            st.subheader("Add user")
            with st.form("add_user_form", clear_on_submit=True):
                name = st.text_input("Name")
                email = st.text_input("Email (optional)")
                submitted = st.form_submit_button("Add user")

                if submitted:
                    if not name.strip():
                        st.error("User name is required.")
                    else:
                        try:
                            add_user(name, email)
                            st.success(f"Added user: {name}")
                        except sqlite3.IntegrityError:
                            st.error("That user already exists.")

            user_rows = df_query("SELECT name, email, active FROM users ORDER BY name")
            st.dataframe(user_rows, use_container_width=True, hide_index=True)

        with right:
            st.subheader("Add chore")
            with st.form("add_chore_form", clear_on_submit=True):
                title = st.text_input("Chore title")
                description = st.text_area("Description / instructions")
                frequency = st.selectbox(
                    "Frequency",
                    ["One-time", "Daily", "Weekly", "Biweekly", "Monthly"],
                )
                submitted = st.form_submit_button("Add chore")

                if submitted:
                    if not title.strip():
                        st.error("Chore title is required.")
                    else:
                        add_chore(title, description, frequency)
                        st.success(f"Added chore: {title}")

            chore_rows = df_query(
                "SELECT title, description, frequency, active FROM chores ORDER BY title"
            )
            st.dataframe(chore_rows, use_container_width=True, hide_index=True)

    with tab_assign:
        st.subheader("Assign a chore")
        users = get_users()
        chores = get_chores()

        if not users or not chores:
            st.info("Add at least one user and one chore before assigning.")
        else:
            user_options = {u["name"]: u["id"] for u in users}
            chore_options = {c["title"]: c["id"] for c in chores}

            with st.form("assignment_form", clear_on_submit=True):
                selected_chore = st.selectbox("Chore", list(chore_options.keys()))
                selected_user = st.selectbox("Assign to", list(user_options.keys()))
                due = st.date_input("Due date", value=date.today() + timedelta(days=1))
                priority = st.selectbox("Priority", ["Low", "Normal", "High"])
                submitted = st.form_submit_button("Assign chore")

                if submitted:
                    add_assignment(
                        chore_id=chore_options[selected_chore],
                        user_id=user_options[selected_user],
                        due_date=due,
                        priority=priority,
                    )
                    st.success(f"Assigned {selected_chore} to {selected_user}.")

        st.divider()
        st.subheader("Current assignments")

        current = get_assignments()
        if current.empty:
            st.info("No current assignments.")
        else:
            st.dataframe(
                current[
                    [
                        "id",
                        "chore",
                        "assigned_to",
                        "due_date",
                        "due_state",
                        "status",
                        "priority",
                        "last_update",
                    ]
                ],
                use_container_width=True,
                hide_index=True,
            )

            assignment_ids = current["id"].tolist()
            selected_assignment = st.selectbox(
                "Select assignment to delete",
                assignment_ids,
                format_func=lambda x: f"#{x}",
            )
            if st.button("Delete selected assignment", type="secondary"):
                delete_assignment(selected_assignment)
                st.success("Assignment deleted.")
                st.experimental_rerun()

    with tab_updates:
        st.subheader("Update chore status")
        current = get_assignments()

        if current.empty:
            st.info("No assignments to update.")
        else:
            assignment_options = {
                f"#{row.id} — {row.chore} → {row.assigned_to} — due {row.due_date}": row.id
                for row in current.itertuples()
            }
            selected_label = st.selectbox("Assignment", list(assignment_options.keys()))
            assignment_id = assignment_options[selected_label]
            selected_row = current[current["id"] == assignment_id].iloc[0]

            st.markdown(f"**Chore:** {selected_row['chore']}")
            st.markdown(f"**Assigned to:** {selected_row['assigned_to']}")
            st.markdown(f"**Due:** {selected_row['due_date']}")
            st.markdown(f"**Status:** {selected_row['status']}")
            st.markdown(f"**Description:** {selected_row['description'] or 'No description'}")

            with st.form("add_update_form", clear_on_submit=True):
                update_text = st.text_area("Description/update for this assignment")
                submitted = st.form_submit_button("Save update")
                if submitted:
                    if not update_text.strip():
                        st.error("Update text is required.")
                    else:
                        add_update(assignment_id, update_text)
                        st.success("Update saved.")
                        st.experimental_rerun()

            col1, col2, col3 = st.columns(3)
            with col1:
                if st.button("Mark in progress"):
                    run_query(
                        "UPDATE assignments SET status = 'In Progress' WHERE id = ?",
                        (assignment_id,),
                    )
                    st.success("Marked in progress.")
                    st.experimental_rerun()
            with col2:
                if st.button("Mark done", type="primary"):
                    mark_done(assignment_id)
                    st.success("Marked done.")
                    st.experimental_rerun()
            with col3:
                if st.button("Reopen"):
                    reopen_assignment(assignment_id)
                    st.success("Assignment reopened.")
                    st.experimental_rerun()

            st.divider()
            st.subheader("Update history")
            updates = get_assignment_updates(assignment_id)
            if updates.empty:
                st.info("No updates yet.")
            else:
                for _, row in updates.iterrows():
                    st.markdown(f"**{row['created_at']}**")
                    st.write(row["update_text"])
                    st.divider()

    with tab_notify:
        st.subheader("Email reminders")
        st.write(
            "Send email reminders for chores that are due soon or past due. "
            "Configure SMTP settings in `.streamlit/secrets.toml`."
        )

        current = get_assignments()
        due_df = current[
            (current["status"] != "Done")
            & (current["due_state"].isin(["Due soon", "Past due"]))
            & current["email"].notna()
        ]

        if due_df.empty:
            st.info("No due-soon or past-due assignments with email addresses.")
        else:
            st.dataframe(
                due_df[
                    [
                        "id",
                        "chore",
                        "assigned_to",
                        "email",
                        "due_date",
                        "due_state",
                        "description",
                        "last_update",
                    ]
                ],
                use_container_width=True,
                hide_index=True,
            )

            if st.button("Send reminder emails"):
                sent = 0
                failed = 0
                for _, row in due_df.iterrows():
                    subject = f"Chore reminder: {row['chore']} is {row['due_state'].lower()}"
                    body = f"""
Hi {row['assigned_to']},

This is a chore reminder.

Chore: {row['chore']}
Due date: {row['due_date']}
Status: {row['due_state']}

Description:
{row['description'] or 'No description provided.'}

Latest update:
{row['last_update'] or 'No updates yet.'}

Thanks!
"""
                    ok, message = send_email_notification(row["email"], subject, body)
                    if ok:
                        sent += 1
                        run_query(
                            "UPDATE assignments SET notified_at = ? WHERE id = ?",
                            (datetime.now().isoformat(timespec="seconds"), int(row["id"])),
                        )
                    else:
                        failed += 1
                        st.error(f"Failed for {row['email']}: {message}")
                st.success(f"Sent {sent} reminder(s). Failed: {failed}.")

    st.markdown("---")
    st.write(
        "Open this app in a mobile browser and use a local Streamlit deployment or Streamlit Community Cloud. "
        "The SQLite database is stored locally at `chore_chart.db`."
    )


if __name__ == "__main__":
    main()
