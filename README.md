# Chore Chart

Assign chores to people, track them on a calendar, and award points when they get
done. Points scale with a chore's frequency and how long it had been since it was
last completed.

The React frontend talks to a PHP + SQLite API. The PHP is laid out the way a
Nextcloud app is (`appinfo/`, `lib/Controller`, `lib/Db`, `templates/`) so it can
be dropped into Nextcloud without rewriting the backend.

## Running it

Two processes: the API and the dev server.

```bash
npm install
npm run api    # PHP API on http://127.0.0.1:8000
npm run dev    # Vite on http://localhost:5173, proxying /api to the API
```

The database is created and seeded on the first request, so there is no separate
migration step.

## Where the data comes from

`components/hardcorded_data.json` (users and chores) and
`components/points/rewards.json` (reward tiers) are imported into
`chore_chart.db` the first time the API runs against an empty table. The import
is additive and matches on name, so re-running it never duplicates or overwrites
anything.

## Layout

```
components/          the original JSX sketches, kept as the spec
src/
  api.ts             typed client for the API
  App.tsx            shell: tabs, filters, data loading
  components/        PointBar, NotificationBell, ChoreList, ChoreDetails,
                     Calendar, Settings
lib/
  Db/                Database (schema + seed) and the mappers
  Service/           PointsService (PointHelpers.jsx), Schedule (due dates)
  Controller/        Chore, Assignment, User, Notification, Page
appinfo/routes.php   route table, in the Nextcloud format
api/index.php        local front controller that dispatches that table
```

Each `components/*.jsx` sketch maps onto real code:

| Sketch | Backend | Frontend |
| --- | --- | --- |
| `chores/chore_list.jsx` | `AssignmentMapper`, `ChoreController::assign` | `components/ChoreList.tsx` |
| `chores/chore_details.jsx` | `AssignmentMapper::find` | `components/ChoreDetails.tsx` |
| `points/PointHelpers.jsx` | `Service/PointsService.php` | `components/PointBar.tsx` |
| `users/notify_user.jsx` | `NotificationMapper` | `components/NotificationBell.tsx` |
| `calendar/calendar.jsx` | `AssignmentMapper::findAll` filters | `components/Calendar.tsx` |

## How points work

Base points come from the frequency — daily 10, weekly 5, biweekly 3, monthly 2,
one-time 1 — multiplied by the days since the chore was last completed, capped at
30 days. Awards are written to a `points_ledger` row per assignment, so reopening
a chore takes back exactly what it gave.

## Nextcloud

`npm run build` emits an IIFE bundle to `ts/`, which `templates/main.php` loads.
`appinfo/routes.php` and the controllers are already in Nextcloud's shape; moving
over means swapping `lib/Db/Database.php` for the server's `IDBConnection`,
pointing `API_BASE` in `src/api.ts` at the app's route prefix, and dropping
`api/index.php`, which only exists to serve the API in local development.

## Streamlit app

`app.py`, `chore_data.py`, `point_bar.py` and `views/` are an earlier Python port
of the same sketches. They read the same `chore_chart.db` and still run
(`streamlit run app.py`), but the React app above is the one being taken forward.
