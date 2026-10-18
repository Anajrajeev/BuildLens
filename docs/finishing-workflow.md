# Finishing workflow

Work sections contains the 89 activities from Sheet1 and the 45 source rows from Sheet2 of `FINISHING ACTIVITY ELLEGENZA  final.xlsx`. The read-only extractor is `scripts/extract-finishing-workflow.py`; it requires openpyxl and writes the versioned reference JSON used by the frontend. It retains missing durations and original wording. Six phase groupings are editorial suggestions. Sheet2 schedule bands are relative day offsets, not calendar dates or enforced dependencies. Duplicate screed rows and conflicting duration annotations remain visible.

Apply `cloud_run_data_api/migrations/202610070001_villa_workflow.sql` before releasing the backend and frontend. The new `/api/v1/workflow/{project_id}` endpoints provide tenant-scoped history and append-only villa progress. Writes require `task.write`, reads require `villa.read.all`. Composite foreign keys protect villa/project/tenant consistency; unique revision keys reject concurrent stale writes. No existing task, section or progress record is rewritten.

Section-level progress is independent of Today task progress. Select a villa, open an activity, and save its status, percentage and note. Rework requires a reason and preserves earlier completion records. Parallel work is allowed across any phases. Earlier unfinished source rows are advisory. Project completion requires every mapped villa to complete the activity; percentages average all mapped villas, with unreported progress counted as zero and reporting coverage shown separately.

Reference data is available even when live data fails; the UI labels live progress unavailable and disables saving. Offline writes use the existing queue and are not displayed as confirmed progress. Refresh after synchronization; revision conflicts require a fresh read before retrying.

Validation: `node scripts/test-workflow.cjs` and `npm run typecheck` in frontend; `python -m pytest tests/test_workflow.py` in backend. Production release must follow `docs/deployment.md`.
