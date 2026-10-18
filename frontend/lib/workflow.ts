import reference from './finishing-workflow.json';
export { reference };
export type WorkStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'REWORK_REQUIRED' | 'COMPLETED';
export type WorkEvent = { id: string; villa_id: string; activity_key: string; revision: number; status: WorkStatus; progress: number; note: string; created_at: string };
export const statusLabels: Record<WorkStatus, string> = { NOT_STARTED: 'Not started', IN_PROGRESS: 'In progress', BLOCKED: 'Blocked', REWORK_REQUIRED: 'Rework', COMPLETED: 'Complete' };
export function latestEvents(events: WorkEvent[]) {
  const result = new Map<string, WorkEvent>();
  for (const event of events) {
    const key = `${event.villa_id}/${event.activity_key}`;
    if ((result.get(key)?.revision || 0) < event.revision) result.set(key, event);
  }
  return result;
}
export function activityState(events: WorkEvent[], villaIds: string[], activityKey: string) {
  const latest = latestEvents(events);
  const records = villaIds.map(id => latest.get(`${id}/${activityKey}`));
  const statuses = records.map(row => row?.status || 'NOT_STARTED');
  const status: WorkStatus = statuses.includes('REWORK_REQUIRED') ? 'REWORK_REQUIRED' : statuses.includes('BLOCKED') ? 'BLOCKED' : statuses.length > 0 && statuses.every(s => s === 'COMPLETED') ? 'COMPLETED' : statuses.some(s => s === 'IN_PROGRESS' || s === 'COMPLETED') ? 'IN_PROGRESS' : 'NOT_STARTED';
  return { status, progress: records.length ? Math.round(records.reduce((sum, row) => sum + (row?.progress || 0), 0) / records.length) : 0,
    recorded: records.filter(Boolean).length, complete: statuses.filter(s => s === 'COMPLETED').length,
    reworks: events.filter(e => villaIds.includes(e.villa_id) && e.activity_key === activityKey && e.status === 'REWORK_REQUIRED' && !events.some(p => p.villa_id === e.villa_id && p.activity_key === e.activity_key && p.revision === e.revision - 1 && p.status === 'REWORK_REQUIRED')).length };
}
