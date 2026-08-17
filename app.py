"""Chore Chart — a two page Streamlit app.

Pages:
  * Chores   (views/chores_list.py)   — the chore list, details panel and points
  * Calendar (views/calendar_view.py) — month grid of due chores, filterable

Shared shell lives here: the notification bell in the sidebar, and the per-user
point bars, which render above whichever page is showing.
"""

import streamlit as st

import chore_data as data
import point_bar

st.set_page_config(page_title="Chore Chart", page_icon="🧹", layout="wide")

data.init_db()


def render_bell():
    """notify_user.jsx: bell that drops down the list of notifications."""
    unread = data.unread_notification_count()
    label = f"🔔 Notifications ({unread})" if unread else "🔔 Notifications"

    with st.expander(label, expanded=bool(unread)):
        notifications = data.get_notifications(limit=15)
        if not notifications:
            st.caption("Nothing yet. Assign or complete a chore.")
            return

        for note in notifications:
            marker = "🟡" if not note["read"] else "⚪"
            st.markdown(f"{marker} {note['message']}")
            st.caption(note["created_at"])

        if unread:
            if st.button("Mark all as read", use_container_width=True):
                data.mark_notifications_read()
                st.rerun()


with st.sidebar:
    st.title("🧹 Chore Chart")
    render_bell()

# PointHelpers.jsx point bar, one per user, above the page content.
point_bar.render_point_bars()

pages = [
    st.Page("views/chores_list.py", title="Chores", icon="🧽", default=True),
    st.Page("views/calendar_view.py", title="Calendar", icon="📅"),
]

st.navigation(pages).run()
