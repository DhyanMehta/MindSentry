Apply legacy schema changes with explicit migrations instead of startup-time table mutation.

Current migration files:

- `001_assistant_schema_compat.sql`: upgrades older assistant chat tables to the current schema.
- `002_daily_checkin_template.sql`: seeds the canonical daily check-in questionnaire template and questions.

Run the SQL manually against existing deployments before upgrading the app if those legacy assistant tables are still in use or if the daily check-in template has not been seeded yet.
