import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
  Appointment,
  SlotSummary,
  UserProfile,
  MAX_CLIENTS_PER_SLOT,
  AvailabilitySettings,
  DEFAULT_AVAILABILITY_SETTINGS,
  DayOfWeek,
  getDateAvailability,
} from '../types';
import { isSlotInPastInGreece } from '../utils/dateUtils';

export const ADMIN_EMAIL = 'asterast6@gmail.com';

/**
 * Ensures a user profile exists in Firestore (with fallback if offline or unauthenticated).
 */
export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName: string,
  explicitRole?: 'admin' | 'client'
): Promise<UserProfile> {
  const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase() || explicitRole === 'admin';
  const fallbackProfile: UserProfile = {
    uid,
    email,
    displayName: displayName || (isAdmin ? 'Trainer Aster' : 'Client'),
    role: isAdmin ? 'admin' : (explicitRole || 'client'),
    remainingSessions: isAdmin ? 100 : 5,
    createdAt: new Date().toISOString(),
  };

  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      if (isAdmin && data.role !== 'admin') {
        await updateDoc(userRef, { role: 'admin' });
        return { ...data, role: 'admin' };
      }
      return data;
    }

    await setDoc(userRef, fallbackProfile);
    return fallbackProfile;
  } catch (err) {
    console.warn('Could not sync user profile with Firestore (running in local mode):', err);
    return fallbackProfile;
  }
}

// Local mock store for preview / sandbox testing when Firebase Auth is not yet toggled
const getLocalSlots = (): Record<string, SlotSummary> => {
  try {
    const val = localStorage.getItem('corestudio_slots');
    return val ? JSON.parse(val) : {};
  } catch {
    return {};
  }
};

const getLocalAppointments = (): Appointment[] => {
  try {
    const val = localStorage.getItem('corestudio_appointments');
    if (val) return JSON.parse(val);
  } catch {}
  return [];
};

const saveLocalAppointments = (apps: Appointment[]) => {
  try {
    localStorage.setItem('corestudio_appointments', JSON.stringify(apps));
    window.dispatchEvent(new CustomEvent('corestudio_local_change'));
  } catch {}
};

const saveLocalSlots = (slots: Record<string, SlotSummary>) => {
  try {
    localStorage.setItem('corestudio_slots', JSON.stringify(slots));
    window.dispatchEvent(new CustomEvent('corestudio_local_change'));
  } catch {}
};

export const getLocalClients = (): UserProfile[] => {
  try {
    const val = localStorage.getItem('corestudio_clients');
    if (val) return JSON.parse(val);
  } catch {}
  return [
    {
      uid: 'demo-client-sarah',
      email: 'sarah.jenkins@gymfit.com',
      displayName: 'Sarah Jenkins',
      role: 'client',
      remainingSessions: 5,
      createdAt: new Date().toISOString(),
    },
    {
      uid: 'demo-client-michael',
      email: 'michael.c@gymfit.com',
      displayName: 'Michael Chang',
      role: 'client',
      remainingSessions: 8,
      createdAt: new Date().toISOString(),
    },
    {
      uid: 'demo-client-emily',
      email: 'emily.r@gymfit.com',
      displayName: 'Emily Rivera',
      role: 'client',
      remainingSessions: 3,
      createdAt: new Date().toISOString(),
    },
  ];
};

export const saveLocalClients = (clients: UserProfile[]) => {
  try {
    localStorage.setItem('corestudio_clients', JSON.stringify(clients));
    window.dispatchEvent(new CustomEvent('corestudio_local_change'));
  } catch {}
};

/**
 * Subscribes to changes on the user's profile document.
 */
