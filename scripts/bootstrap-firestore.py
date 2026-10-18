"""Seed the hackathon demo dataset into Firestore. No email invite or login is required.

Run from backend: .venv/Scripts/python ../scripts/bootstrap-firestore.py
"""
from app.core.firebase import database
from app.core.seed_store import _initial_tables
from app.core.permissions import ROLE_PERMISSIONS

db = database()
tables = _initial_tables()
tables['organizations'] = [{'id': '00000000-0000-0000-0000-000000000001', 'organization_id': '00000000-0000-0000-0000-000000000001', 'name': 'BuildLens Hackathon'}]
tables['roles'] = [
    {'id': '20000000-0000-0000-0000-000000000001', 'organization_id': '00000000-0000-0000-0000-000000000001', 'name': role, 'permissions': list(perms)}
    for role, perms in ROLE_PERMISSIONS.items()
]
records = [(table, str(row['id']), {**row, 'organization_id': '00000000-0000-0000-0000-000000000001'}) for table, rows in tables.items() for row in rows if row.get('id')]
batch = db.batch()
pending = 0
for table, record_id, row in records:
    batch.set(db.collection(table).document(record_id), row)
    pending += 1
    if pending == 450:
        batch.commit()
        batch = db.batch()
        pending = 0
if pending:
    batch.commit()
print(f'Seeded {len(records)} hackathon demo records across {len(tables)} Firestore collections. No account invitations required.')
