export type UserRole = 'admin' | 'client';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  remainingSessions: number;
  phone?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "09:00"
  slotKey: string; // "2026-09-22_09:00"
  status: 'confirmed' | 'cancelled';
  notes?: string;
  createdAt: string;
  cancelledAt?: string;
}

export interface SlotSummary {
  slotKey: string;
  date: string;
  timeSlot: string;
  bookedCount: number;
  maxCapacity: number;
  updatedAt?: string;
}

export const MAX_CLIENTS_PER_SLOT = 4;

export const ALL_POSSIBLE_HOURS = [
  '06:00',
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
];

export const AVAILABLE_HOURS = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
];

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface DayScheduleConfig {
  enabled: boolean;
  hours: string[];
}

export interface DateOverride {
  closed?: boolean;
  isClosed?: boolean;
  reason?: string;
  blockedHours?: string[]; // Hours explicitly blocked on this date
  extraHours?: string[]; // Extra hours explicitly opened on this date
}

export interface AvailabilitySettings {
  bookingHorizonDays: number; // e.g. 7, 14, 30, 60 days
  weeklySchedule: Record<DayOfWeek, DayScheduleConfig>;
  dateOverrides: Record<string, DateOverride>; // key is YYYY-MM-DD
  updatedAt?: string;
}

export const DAYS_OF_WEEK: {
  key: DayOfWeek;
  label: string;
  short: string;
  dayIndex: number;
}[] = [
  { key: 'monday', label: 'Monday', short: 'Mon', dayIndex: 1 },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue', dayIndex: 2 },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed', dayIndex: 3 },
  { key: 'thursday', label: 'Thursday', short: 'Thu', dayIndex: 4 },
  { key: 'friday', label: 'Friday', short: 'Fri', dayIndex: 5 },
  { key: 'saturday', label: 'Saturday', short: 'Sat', dayIndex: 6 },
  { key: 'sunday', label: 'Sunday', short: 'Sun', dayIndex: 0 },
];

export const DEFAULT_AVAILABILITY_SETTINGS: AvailabilitySettings = {
  bookingHorizonDays: 14,
  weeklySchedule: {
    monday: {
      enabled: true,
      hours: ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
    },
    tuesday: {
      enabled: true,
      hours: ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
    },
    wednesday: {
      enabled: true,
      hours: ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
    },
    thursday: {
      enabled: true,
      hours: ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
    },
    friday: {
      enabled: true,
      hours: ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    },
    saturday: {
      enabled: true,
      hours: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'],
    },
    sunday: {
      enabled: false,
      hours: [],
    },
  },
  dateOverrides: {},
};

export function getDayOfWeekFromDate(dateStr: string): DayOfWeek {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  switch (day) {
    case 0:
      return 'sunday';
    case 1:
      return 'monday';
    case 2:
      return 'tuesday';
    case 3:
      return 'wednesday';
    case 4:
      return 'thursday';
    case 5:
      return 'friday';
    case 6:
      return 'saturday';
    default:
      return 'monday';
  }
}

export function getDateAvailability(
  dateStr: string,
  settings: AvailabilitySettings
): {
  isClosed: boolean;
  reason?: string;
  activeHours: string[];
  blockedHours: string[];
  isOverridden: boolean;
  isRegularDayOff: boolean;
} {
  const dayKey = getDayOfWeekFromDate(dateStr);
  const dayConfig = settings.weeklySchedule?.[dayKey] ?? DEFAULT_AVAILABILITY_SETTINGS.weeklySchedule[dayKey];
  const override = settings.dateOverrides?.[dateStr];

  // Specific date explicitly marked closed
  if (override?.closed || override?.isClosed) {
    return {
      isClosed: true,
      reason: override.reason || 'Studio closed by trainer on this date',
      activeHours: [],
      blockedHours: override.blockedHours || [],
      isOverridden: true,
      isRegularDayOff: false,
    };
  }

  // Weekly day off and no extra hours opened for this specific date
  if (!dayConfig?.enabled && (!override?.extraHours || override.extraHours.length === 0)) {
    return {
      isClosed: true,
      reason: `Studio closed on ${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}s`,
      activeHours: [],
      blockedHours: override?.blockedHours || [],
      isOverridden: false,
      isRegularDayOff: true,
    };
  }

  // Base hours from day config or fallback
  const baseHours = [...(dayConfig?.hours || [])];
  if (override?.extraHours) {
    for (const h of override.extraHours) {
      if (!baseHours.includes(h)) baseHours.push(h);
    }
  }

  const blocked = new Set(override?.blockedHours || []);
  const activeHours = baseHours
    .filter((h) => !blocked.has(h))
    .sort((a, b) => a.localeCompare(b));

  const hasOverrides = Boolean(
    override &&
      (override.closed ||
        override.isClosed ||
        (override.blockedHours && override.blockedHours.length > 0) ||
        (override.extraHours && override.extraHours.length > 0) ||
        override.reason)
  );

  return {
    isClosed: activeHours.length === 0,
    reason: activeHours.length === 0 ? override?.reason || 'No open time slots on this date' : undefined,
    activeHours,
    blockedHours: override?.blockedHours || [],
    isOverridden: hasOverrides,
    isRegularDayOff: false,
  };
}