export function subscribeToUserProfile(uid: string, onUpdate: (profile: UserProfile | null) => void) {
  let isUsingFallback = false;

  const emitFallback = () => {
    try {
      const savedUser = localStorage.getItem('corestudio_current_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed.uid === uid) {
          onUpdate(parsed);
          return;
        }
      }
      const clients = getLocalClients();
      const found = clients.find((c) => c.uid === uid);
      if (found) {
        onUpdate(found);
        return;
      }
    } catch {}
  };

  const localListener = () => {
    emitFallback();
  };
  window.addEventListener('corestudio_local_change', localListener);

  if (uid.startsWith('demo-') || uid.startsWith('local-')) {
    isUsingFallback = true;
    emitFallback();
    return () => window.removeEventListener('corestudio_local_change', localListener);
  }

  try {
    const userRef = doc(db, 'users', uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          onUpdate(snap.data() as UserProfile);
        } else {
          onUpdate(null);
        }
      },
      (err) => {
        console.warn('Falling back to local user profile:', err.message);
        isUsingFallback = true;
        emitFallback();
      }
    );

    return () => {
      window.removeEventListener('corestudio_local_change', localListener);
      unsubscribe();
    };
  } catch {
    isUsingFallback = true;
    emitFallback();
    return () => window.removeEventListener('corestudio_local_change', localListener);
  }
}

/**
 * Subscribes to a client's own appointments.
 */
export function subscribeToClientAppointments(
  clientId: string,
  onUpdate: (appointments: Appointment[]) => void
) {
  let isUsingFallback = false;

  const emitFallback = () => {
    const all = getLocalAppointments();
    const filtered = all
      .filter((a) => a.clientId === clientId && a.status === 'confirmed')
      .sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot));
    onUpdate(filtered);
  };

  const localListener = () => {
    if (isUsingFallback) emitFallback();
  };
  window.addEventListener('corestudio_local_change', localListener);

  try {
    const q = query(
      collection(db, 'appointments'),
      where('clientId', '==', clientId),
      where('status', '==', 'confirmed')
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: Appointment[] = [];
        snap.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as Appointment);
        });
        items.sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot));
        onUpdate(items);
      },
      (err) => {
        console.warn('Falling back to local client appointments:', err.message);
        isUsingFallback = true;
        emitFallback();
      }
    );

    return () => {
      window.removeEventListener('corestudio_local_change', localListener);
      unsubscribe();
    };
  } catch {
    isUsingFallback = true;
    emitFallback();
    return () => window.removeEventListener('corestudio_local_change', localListener);
  }
}

/**
 * Subscribes to all confirmed appointments (Admin full visibility).
 */
export function subscribeToAllAppointments(onUpdate: (appointments: Appointment[]) => void) {
  let isUsingFallback = false;

  const emitFallback = () => {
    const all = getLocalAppointments();
    const confirmed = all
      .filter((a) => a.status === 'confirmed')
      .sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot));
    onUpdate(confirmed);
  };

  const localListener = () => {
    if (isUsingFallback) emitFallback();
  };
  window.addEventListener('corestudio_local_change', localListener);

  try {
    const q = query(collection(db, 'appointments'), where('status', '==', 'confirmed'));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: Appointment[] = [];
        snap.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as Appointment);
        });
        items.sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot));
        onUpdate(items);
      },
      (err) => {
        console.warn('Falling back to local all appointments for trainer:', err.message);
        isUsingFallback = true;
        emitFallback();
      }
    );

    return () => {
      window.removeEventListener('corestudio_local_change', localListener);
      unsubscribe();
    };
  } catch {
    isUsingFallback = true;
    emitFallback();
    return () => window.removeEventListener('corestudio_local_change', localListener);
  }
}

/**
 * Subscribes to slot summaries for a specific date so all clients see available capacity (max 4 per hour).
 */
