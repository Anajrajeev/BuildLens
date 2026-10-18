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
  return {
    status,
    progress: records.length ? Math.round(records.reduce((sum, row) => sum + (row?.progress || 0), 0) / records.length) : 0,
    recorded: records.filter(Boolean).length,
    complete: statuses.filter(s => s === 'COMPLETED').length,
    reworks: events.filter(e => villaIds.includes(e.villa_id) && e.activity_key === activityKey && e.status === 'REWORK_REQUIRED' && !events.some(p => p.villa_id === e.villa_id && p.activity_key === e.activity_key && p.revision === e.revision - 1 && p.status === 'REWORK_REQUIRED')).length,
  };
}

export type ActivityScheduleOverride = {
  duration: number;
  startDay?: number;
  allowParallel?: boolean;
};

export type ScheduledActivityMeta = {
  id: string;
  order: number;
  name: string;
  phase: number;
  duration: number;
  startDay: number;
  endDay: number;
  allowParallel: boolean;
  parallelTrack: string;
  parallelWithIds: string[];
  parallelWithNames: string[];
  prerequisiteId: string | null;
  prerequisiteName: string | null;
  hasConflict: boolean;
};

export const DEFAULT_PHASE_WINDOWS: {
  phaseIndex: number;
  name: string;
  startDay: number;
  plannedDays: number;
  endDay: number;
  allowParallel: boolean;
  parallelNote: string;
}[] = [
  {
    phaseIndex: 0,
    name: 'Services & waterproofing',
    startDay: 1,
    plannedDays: 38,
    endDay: 38,
    allowParallel: true,
    parallelNote: 'GF, FF, SF & Terrace plumbing/waterproofing tracks run in parallel across levels',
  },
  {
    phaseIndex: 1,
    name: 'Interior base & flooring',
    startDay: 18,
    plannedDays: 55,
    endDay: 72,
    allowParallel: true,
    parallelNote: 'Overlaps in parallel with Services once GF waterproofing clearance is achieved',
  },
  {
    phaseIndex: 2,
    name: 'External works',
    startDay: 15,
    plannedDays: 56,
    endDay: 70,
    allowParallel: true,
    parallelNote: 'External facade, pergola & elevation works run in parallel with interior base works',
  },
  {
    phaseIndex: 3,
    name: 'Finishes & joinery',
    startDay: 45,
    plannedDays: 60,
    endDay: 104,
    allowParallel: true,
    parallelNote: 'Primer/putty, ceiling grid, doors & windows overlap across GF/FF/SF zones',
  },
  {
    phaseIndex: 4,
    name: 'Fixtures & commissioning',
    startDay: 95,
    plannedDays: 40,
    endDay: 134,
    allowParallel: true,
    parallelNote: 'Electrical switch plates, sanitary CP fittings & landscaping run in parallel',
  },
  {
    phaseIndex: 5,
    name: 'Snagging & handover',
    startDay: 131,
    plannedDays: 20,
    endDay: 150,
    allowParallel: false,
    parallelNote: 'Final deep cleaning, snagging & handover sequence',
  },
];

function detectFloorTrack(name: string, phase: number): { track: string; allowParallel: boolean } {
  const upper = name.toUpperCase();
  if (upper.startsWith('GF ') || upper.includes('GROUND FLOOR')) {
    return { track: 'Ground Floor (GF)', allowParallel: true };
  }
  if (upper.startsWith('FF ') || upper.includes('FIRST FLOOR')) {
    return { track: 'First Floor (FF)', allowParallel: true };
  }
  if (upper.startsWith('SF ') || upper.includes('SECOND FLOOR') || upper.includes('TERRACE')) {
    return { track: 'Second Floor / Terrace (SF)', allowParallel: true };
  }
  if (upper.startsWith('SHR ') || upper.includes('STAIR') || upper.includes('PERGOLA') || upper.includes('EXTERNAL') || upper.includes('ELEVATION')) {
    return { track: 'External & Structural Envelope', allowParallel: true };
  }
  if (phase === 5) {
    return { track: 'Closeout & Handover (Sequential)', allowParallel: false };
  }
  return { track: `Phase ${phase + 1} General Stream`, allowParallel: true };
}

export function computeConflictFreeSchedule(
  activities: { id: string; order: number; name: string; duration: number | null; phase: number }[],
  overrides: Record<string, ActivityScheduleOverride> = {}
): Map<string, ScheduledActivityMeta> {
  const result = new Map<string, ScheduledActivityMeta>();
  const trackCursors = new Map<string, { nextStartDay: number; lastActivityId: string | null; lastActivityName: string | null }>();

  for (const act of activities) {
    const override = overrides[act.id];
    const baseDuration = act.duration !== null && act.duration > 0 ? act.duration : 2;
    const duration = Math.max(1, Math.min(90, override?.duration ?? baseDuration));
    const detected = detectFloorTrack(act.name, act.phase);
    const allowParallel = override?.allowParallel ?? detected.allowParallel;
    const phaseWindow = DEFAULT_PHASE_WINDOWS[act.phase] || {
      startDay: Math.min(130, act.phase * 22 + 1),
      plannedDays: 25,
    };

    const trackKey = `${act.phase}::${detected.track}`;
    const cursor = trackCursors.get(trackKey) || {
      nextStartDay: phaseWindow.startDay,
      lastActivityId: null,
      lastActivityName: null,
    };

    let startDay: number;
    if (override?.startDay !== undefined && override.startDay >= 1) {
      startDay = !allowParallel
        ? Math.max(override.startDay, cursor.nextStartDay)
        : override.startDay;
    } else {
      startDay = cursor.nextStartDay;
    }

    if (startDay + duration - 1 > 150) {
      startDay = Math.max(1, 150 - duration + 1);
    }
    const endDay = startDay + duration - 1;

    const nextCursorDay = allowParallel
      ? Math.min(150, startDay + Math.max(1, Math.ceil(duration * 0.35)))
      : Math.min(150, endDay + 1);

    trackCursors.set(trackKey, {
      nextStartDay: nextCursorDay,
      lastActivityId: act.id,
      lastActivityName: act.name,
    });

    result.set(act.id, {
      id: act.id,
      order: act.order,
      name: act.name,
      phase: act.phase,
      duration,
      startDay,
      endDay,
      allowParallel,
      parallelTrack: detected.track,
      parallelWithIds: [],
      parallelWithNames: [],
      prerequisiteId: cursor.lastActivityId,
      prerequisiteName: cursor.lastActivityName,
      hasConflict: false,
    });
  }

  const allMetas = Array.from(result.values());
  for (const item of allMetas) {
    const overlapping = allMetas.filter(
      other =>
        other.id !== item.id &&
        other.startDay <= item.endDay &&
        other.endDay >= item.startDay
    );
    item.parallelWithIds = overlapping.map(o => o.id);
    item.parallelWithNames = overlapping.slice(0, 4).map(o => o.name);
    item.hasConflict = item.endDay - item.startDay + 1 !== item.duration;
  }

  return result;
}
