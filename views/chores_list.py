"""Chores page — port of components/chores/chore_list.jsx + chore_details.jsx.

Available chores with due dates, sorted by priority (or due date), a '+' to
assign a chore to a user, and completion that awards points based on the
chore's frequency and the days since it was last completed.

Due dates and priorities are derived here rather than stored: a chore is due one
frequency interval after the last day it was completed (the `frequency` and
`lastCompleted` fields of chore_details.jsx), and the priority follows from how
that due date sits against today (chore_list.jsx sortChoresByPriority).
"""

from datetime import date, timedelta
import string

import streamlit as st

import chore_data as data

DUE_STATE_ICON = {
    "Past due": "🚨",
    "Due soon": "⏰",
    "Upcoming": "🗓️",
    "Completed": "✅",
}
PRIORITY_ICON = {"high": "🔴", "medium": "🟠", "normal": "🟠", "low": "🟢"}

# chore_list.jsx: priorityOrder = { high: 1, medium: 2, low: 3 }.
# 'Normal' is the legacy value already stored in the database.
PRIORITY_ORDER = {"high": 1, "medium": 2, "normal": 2, "low": 3}

# Days between occurrences for each frequency in chore_details.jsx.
# One-time chores never come round again.
FREQUENCY_DAYS = {
    "daily": 1,
    "weekly": 7,
    "biweekly": 14,
    "monthly": 30,
    "one-time": None,
}

st.title("🧽 Chores")
st.caption(
    "Due dates come from the last day a chore was completed plus its frequency; "
    "priority follows the due date. Completing a chore awards points based on its "
    "frequency and how long it had been since it was last done."
)

users = data.get_users()
chores = data.get_chores()

if not users or not chores:
    st.info("Add at least one user and one chore to get started.")


# -----------------------------
# Due date from last completion + frequency
# -----------------------------

def frequency_days(frequency):
    """Days between occurrences, or None for a chore that does not repeat."""
    return FREQUENCY_DAYS.get((frequency or "").lower())


def next_due_date(frequency, last_completed):
    """The day a chore is next due: last completion plus one interval.

    Never completed, or one-time, means it is due today. A recurring chore that
    slipped keeps the date it should have been done on, so it still reads as
    past due instead of quietly forgiving the slip.
    """
    interval = frequency_days(frequency)
    last = data.parse_date(last_completed)
    if interval is None or last is None:
        return date.today()
    return last + timedelta(days=interval)