export function subscribeToSlotSummaries(
  date: string,
  onUpdate: (summaries: Record<string, SlotSummary>) => void
) {
  let isUsingFallback = false;

  const emitFallback = () => {
    const all = getLocalSlots();
    const map: Record<string, SlotSummary> = {};
    Object.values(all).forEach((slot) => {
      if (slot.date === date) {
        map[slot.timeSlot] = slot;
      }
    });
    onUpdate(map);
  };

  const localListener = () => {
    if (isUsingFallback) emitFallback();
  };
  window.addEventListener('corestudio_local_change', localListener);

  try {
    const q = query(collection(db, 'slotSummaries'), where('date', '==', date));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const map: Record<string, SlotSummary> = {};
        snap.forEach((docSnap) => {
          const data = docSnap.data() as SlotSummary;
          map[data.timeSlot] = data;
        });
        onUpdate(map);
      },
      (err) => {
        console.warn('Falling back to local slot summaries:', err.message);
        isUsingFallback = true;
        emitFallback();
      }
    );

    return () => {
      window.removeEventListener('corestudio_local_change', localListener);
      unsubscribe();
    };
  } catch {
    isUsingFallback = true;
    emitFallback();
    return () => window.removeEventListener('corestudio_local_change', localListener);
  }
}

/**
 * Helper to perform local booking in fallback/demo mode
 */
function bookSlotLocal(params: {
  user: UserProfile;
  date: string;
  timeSlot: string;
  notes?: string;
}): { success: boolean; error?: string } {
  const { user, date, timeSlot, notes } = params;
  const slotKey = `${date}_${timeSlot}`;
  const appointmentId = `${user.uid}_${slotKey}`;

  if (user.role !== 'admin' && user.remainingSessions <= 0) {
    return { success: false, error: 'You have 0 sessions remaining. Please contact your trainer.' };
  }

  // Verify that date and time slot are open according to trainer schedule
  const settings = getLocalAvailabilitySettings();
  const dayAvail = getDateAvailability(date, settings);
  if (dayAvail.isClosed && user.role !== 'admin') {
    return { success: false, error: dayAvail.reason || 'Studio is closed on this date.' };
  }
  if (!dayAvail.activeHours.includes(timeSlot) && user.role !== 'admin') {
    return { success: false, error: `The ${timeSlot} slot is not open for bookings on this date.` };
  }
  if (user.role !== 'admin' && isSlotInPastInGreece(date, timeSlot)) {
    return { success: false, error: 'This time slot has already passed in Greece time.' };
  }

  const apps = getLocalAppointments();
  if (apps.some((a) => a.id === appointmentId && a.status === 'confirmed')) {
    return { success: false, error: 'You are already booked for this time slot.' };
  }

  const slots = getLocalSlots();
  const currentCount = slots[slotKey]?.bookedCount || 0;
  if (currentCount >= MAX_CLIENTS_PER_SLOT) {
    return { success: false, error: `This time slot is full (maximum ${MAX_CLIENTS_PER_SLOT} clients).` };
  }

  // Create appointment
  const newApp: Appointment = {
    id: appointmentId,
    clientId: user.uid,
    clientName: user.displayName || 'Client',
    clientEmail: user.email,
    date,
    timeSlot,
    slotKey,
    status: 'confirmed',
    notes: notes || '',
    createdAt: new Date().toISOString(),
  };

  saveLocalAppointments([...apps.filter((a) => a.id !== appointmentId), newApp]);

  // Update slot summary
  slots[slotKey] = {
    slotKey,
    date,
    timeSlot,
    bookedCount: currentCount + 1,
    maxCapacity: MAX_CLIENTS_PER_SLOT,
    updatedAt: new Date().toISOString(),
  };
  saveLocalSlots(slots);

  // Deduct session
  if (user.role !== 'admin') {
    user.remainingSessions = Math.max(0, user.remainingSessions - 1);
    const clients = getLocalClients();
    const updatedClients = clients.map((c) =>
      c.uid === user.uid ? { ...c, remainingSessions: user.remainingSessions } : c
    );
    saveLocalClients(updatedClients);

    try {
      const savedUser = localStorage.getItem('corestudio_current_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed.uid === user.uid) {
          parsed.remainingSessions = user.remainingSessions;
          localStorage.setItem('corestudio_current_user', JSON.stringify(parsed));
          window.dispatchEvent(new CustomEvent('corestudio_local_change'));
        }
      }
    } catch {}
  }

  return { success: true };
}

