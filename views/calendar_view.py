"""Calendar page — port of components/calendar/calendar.jsx.

A month grid of chores by due date that reflects every chore change made on the
Chores page (it re-reads the database on each run), filterable by user, chore
name and date.
"""

import calendar as pycalendar
from datetime import date

import streamlit as st

import chore_data as data

DUE_STATE_COLOR = {
    "Past due": "red",
    "Due soon": "orange",
    "Upcoming": "blue",
    "Completed": "green",
}

st.title("📅 Chore Calendar")
st.caption("Chores by due date. Filter by user, chore or day.")

today = date.today()
st.session_state.setdefault("cal_year", today.year)
st.session_state.setdefault("cal_month", today.month)


def shift_month(delta):
    month = st.session_state.cal_month + delta
    year = st.session_state.cal_year + (month - 1) // 12
    st.session_state.cal_month = (month - 1) % 12 + 1
    st.session_state.cal_year = year
    st.session_state.pop("cal_selected_day", None)


# -----------------------------
# Filters (filterChoresByUser / filterChoresByChoreName)
# -----------------------------

users = data.get_users()
user_lookup = {u["name"]: u["id"] for u in users}

filter_cols = st.columns([1.2, 1.5, 1])
with filter_cols[0]:
    selected_user = st.selectbox("User", ["Everyone"] + list(user_lookup.keys()))
with filter_cols[1]:
    chore_query = st.text_input("Chore name contains", placeholder="e.g. litter")
with filter_cols[2]:
    status = st.selectbox("Status", ["All", "Open", "Pending", "In Progress", "Done"])

year = st.session_state.cal_year
month = st.session_state.cal_month

nav_cols = st.columns([1, 1, 4, 1.4])
nav_cols[0].button("◀ Prev", on_click=shift_month, args=(-1,), use_container_width=True)
nav_cols[1].button("Next ▶", on_click=shift_month, args=(1,), use_container_width=True)
nav_cols[2].markdown(f"### {pycalendar.month_name[month]} {year}")
if nav_cols[3].button("Today", use_container_width=True):
    st.session_state.cal_year, st.session_state.cal_month = today.year, today.month
    st.session_state.pop("cal_selected_day", None)
    st.rerun()

by_day = data.assignments_by_day(
    year,
    month,
    user_id=user_lookup.get(selected_user),
    chore_query=chore_query,
    status=status,
)


# -----------------------------
# Month grid
# -----------------------------

header_cols = st.columns(7)
for col, day_name in zip(header_cols, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]):
    col.markdown(f"**{day_name}**")

for week in pycalendar.Calendar(firstweekday=0).monthdatescalendar(year, month):
    cols = st.columns(7)
    for col, day in zip(cols, week):
        with col.container(border=True):
            in_month = day.month == month
            day_label = f"**{day.day}**" if in_month else f":gray[{day.day}]"
            if day == today:
                day_label = f":red[**{day.day} · today**]"
            st.markdown(day_label)

            entries = by_day.get(day, [])
            for row in entries[:3]:
                color = DUE_STATE_COLOR.get(row["due_state"], "gray")
                title = row["chore"] if len(row["chore"]) <= 14 else row["chore"][:13] + "…"
                st.markdown(f":{color}[● {title}]")
                st.caption(row["assigned_to"])
            if len(entries) > 3:
                st.caption(f"+{len(entries) - 3} more")

            if entries:
                if st.button(
                    f"View ({len(entries)})", key=f"day_{day.isoformat()}", use_container_width=True
                ):
                    st.session_state.cal_selected_day = day.isoformat()
                    st.rerun()

st.markdown(
    "Legend: :red[● past due] · :orange[● due soon] · :blue[● upcoming] · :green[● completed]"
)

month_total = sum(len(v) for k, v in by_day.items() if k.month == month)
st.caption(f"{month_total} chore(s) due in {pycalendar.month_name[month]} {year}.")

st.divider()


# -----------------------------
# Selected day (filterChoresByDate)
# -----------------------------

selected = data.parse_date(st.session_state.get("cal_selected_day"))
if selected is None:
    st.subheader("Pick a day")
    st.caption("Use a **View** button in the grid to see that day's chores.")
else:
    head_cols = st.columns([5, 1])
    head_cols[0].subheader(selected.strftime("%A, %d %B %Y"))
    if head_cols[1].button("Clear", use_container_width=True):
        st.session_state.pop("cal_selected_day", None)
        st.rerun()

    for row in by_day.get(selected, []):
        color = DUE_STATE_COLOR.get(row["due_state"], "gray")
        with st.container(border=True):
            cols = st.columns([5, 1.4])
            cols[0].markdown(
                f"**{row['chore']}** · :{color}[{row['due_state']}]  \n"
                f"👤 {row['assigned_to']} · {row['priority']} priority · {row['frequency']}"
            )
            if row["description"]:
                cols[0].caption(row["description"])
            if row["last_update"]:
                cols[0].caption(f"Latest update: {row['last_update']}")

            with cols[1]:
                if row["status"] == "Done":
                    st.markdown(f"✅ +{row['points_awarded'] or 0} pts")
                    if st.button("Reopen", key=f"cal_reopen_{row['id']}", use_container_width=True):
                        removed = data.reopen_assignment(row["id"])
                        st.toast(f"Reopened — {removed} points removed", icon="🔴")
                        st.rerun()
                else:
                    worth = data.calculate_points(row["frequency"], row["chore_last_completed"])
                    st.caption(f"Worth {worth} pts")
                    if st.button(
                        "Done",
                        key=f"cal_done_{row['id']}",
                        type="primary",
                        use_container_width=True,
                    ):
                        points, chore_title = data.complete_assignment(row["id"])
                        st.toast(f"{chore_title}: +{points} points", icon="🟢")
                        st.rerun()

    upcoming = [
        row
        for day, rows in sorted(by_day.items())
        if day > selected
        for row in rows
        if row["status"] != "Done"
    ][:5]
    if upcoming:
        with st.expander("Next up after this day"):
            for row in upcoming:
                st.markdown(f"- `{row['due_date']}` **{row['chore']}** → {row['assigned_to']}")