def due_soon_window(frequency):
    """How far ahead counts as 'due soon' — a quarter of the interval.

    A day of slippage matters far more on a daily chore than a monthly one, so
    daily/weekly warn 1–2 days out while monthly warns a week out.
    """
    interval = frequency_days(frequency)
    if interval is None:
        return 2
    return max(1, -(-interval // 4))  # ceil(interval / 4)


# -----------------------------
# Determine priority by due date and frequency
# -----------------------------

def det_priority(due_date, frequency):
    """Determine the due state and priority of a chore from its due date and frequency."""
    if due_date is None:
        due_date = next_due_date(frequency, None)

    days_until_due = (due_date - date.today()).days

    if days_until_due < 0:
        return "Past due", "High"
    if days_until_due <= due_soon_window(frequency):
        return "Due soon", "Medium"
    return "Upcoming", "Low"


def annotate(rows):
    """Attach the derived due date, due state and suggested priority to each row."""
    for row in rows:
        row["due"] = data.parse_date(row["due_date"]) or date.today()
        # Where the schedule says this chore should land, given the last completion.
        row["scheduled_due"] = next_due_date(row["frequency"], row["chore_last_completed"])
        state, suggested = det_priority(row["due"], row["frequency"])
        row["due_state"] = "Completed" if row["status"] == "Done" else state
        row["suggested_priority"] = suggested
    return rows


def priority_rank(priority):
    return PRIORITY_ORDER.get((priority or "").lower(), 99)


def sort_chores_by_priority(rows):
    """chore_list.jsx sortChoresByPriority, with completed chores sinking last."""
    return sorted(rows, key=lambda r: (r["status"] == "Done", priority_rank(r["priority"]), r["due"]))


def sort_chores_by_due_date(rows):
    """chore_list.jsx sortChoresByDueDate."""
    return sorted(rows, key=lambda r: (r["status"] == "Done", r["due"], priority_rank(r["priority"])))


# -----------------------------
# Filters (filterChoresByCompletion / filterChoresByAssignedUser)
# -----------------------------

filter_cols = st.columns([1, 1, 1.5, 1])
with filter_cols[0]:
    status = st.selectbox("Status", ["Open", "All", "Pending", "In Progress", "Done"])
with filter_cols[1]:
    user_names = ["Everyone"] + [u["name"] for u in users]
    selected_user = st.selectbox("Assigned to", user_names)
with filter_cols[2]:
    chore_query = st.text_input("Search chore", placeholder="e.g. laundry")
with filter_cols[3]:
    sort_by = st.selectbox("Sort by", ["Priority", "Due date", "Assigned user"])

user_lookup = {u["name"]: u["id"] for u in users}
user_id = user_lookup.get(selected_user)

assignments = annotate(
    data.get_assignments(status=status, user_id=user_id, chore_query=chore_query)
)

if sort_by == "Priority":
    assignments = sort_chores_by_priority(assignments)
elif sort_by == "Due date":
    assignments = sort_chores_by_due_date(assignments)
else:
    assignments = sorted(assignments, key=lambda r: (r["assigned_to"].lower(), r["due"]))

all_assignments = annotate(data.get_assignments(status="All"))
metric_cols = st.columns(4)
metric_cols[0].metric("Open", sum(1 for a in all_assignments if a["status"] != "Done"))
metric_cols[1].metric("Past due", sum(1 for a in all_assignments if a["due_state"] == "Past due"))
metric_cols[2].metric("Due soon", sum(1 for a in all_assignments if a["due_state"] == "Due soon"))
metric_cols[3].metric("Completed", sum(1 for a in all_assignments if a["status"] == "Done"))

st.divider()


# -----------------------------
# Unassigned chores — the '+' from chore_list.jsx
# -----------------------------

unassigned = data.get_unassigned_chores()
if unassigned and users:
    st.subheader("Available chores")
    st.caption("Nobody is on these yet. Use ➕ to assign one — the due date is prefilled.")

    for chore in unassigned:
        # Due date from the last day completed and the frequency.
        scheduled_due = next_due_date(chore["frequency"], chore["last_completed"])
        due_state, suggested_priority = det_priority(scheduled_due, chore["frequency"])

        cols = st.columns([4, 2.4, 2.4, 1])
        cols[0].markdown(f"**{chore['title']}** — {chore['frequency']}")
        last = chore["last_completed"]
        cols[0].caption(f"Last done: {last[:10]}" if last else "Never done")

        cols[1].markdown(f"📅 Due {scheduled_due.isoformat()}")
        interval = frequency_days(chore["frequency"])
        cols[1].caption(
            f"{last[:10]} + {interval}d" if last and interval else "No schedule yet — due today"
        )

        # show the due state and priority icons
        cols[2].markdown(f"{DUE_STATE_ICON[due_state]} {due_state}")
        cols[2].markdown(
            f"{PRIORITY_ICON[suggested_priority.lower()]} {suggested_priority} priority"
        )

        with cols[3].popover("➕", use_container_width=True):
            st.markdown(f"Assign **{chore['title']}**")
            assignee = st.selectbox(
                "User", list(user_lookup.keys()), key=f"assign_user_{chore['id']}"
            )
            due = st.date_input(
                "Due date",
                value=scheduled_due,
                key=f"assign_due_{chore['id']}",
            )
            assign_priority = st.selectbox(
                "Priority",
                data.PRIORITIES,
                index=data.PRIORITIES.index(suggested_priority),
                key=f"assign_prio_{chore['id']}",
            )
            if st.button("Assign", key=f"assign_go_{chore['id']}", type="primary"):
                data.assign_chore(chore["id"], user_lookup[assignee], due, assign_priority)
                st.toast(f"Assigned {chore['title']} to {assignee}", icon="➕")
                st.rerun()

    st.divider()


# -----------------------------
# Assigned chores + details (chore_details.jsx)
# -----------------------------

st.subheader("Chore list")

if not assignments:
    st.info("No chores match these filters.")

for row in assignments:
    icon = DUE_STATE_ICON.get(row["due_state"], "🗓️")
    priority = (row["priority"] or "Medium").title()
    prio_icon = PRIORITY_ICON.get(priority.lower(), "⚪")
    done = row["status"] == "Done"
    off_schedule = not done and row["due"] != row["scheduled_due"]

    header_cols = st.columns([5, 2, 2.6, 1.6])
    title = f"~~{row['chore']}~~" if done else f"**{row['chore']}**"
    header_cols[0].markdown(f"{icon} {title} · {row['frequency']}")
    header_cols[1].markdown(f"👤 {row['assigned_to']}")
    header_cols[2].markdown(
        f"📅 {row['due']:%Y-%m-%d} · {row['due_state']} · {prio_icon} {priority}"
    )
    if not done and priority_rank(row["suggested_priority"]) < priority_rank(priority):
        header_cols[2].caption(
            f"Due date suggests {row['suggested_priority'].lower()} priority"
        )
    elif off_schedule:
        header_cols[2].caption(f"Schedule says {row['scheduled_due']:%Y-%m-%d}")

    with header_cols[3]:
        if done:
            if st.button("Reopen", key=f"reopen_{row['id']}", use_container_width=True):
                removed = data.reopen_assignment(row["id"])
                st.toast(f"Reopened — {removed} points removed", icon="🔴")
                st.rerun()
        else:
            if st.button(
                "Done", key=f"done_{row['id']}", type="primary", use_container_width=True
            ):
                points, chore_title = data.complete_assignment(row["id"])
                st.toast(f"{chore_title}: +{points} points", icon="🟢")
                st.rerun()

    with st.expander("Details"):
        detail_cols = st.columns(2)
        with detail_cols[0]:
            st.markdown(f"**Description:** {row['description'] or '_None_'}")
            st.markdown(f"**Frequency:** {row['frequency']}")
            st.markdown(f"**Assigned to:** {row['assigned_to']} ({row['email'] or 'no email'})")
            st.markdown(f"**Status:** {row['status']}")
            st.markdown(f"**Priority:** {prio_icon} {priority}")
        with detail_cols[1]:
            last_done = row["chore_last_completed"]
            st.markdown(f"**Last completed:** {last_done[:16] if last_done else 'Never'}")
            st.markdown(f"**Due date:** {row['due']:%Y-%m-%d} ({row['due_state']})")
            st.markdown(f"**Scheduled due:** {row['scheduled_due']:%Y-%m-%d}")
            if done:
                st.markdown(f"**Points earned:** {row['points_awarded'] or 0}")
                st.markdown(f"**Completed at:** {(row['completed_at'] or '')[:16]}")
            else:
                worth = data.calculate_points(row["frequency"], last_done)
                st.markdown(f"**Worth:** {worth} points if completed today")
                interval = frequency_days(row["frequency"])
                if interval:
                    st.markdown(
                        f"**Next due if done today:** "
                        f"{(date.today() + timedelta(days=interval)):%Y-%m-%d}"
                    )
            st.markdown(f"**Latest update:** {row['last_update'] or '_None_'}")

        edit_cols = st.columns([1.4, 1, 1, 1])
        with edit_cols[0]:
            new_due = st.date_input("Due date", value=row["due"], key=f"due_{row['id']}")
            if off_schedule and st.button(
                f"Use schedule ({row['scheduled_due']:%b %d})",
                key=f"resched_{row['id']}",
                use_container_width=True,
            ):
                data.update_assignment(row["id"], due_date=row["scheduled_due"])
                st.toast("Due date rolled to the scheduled day", icon="📅")
                st.rerun()
        with edit_cols[1]:
            priority_options = data.PRIORITIES
            current_priority = priority if priority in priority_options else "Medium"
            new_priority = st.selectbox(
                "Priority",
                priority_options,
                index=priority_options.index(current_priority),
                key=f"prio_{row['id']}",
            )
        with edit_cols[2]:
            names = list(user_lookup.keys())
            new_user = st.selectbox(
                "Assigned to",
                names,
                index=names.index(row["assigned_to"]) if row["assigned_to"] in names else 0,
                key=f"user_{row['id']}",
            )
        with edit_cols[3]:
            st.markdown("&nbsp;")
            if st.button("Save", key=f"save_{row['id']}", use_container_width=True):
                data.update_assignment(
                    row["id"],
                    due_date=new_due,
                    priority=new_priority,
                    user_id=user_lookup[new_user],
                )
                st.toast("Assignment updated", icon="💾")
                st.rerun()

        with st.form(f"update_form_{row['id']}", clear_on_submit=True):
            note = st.text_area("Add an update", key=f"note_{row['id']}")
            note_cols = st.columns([1, 1, 4])
            saved = note_cols[0].form_submit_button("Save update")
            in_progress = note_cols[1].form_submit_button("Mark in progress")
            if saved:
                if note.strip():
                    data.add_update(row["id"], note)
                    st.rerun()
                else:
                    st.warning("Write something first.")
            if in_progress:
                data.set_status(row["id"], "In Progress")
                st.rerun()

        history = data.get_updates(row["id"])
        if history:
            st.caption("Update history")
            for entry in history:
                st.markdown(f"- `{entry['created_at'][:16]}` {entry['update_text']}")

        if st.button("Delete assignment", key=f"del_{row['id']}"):
            data.delete_assignment(row["id"])
            st.toast("Assignment deleted", icon="🗑️")
            st.rerun()

st.divider()