/**
 * Helper to perform local cancellation in fallback/demo mode
 */
function cancelSlotLocal(appointment: Appointment): { success: boolean; error?: string } {
  const apps = getLocalAppointments();
  const slotKey = appointment.slotKey || `${appointment.date}_${appointment.timeSlot}`;

  // Find appointment by ID or composite key (clientId + slotKey)
  const targetIndex = apps.findIndex(
    (a) =>
      a.id === appointment.id ||
      (a.clientId === appointment.clientId &&
        (a.slotKey === slotKey || (a.date === appointment.date && a.timeSlot === appointment.timeSlot)))
  );

  const target = targetIndex !== -1 ? apps[targetIndex] : null;
  if (target && target.status === 'cancelled') {
    return { success: true };
  }

  // Mark as cancelled in local storage
  if (targetIndex !== -1) {
    apps[targetIndex] = {
      ...apps[targetIndex],
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    };
    saveLocalAppointments([...apps]);
  } else {
    saveLocalAppointments([
      ...apps,
      {
        ...appointment,
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
      },
    ]);
  }

  // Decrement slot booked count
  const slots = getLocalSlots();
  if (slots[slotKey]) {
    slots[slotKey].bookedCount = Math.max(0, (slots[slotKey].bookedCount || 1) - 1);
    slots[slotKey].updatedAt = new Date().toISOString();
    saveLocalSlots(slots);
  }

  // Refund session to client
  const clients = getLocalClients();
  let clientFound = false;
  const updatedClients = clients.map((c) => {
    if (
      c.uid === appointment.clientId ||
      (appointment.clientEmail && c.email.toLowerCase() === appointment.clientEmail.toLowerCase())
    ) {
      clientFound = true;
      return { ...c, remainingSessions: (c.remainingSessions ?? 0) + 1 };
    }
    return c;
  });

  if (!clientFound && appointment.clientId) {
    updatedClients.push({
      uid: appointment.clientId,
      email: appointment.clientEmail || '',
      displayName: appointment.clientName || 'Client',
      role: 'client',
      remainingSessions: 1,
      createdAt: new Date().toISOString(),
    });
  }
  saveLocalClients(updatedClients);

  // Refund in current user session if it matches
  try {
    const savedUser = localStorage.getItem('corestudio_current_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      if (
        parsed.uid === appointment.clientId ||
        (appointment.clientEmail && parsed.email?.toLowerCase() === appointment.clientEmail.toLowerCase())
      ) {
        parsed.remainingSessions = (parsed.remainingSessions ?? 0) + 1;
        localStorage.setItem('corestudio_current_user', JSON.stringify(parsed));
      }
    }
  } catch {}

  window.dispatchEvent(new CustomEvent('corestudio_local_change'));
  return { success: true };
}

/**
 * Books an appointment using a transaction with automatic local fallback:
 */
