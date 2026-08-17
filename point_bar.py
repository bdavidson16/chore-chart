"""Point bar — Python port of components/points/PointHelpers.jsx.

Mapping from the JSX helpers to this app:

    calculatePoints            -> chore_data.calculate_points
    updateUserPoints           -> chore_data.complete_assignment (points_ledger row)
    handleChoreCompletion      -> chore_data.complete_assignment
    notifyUser                 -> chore_data.notify_user
    updatePointBarUI           -> point_bar_html: width = `${points}%`, text = `${points} points`
    addPointsAnimation         -> the same bar animated right in green
    removePointsAnimation      -> the same bar animated left in red

The JSX mutated one `#point-bar` element with `setTimeout`; Streamlit re-runs the
script instead, so the animation is expressed as a CSS keyframe that runs from
the previous point total to the new one. Previous totals are kept in session
state, which means every points change — completing, reopening or deleting a
chore — animates without the pages having to announce it.
"""

import html

import streamlit as st

import chore_data as data

# PointHelpers sets the bar width straight from the point total (`${points}%`),
# so 100 points is a full bar.
BAR_FULL_POINTS = 100

BASE_COLOR = "#3d7be0"
ADD_COLOR = "#21a366"  # addPointsAnimation: green
REMOVE_COLOR = "#d93b3b"  # removePointsAnimation: red

CSS = """
<style>
.pb-card {
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 0.6rem;
  padding: 0.7rem 0.9rem;
  margin-bottom: 0.5rem;
  font-family: "Source Sans Pro", sans-serif;
}
.pb-card h4 { margin: 0 0 0.55rem 0; font-size: 0.95rem; }
.pb-grid {
  display: grid;
  grid-template-columns: minmax(6rem, 10rem) 1fr;
  gap: 0.4rem 0.75rem;
  align-items: center;
}
.pb-name { font-weight: 600; font-size: 0.85rem; }
.pb-tier { font-weight: 400; opacity: 0.75; font-size: 0.75rem; display: block; }
.pb-delta { font-weight: 700; font-size: 0.75rem; margin-left: 0.3rem; }
.pb-delta-up { color: %(add)s; }
.pb-delta-down { color: %(remove)s; }
.pb-track {
  background: rgba(128, 128, 128, 0.18);
  border-radius: 999px;
  height: 1.3rem;
  overflow: hidden;
}
.pb-fill {
  height: 100%%;
  min-width: 2.6rem;
  border-radius: 999px;
  background: %(base)s;
  color: #fff;
  font-size: 0.72rem;
  line-height: 1.3rem;
  text-align: right;
  padding-right: 0.5rem;
  box-sizing: border-box;
  transition: width 0.5s ease-in-out;   /* PointHelpers: 'width 0.5s ease-in-out' */
}
.pb-goal { font-size: 0.7rem; opacity: 0.7; }
</style>
""" % {"base": BASE_COLOR, "add": ADD_COLOR, "remove": REMOVE_COLOR}


def bar_width(points):
    """Bar width in percent — `${points}%`, clamped to a full bar."""
    return max(0, min(points, BAR_FULL_POINTS))


def _animation(user_id, previous_points, points):
    """CSS for one bar: width from the old total to the new one, green when
    points were added and red when they were taken away (the JSX animations)."""
    start = bar_width(previous_points)
    end = bar_width(points)
    if start == end:
        return "", f"width: {end}%;"

    name = f"pb-move-{user_id}"
    color = ADD_COLOR if points > previous_points else REMOVE_COLOR
    keyframes = f"""
<style>
@keyframes {name} {{
  from {{ width: {start}%; background: {color}; }}
  80%  {{ background: {color}; }}
  to   {{ width: {end}%; background: {BASE_COLOR}; }}
}}
</style>
"""
    return keyframes, f"width: {end}%; animation: {name} 0.5s ease-in-out;"


def point_bar_html(users):
    """updatePointBarUI for every user, as one block of markup."""
    previous = st.session_state.setdefault("pb_previous_points", {})

    keyframes, rows = [], []
    for user in users:
        points = user["points"]
        # An unseen user fills in from empty; after that only real changes animate.
        prev = previous.get(user["id"], 0)
        frames, fill_style = _animation(user["id"], prev, points)
        keyframes.append(frames)
        previous[user["id"]] = points

        delta = points - prev
        badge = ""
        if delta:
            css_class = "pb-delta-up" if delta > 0 else "pb-delta-down"
            badge = f'<span class="pb-delta {css_class}">{delta:+d}</span>'

        next_tier = user["next_tier"]
        tier = user["tier"] or "No reward yet"
        goal = (
            f"{user['completed']}/{next_tier['threshold']} chores → {next_tier['title']}"
            if next_tier
            else f"{user['completed']} chores — all rewards earned 🏆"
        )

        rows.append(
            f'<div class="pb-name">{html.escape(user["name"])}{badge}'
            f'<span class="pb-tier">{html.escape(tier)}</span></div>'
            f'<div><div class="pb-track">'
            f'<div class="pb-fill" style="{fill_style}">{points} points</div>'
            f'</div><span class="pb-goal">{html.escape(goal)}</span></div>'
        )

    return (
        CSS
        + "".join(keyframes)
        + '<div class="pb-card"><h4>🏅 Points</h4>'
        + '<div class="pb-grid">'
        + "".join(rows)
        + "</div></div>"
    )


def render_point_bars():
    """Draw a point bar per user. Called from app.py so it sits at the top of
    both pages."""
    users = data.get_user_progress()
    if not users:
        return

    st.html(point_bar_html(users))