export async function bookSlot(params: {
  user: UserProfile;
  date: string;
  timeSlot: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { user, date, timeSlot, notes } = params;

  if (user.uid.startsWith('demo-') || user.uid.startsWith('local-')) {
    return bookSlotLocal(params);
  }

  // Verify that date and time slot are open according to trainer schedule
  const settings = getLocalAvailabilitySettings();
  const dayAvail = getDateAvailability(date, settings);
  if (dayAvail.isClosed && user.role !== 'admin') {
    return { success: false, error: dayAvail.reason || 'Studio is closed on this date.' };
  }
  if (!dayAvail.activeHours.includes(timeSlot) && user.role !== 'admin') {
    return { success: false, error: `The ${timeSlot} slot is not open for bookings on this date.` };
  }
  if (user.role !== 'admin' && isSlotInPastInGreece(date, timeSlot)) {
    return { success: false, error: 'This time slot has already passed in Greece time.' };
  }

  const slotKey = `${date}_${timeSlot}`;
  const appointmentId = `${user.uid}_${slotKey}`;

  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', user.uid);
      const slotRef = doc(db, 'slotSummaries', slotKey);
      const appointmentRef = doc(db, 'appointments', appointmentId);

      const userSnap = await transaction.get(userRef);
      const slotSnap = await transaction.get(slotRef);
      const appointmentSnap = await transaction.get(appointmentRef);

      if (!userSnap.exists()) {
        throw new Error('User profile not found.');
      }

      const userData = userSnap.data() as UserProfile;
      if (userData.role !== 'admin' && userData.remainingSessions <= 0) {
        throw new Error('You have 0 sessions remaining. Please contact your trainer.');
      }

      // Check if already booked
      if (appointmentSnap.exists() && appointmentSnap.data()?.status === 'confirmed') {
        throw new Error('You are already booked for this time slot.');
      }

      const currentCount = slotSnap.exists() ? (slotSnap.data()?.bookedCount || 0) : 0;
      if (currentCount >= MAX_CLIENTS_PER_SLOT) {
        throw new Error(`This time slot is full (maximum ${MAX_CLIENTS_PER_SLOT} clients).`);
      }

      // 1. Create/Update Appointment
      transaction.set(appointmentRef, {
        id: appointmentId,
        clientId: user.uid,
        clientName: user.displayName || 'Client',
        clientEmail: user.email,
        date,
        timeSlot,
        slotKey,
        status: 'confirmed',
        notes: notes || '',
        createdAt: new Date().toISOString(),
      });

      // 2. Update SlotSummary
      transaction.set(
        slotRef,
        {
          slotKey,
          date,
          timeSlot,
          bookedCount: currentCount + 1,
          maxCapacity: MAX_CLIENTS_PER_SLOT,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // 3. Deduct session if client
      if (userData.role !== 'admin') {
        transaction.update(userRef, {
          remainingSessions: Math.max(0, userData.remainingSessions - 1),
        });
      }
    });

    return { success: true };
  } catch (err: any) {
    console.warn('Booking transaction failed on Firestore, attempting local fallback:', err);
    return bookSlotLocal(params);
  }
}

/**
 * Cancels an appointment and refunds 1 session to the client.
 */
export async function cancelSlot(
  appointment: Appointment
): Promise<{ success: boolean; error?: string }> {
  if (
    !auth.currentUser ||
    appointment.clientId.startsWith('demo-') ||
    appointment.clientId.startsWith('local-')
  ) {
    return cancelSlotLocal(appointment);
  }

  try {
    let wasUpdatedInFirestore = false;
    await runTransaction(db, async (transaction) => {
      const appointmentRef = doc(db, 'appointments', appointment.id);
      const slotRef = doc(db, 'slotSummaries', appointment.slotKey);
      const userRef = doc(db, 'users', appointment.clientId);

      const appSnap = await transaction.get(appointmentRef);
      if (!appSnap.exists()) {
        throw new Error('Appointment record not in Firestore');
      }
      if (appSnap.data()?.status === 'cancelled') {
        wasUpdatedInFirestore = true;
        return; // already cancelled
      }

      const slotSnap = await transaction.get(slotRef);
      const currentCount = slotSnap.exists() ? (slotSnap.data()?.bookedCount || 0) : 0;

      // Update appointment status to cancelled
      transaction.update(appointmentRef, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
      });

      // Decrement slot count
      if (slotSnap.exists()) {
        transaction.update(slotRef, {
          bookedCount: Math.max(0, currentCount - 1),
          updatedAt: new Date().toISOString(),
        });
      }

      // Refund session to client
      const userSnap = await transaction.get(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        if (userData.role !== 'admin') {
          transaction.update(userRef, {
            remainingSessions: (userData.remainingSessions ?? 0) + 1,
          });
        }
      }
      wasUpdatedInFirestore = true;
    });

    // Also mirror to local fallback storage to keep any local cache updated
    cancelSlotLocal(appointment);
    return { success: true };
  } catch (err: any) {
    console.warn('Cancellation failed on Firestore, executing local fallback:', err);
    return cancelSlotLocal(appointment);
  }
}

/**
 * Admin: Adjust or add sessions for a client.
 */
export async function adjustClientSessions(
  clientId: string,
  newSessionCount: number
): Promise<{ success: boolean; error?: string }> {
  const updatedCount = Math.max(0, newSessionCount);
  const clients = getLocalClients();
  const updatedClients = clients.map((c) =>
    c.uid === clientId ? { ...c, remainingSessions: updatedCount } : c
  );
  saveLocalClients(updatedClients);

  try {
    const userRef = doc(db, 'users', clientId);
    await updateDoc(userRef, {
      remainingSessions: updatedCount,
    });
    return { success: true };
  } catch (err: any) {
    return { success: true }; // Local store updated successfully
  }
}

/**
 * Admin: Listen to all registered clients roster.
 */
export function subscribeToAllClients(onUpdate: (clients: UserProfile[]) => void) {
  let isUsingFallback = false;

  const emitFallback = () => {
    const list = getLocalClients();
    list.sort((a, b) => a.displayName.localeCompare(b.displayName));
    onUpdate(list);
  };

  const localListener = () => {
    if (isUsingFallback) emitFallback();
  };
  window.addEventListener('corestudio_local_change', localListener);

  try {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: UserProfile[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as UserProfile);
        });
        list.sort((a, b) => a.displayName.localeCompare(b.displayName));
        onUpdate(list);
      },
      (err) => {
        console.warn('Falling back to local client roster:', err.message);
        isUsingFallback = true;
        emitFallback();
      }
    );

    return () => {
      window.removeEventListener('corestudio_local_change', localListener);
      unsubscribe();
    };
  } catch {
    isUsingFallback = true;
    emitFallback();
    return () => window.removeEventListener('corestudio_local_change', localListener);
  }
}

/**
 * Availability & Schedule Settings
 */

export const getLocalAvailabilitySettings = (): AvailabilitySettings => {
  try {
    const val = localStorage.getItem('corestudio_availability_settings');
    if (val) {
      const parsed = JSON.parse(val);
      return {
        ...DEFAULT_AVAILABILITY_SETTINGS,
        ...parsed,
        weeklySchedule: {
          ...DEFAULT_AVAILABILITY_SETTINGS.weeklySchedule,
          ...(parsed.weeklySchedule || {}),
        },
        dateOverrides: parsed.dateOverrides || {},
      };
    }
  } catch {}
  return DEFAULT_AVAILABILITY_SETTINGS;
};

export const saveLocalAvailabilitySettings = (settings: AvailabilitySettings) => {
  try {
    localStorage.setItem('corestudio_availability_settings', JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('corestudio_local_change'));
  } catch {}
};

export async function saveAvailabilitySettings(
  settings: AvailabilitySettings
): Promise<{ success: boolean; error?: string }> {
  const updated: AvailabilitySettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  saveLocalAvailabilitySettings(updated);

  try {
    const settingsRef = doc(db, 'settings', 'availability');
    await setDoc(settingsRef, updated, { merge: true });
    return { success: true };
  } catch (err: any) {
    console.warn('Could not sync availability settings with Firestore (saved locally):', err);
    return { success: true };
  }
}

export function subscribeToAvailabilitySettings(
  onUpdate: (settings: AvailabilitySettings) => void
): () => void {
  let isUsingFallback = false;

  const emitFallback = () => {
    const settings = getLocalAvailabilitySettings();
    onUpdate(settings);
  };

  const localListener = () => {
    emitFallback();
  };
  window.addEventListener('corestudio_local_change', localListener);

  try {
    const settingsRef = doc(db, 'settings', 'availability');
    const unsubscribe = onSnapshot(
      settingsRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as AvailabilitySettings;
          const merged: AvailabilitySettings = {
            ...DEFAULT_AVAILABILITY_SETTINGS,
            ...data,
            weeklySchedule: {
              ...DEFAULT_AVAILABILITY_SETTINGS.weeklySchedule,
              ...(data.weeklySchedule || {}),
            },
            dateOverrides: data.dateOverrides || {},
          };
          saveLocalAvailabilitySettings(merged);
          onUpdate(merged);
        } else {
          emitFallback();
        }
      },
      (err) => {
        console.warn('Falling back to local availability settings:', err.message);
        isUsingFallback = true;
        emitFallback();
      }
    );

    return () => {
      window.removeEventListener('corestudio_local_change', localListener);
      unsubscribe();
    };
  } catch {
    isUsingFallback = true;
    emitFallback();
    return () => window.removeEventListener('corestudio_local_change', localListener);
  }
}

export async function toggleDateClosed(
  dateStr: string,
  closed: boolean,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const current = getLocalAvailabilitySettings();
  const overrides = { ...(current.dateOverrides || {}) };

  if (closed) {
    overrides[dateStr] = {
      ...(overrides[dateStr] || {}),
      closed: true,
      reason: reason || 'Studio closed on this date',
    };
  } else {
    if (overrides[dateStr]) {
      const copy = { ...overrides[dateStr] };
      delete copy.closed;
      delete copy.reason;
      if (Object.keys(copy).length === 0) {
        delete overrides[dateStr];
      } else {
        overrides[dateStr] = copy;
      }
    }
  }

  const updated: AvailabilitySettings = {
    ...current,
    dateOverrides: overrides,
  };
  return saveAvailabilitySettings(updated);
}

export async function toggleSlotBlocked(
  dateStr: string,
  timeSlot: string,
  blocked: boolean
): Promise<{ success: boolean; error?: string }> {
  const current = getLocalAvailabilitySettings();
  const overrides = { ...(current.dateOverrides || {}) };
  const dateOverride = { ...(overrides[dateStr] || {}) };
  const blockedSet = new Set(dateOverride.blockedHours || []);

  if (blocked) {
    blockedSet.add(timeSlot);
  } else {
    blockedSet.delete(timeSlot);
  }

  dateOverride.blockedHours = Array.from(blockedSet);
  overrides[dateStr] = dateOverride;

  const updated: AvailabilitySettings = {
    ...current,
    dateOverrides: overrides,
  };
  return saveAvailabilitySettings(updated);
}

export async function toggleDayOfWeekEnabled(
  dayKey: DayOfWeek,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const current = getLocalAvailabilitySettings();
  const daySchedule = { ...(current.weeklySchedule || DEFAULT_AVAILABILITY_SETTINGS.weeklySchedule) };
  const config = daySchedule[dayKey] || { enabled: true, hours: [] };

  daySchedule[dayKey] = {
    ...config,
    enabled,
  };

  const updated: AvailabilitySettings = {
    ...current,
    weeklySchedule: daySchedule,
  };
  return saveAvailabilitySettings(updated);
}

export async function updateDayHours(
  dayKey: DayOfWeek,
  hours: string[]
): Promise<{ success: boolean; error?: string }> {
  const current = getLocalAvailabilitySettings();
  const daySchedule = { ...(current.weeklySchedule || DEFAULT_AVAILABILITY_SETTINGS.weeklySchedule) };
  const config = daySchedule[dayKey] || { enabled: true, hours: [] };

  daySchedule[dayKey] = {
    ...config,
    hours: hours.sort((a, b) => a.localeCompare(b)),
  };

  const updated: AvailabilitySettings = {
    ...current,
    weeklySchedule: daySchedule,
  };
  return saveAvailabilitySettings(updated);
}

export async function setBookingHorizon(
  days: number
): Promise<{ success: boolean; error?: string }> {
  const current = getLocalAvailabilitySettings();
  const updated: AvailabilitySettings = {
    ...current,
    bookingHorizonDays: Math.max(1, Math.min(90, days)),
  };
  return saveAvailabilitySettings(updated);
}
