import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Appointment,
  SlotSummary,
  AVAILABLE_HOURS,
  MAX_CLIENTS_PER_SLOT,
  AvailabilitySettings,
  DEFAULT_AVAILABILITY_SETTINGS,
  getDateAvailability,
} from '../types';
import {
  subscribeToClientAppointments,
  subscribeToSlotSummaries,
  subscribeToAvailabilitySettings,
  getLocalAvailabilitySettings,
  bookSlot,
  cancelSlot,
} from '../services/bookingService';
import {
  formatTimeSlot,
  formatFullDate,
  formatShortDate,
  getTodayString,
  getUpcomingDays,
  useGreeceTime,
  isSlotInPastInGreece,
} from '../utils/dateUtils';
import {
  Calendar as CalendarIcon,
  Clock,
  Ticket,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Dumbbell,
  LogOut,
  ChevronRight,
  Info,
  CalendarCheck,
  CalendarX,
  User,
  Sparkles,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export function ClientDashboard() {
  const { userProfile, signOut } = useAuth();
  const greeceTime = useGreeceTime();
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [slotSummaries, setSlotSummaries] = useState<Record<string, SlotSummary>>({});
  const [activeTab, setActiveTab] = useState<'calendar' | 'appointments'>('calendar');

  // Booking modal / state
  const [bookingSlotTime, setBookingSlotTime] = useState<string | null>(null);
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cancellation modal state
  const [cancellingApp, setCancellingApp] = useState<Appointment | null>(null);

  // Trainer Schedule & Availability Settings
  const [availabilitySettings, setAvailabilitySettings] = useState<AvailabilitySettings>(getLocalAvailabilitySettings());

  // Subscribe to trainer availability settings
  useEffect(() => {
    const unsub = subscribeToAvailabilitySettings((settings) => {
      setAvailabilitySettings(settings);
    });
    return () => unsub();
  }, []);

  // Subscribe to client's own appointments
  useEffect(() => {
    if (!userProfile?.uid) return;
    const unsub = subscribeToClientAppointments(userProfile.uid, (appointments) => {
      setMyAppointments(appointments);
    });
    return () => unsub();
  }, [userProfile?.uid]);

  // Subscribe to slot summaries for the selected date
  useEffect(() => {
    const unsub = subscribeToSlotSummaries(selectedDate, (summaries) => {
      setSlotSummaries(summaries);
    });
    return () => unsub();
  }, [selectedDate]);

  const bookingHorizon = availabilitySettings.bookingHorizonDays || 14;
  const upcomingDays = getUpcomingDays(bookingHorizon);
  const selectedDayAvail = getDateAvailability(selectedDate, availabilitySettings);

  // Check if client is booked in a particular slot
  const isBookedInSlot = (timeSlot: string) => {
    return myAppointments.some((app) => app.date === selectedDate && app.timeSlot === timeSlot);
  };

  const getAppointmentForSlot = (timeSlot: string) => {
    return myAppointments.find((app) => app.date === selectedDate && app.timeSlot === timeSlot);
  };

  // Handle booking confirm
  const handleConfirmBooking = async () => {
    if (!userProfile || !bookingSlotTime) return;
    setActionLoading(true);
    setActionMessage(null);

    const res = await bookSlot({
      user: userProfile,
      date: selectedDate,
      timeSlot: bookingSlotTime,
      notes: workoutNotes.trim(),
    });

    setActionLoading(false);
    if (res.success) {
      setActionMessage({
        type: 'success',
        text: `Successfully booked ${formatTimeSlot(bookingSlotTime)} on ${formatShortDate(selectedDate)}!`,
      });
      setBookingSlotTime(null);
      setWorkoutNotes('');
      // Auto-clear message after 5s
      setTimeout(() => setActionMessage(null), 5000);
    } else {
      setActionMessage({
        type: 'error',
        text: res.error || 'Booking could not be completed.',
      });
    }
  };

  // Handle cancellation modal trigger
  const handleCancelClick = (app: Appointment) => {
    setCancellingApp(app);
  };

  const confirmCancellation = async () => {
    if (!cancellingApp) return;
    const targetApp = cancellingApp;
    setActionLoading(true);
    setActionMessage(null);
    setCancellingApp(null);

    const res = await cancelSlot(targetApp);
    setActionLoading(false);
    if (res.success) {
      setActionMessage({
        type: 'success',
        text: `Appointment for ${formatShortDate(targetApp.date)} at ${formatTimeSlot(targetApp.timeSlot)} cancelled. 1 session credit has been refunded to your balance.`,
      });
      setTimeout(() => setActionMessage(null), 5000);
    } else {
      setActionMessage({
        type: 'error',
        text: res.error || 'Failed to cancel appointment.',
      });
    }
  };

  const remainingSessions = userProfile?.remainingSessions ?? 0;
  const upcomingCount = myAppointments.filter((a) => a.date >= getTodayString()).length;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-16">
      {/* Top Navigation */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-sm">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-stone-900 leading-tight">CoreStudio Training</h1>
              <p className="text-xs text-stone-500">Client Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live Greece Time Badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 text-xs text-stone-700 shadow-2xs"
              title="Studio schedule runs on Greece local time (Europe/Athens)"
            >
              <span className="text-xs">🇬🇷</span>
              <span className="hidden md:inline text-stone-500 font-medium">Greece:</span>
              <span className="font-bold text-stone-900 font-mono tracking-tight">{greeceTime.timeWithSeconds}</span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded">
                {greeceTime.tzAbbr}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs text-stone-600 bg-stone-100 px-3 py-1.5 rounded-full">
              <User className="w-3.5 h-3.5 text-stone-500" />
              <span className="font-medium text-stone-900">{userProfile?.displayName}</span>
              <span className="text-stone-400">•</span>
              <span>{userProfile?.email}</span>
            </div>

            <button
              id="client-signout-btn"
              onClick={() => signOut()}
              className="flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 py-1.5 px-2.5 rounded-lg hover:bg-stone-100 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Banner Alert if any */}
        {actionMessage && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-start justify-between shadow-sm transition-all ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {actionMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span className="text-sm font-medium">{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-xs font-semibold opacity-60 hover:opacity-100 ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Client Account & Sessions Summary Card */}
        <section className="bg-white border border-stone-200 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100 text-stone-700 text-xs font-medium mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Your Personal Account</span>
              </div>
              <h2 className="text-2xl font-bold text-stone-900 font-display">
                Hello, {userProfile?.displayName}!
              </h2>
              <p className="text-sm text-stone-600 mt-1">
                Select your preferred day and hourly slot below. Max 4 clients per session.
              </p>
            </div>

            {/* Remaining Sessions Highlight */}
            <div className="flex items-center gap-4 bg-stone-50 border border-stone-200/80 rounded-xl p-4 sm:min-w-[280px]">
              <div className="w-12 h-12 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0">
                <Ticket className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Remaining Sessions
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span
                    id="remaining-sessions-count"
                    className={`text-3xl font-extrabold ${
                      remainingSessions > 0 ? 'text-stone-900' : 'text-red-600'
                    }`}
                  >
                    {remainingSessions}
                  </span>
                  <span className="text-xs text-stone-500">
                    {remainingSessions === 1 ? 'session' : 'sessions'} available
                  </span>
                </div>
                {remainingSessions === 0 ? (
                  <span className="inline-block mt-1 text-xs text-red-600 font-medium">
                    Contact trainer to replenish sessions
                  </span>
                ) : (
                  <span className="inline-block mt-1 text-xs text-stone-500">
                    1 session deducted per booking
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* View Tabs */}
        <div className="flex items-center gap-2 border-b border-stone-200 mb-6">
          <button
            id="tab-view-calendar"
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition ${
              activeTab === 'calendar'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Book Appointments (Calendar)</span>
          </button>
          <button
            id="tab-view-appointments"
            onClick={() => setActiveTab('appointments')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition ${
              activeTab === 'appointments'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>My Bookings</span>
            {upcomingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-stone-900 text-white text-xs font-bold">
                {upcomingCount}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: CALENDAR & BOOKING */}
        {activeTab === 'calendar' && (
          <div>
            {/* Date Selector Strip */}
            <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-stone-800 uppercase tracking-wider">
                    Select a Date
                  </h3>
                  <p className="text-base font-medium text-stone-900 mt-0.5">
                    {formatFullDate(selectedDate)}
                  </p>
                </div>

                {/* Direct Date Picker */}
                <div className="flex items-center gap-2">
                  <label htmlFor="calendar-date-picker" className="text-xs font-medium text-stone-600">
                    Jump to date:
                  </label>
                  <input
                    id="calendar-date-picker"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) setSelectedDate(e.target.value);
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 text-stone-800 bg-stone-50 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
              </div>

              {/* Booking Horizon Quick Pill Strip */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {upcomingDays.map((day) => {
                  const isSelected = day.dateStr === selectedDate;
                  const dayAvail = getDateAvailability(day.dateStr, availabilitySettings);

                  return (
                    <button
                      key={day.dateStr}
                      id={`day-select-${day.dateStr}`}
                      onClick={() => setSelectedDate(day.dateStr)}
                      className={`flex flex-col items-center justify-center min-w-[72px] sm:min-w-[84px] p-2.5 rounded-xl border text-center transition shrink-0 ${
                        isSelected
                          ? 'bg-stone-900 text-white border-stone-900 shadow-sm font-semibold'
                          : dayAvail.isClosed
                          ? 'bg-stone-100/70 hover:bg-stone-100 text-stone-400 border-stone-200'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      <span className="text-[11px] uppercase tracking-tight opacity-80">{day.label}</span>
                      <span className="text-sm font-bold mt-0.5">{day.subLabel}</span>
                      {dayAvail.isClosed && (
                        <span
                          className={`text-[9px] mt-1 px-1.5 py-0.2 rounded-full font-medium ${
                            isSelected ? 'bg-stone-800 text-amber-300' : 'bg-stone-200 text-stone-500'
                          }`}
                        >
                          Closed
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hourly Slots Grid or Closed Banner */}
            {selectedDayAvail.isClosed ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-8 sm:p-10 text-center shadow-sm">
                <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                  <CalendarX className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-stone-900">Studio Closed on This Date</h3>
                <p className="text-sm text-stone-600 max-w-md mx-auto mt-1.5">
                  {selectedDayAvail.reason || 'Trainer Aster has closed bookings for this date.'}
                </p>
                <div className="mt-5">
                  <span className="text-xs font-medium text-stone-500 bg-stone-100 px-3.5 py-1.5 rounded-full inline-block">
                    Please select an open date from the calendar strip above to reserve your session.
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-200 gap-2 mb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-stone-900">
                        Hourly Time Slots
                      </h3>
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1">
                        <span>🇬🇷</span>
                        <span>Athens Time ({greeceTime.tzAbbr})</span>
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      Times are displayed in 24-hour Greece local time (Europe/Athens). Max 4 clients per hourly slot.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-stone-600">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>Open</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span>Filling Fast</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                      <span>Full (4/4)</span>
                    </div>
                  </div>
                </div>

                {(() => {
                  const clientBookedSlots = myAppointments
                    .filter((app) => app.date === selectedDate && app.status === 'confirmed')
                    .map((app) => app.timeSlot);

                  const displayHours = Array.from(
                    new Set([...selectedDayAvail.activeHours, ...clientBookedSlots])
                  ).sort((a, b) => a.localeCompare(b));

                  if (displayHours.length === 0) {
                    return (
                      <div className="py-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
                          <Clock className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-bold text-stone-900">No Open Hours for Booking</h4>
                        <p className="text-xs text-stone-500 mt-1">
                          No training hours are open on this date. Please select another date.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {displayHours.map((hour) => {
                        const summary = slotSummaries[hour];
                        const bookedCount = summary?.bookedCount || 0;
                        const availableSpots = Math.max(0, MAX_CLIENTS_PER_SLOT - bookedCount);
                        const isFull = bookedCount >= MAX_CLIENTS_PER_SLOT;
                        const bookedByMe = isBookedInSlot(hour);
                        const myApp = getAppointmentForSlot(hour);
                        const isPast = isSlotInPastInGreece(selectedDate, hour);

                        return (
                          <div
                            key={hour}
                            id={`slot-card-${hour}`}
                            className={`border rounded-xl p-4 transition-all ${
                              bookedByMe
                                ? 'border-emerald-400 bg-emerald-50/50 ring-1 ring-emerald-400'
                                : isPast
                                ? 'border-stone-200 bg-stone-50/60 opacity-65'
                                : isFull
                                ? 'border-stone-200 bg-stone-50/70 opacity-70'
                                : 'border-stone-200 bg-white hover:border-stone-400 shadow-xs'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-stone-500" />
                                <span className="font-semibold text-stone-900 text-sm">
                                  {formatTimeSlot(hour)}
                                </span>
                              </div>

                              {/* Capacity Status Pill */}
                              {bookedByMe ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                                  Booked
                                </span>
                              ) : isPast ? (
                                <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 text-xs font-medium">
                                  Ended
                                </span>
                              ) : isFull ? (
                                <span className="px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 text-xs font-medium">
                                  Full (4/4)
                                </span>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    availableSpots === 1
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  {availableSpots} {availableSpots === 1 ? 'spot' : 'spots'} left
                                </span>
                              )}
                            </div>

                            {/* Visual 4-capacity dots */}
                            <div className="flex items-center gap-1.5 mb-4">
                              {[0, 1, 2, 3].map((dotIdx) => {
                                const isOccupied = dotIdx < bookedCount;
                                return (
                                  <div
                                    key={dotIdx}
                                    title={isOccupied ? 'Spot taken' : 'Spot open'}
                                    className={`h-2 flex-1 rounded-full ${
                                      isOccupied
                                        ? bookedByMe && dotIdx === bookedCount - 1
                                          ? 'bg-emerald-500'
                                          : 'bg-stone-600'
                                        : 'bg-stone-200'
                                    }`}
                                  />
                                );
                              })}
                            </div>

                            {/* Actions */}
                            <div>
                              {bookedByMe && myApp ? (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-emerald-700 font-medium">
                                    {isPast ? 'Attending / Completed' : 'Your spot confirmed'}
                                  </span>
                                  {!isPast && (
                                    <button
                                      id={`cancel-slot-${hour}`}
                                      onClick={() => handleCancelClick(myApp)}
                                      disabled={actionLoading}
                                      className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline py-1 px-2 rounded disabled:opacity-50"
                                    >
                                      Cancel Booking
                                    </button>
                                  )}
                                </div>
                              ) : isPast ? (
                                <button
                                  disabled
                                  className="w-full py-2 px-3 rounded-lg bg-stone-100 text-stone-400 text-xs font-medium cursor-not-allowed text-center"
                                >
                                  Slot has passed (Greece Time)
                                </button>
                              ) : isFull ? (
                                <button
                                  disabled
                                  className="w-full py-2 px-3 rounded-lg bg-stone-100 text-stone-400 text-xs font-medium cursor-not-allowed text-center"
                                >
                                  Slot Fully Booked
                                </button>
                              ) : remainingSessions <= 0 ? (
                                <button
                                  disabled
                                  title="You have 0 sessions remaining. Contact your trainer."
                                  className="w-full py-2 px-3 rounded-lg bg-stone-100 text-stone-400 text-xs font-medium cursor-not-allowed text-center"
                                >
                                  No Sessions Left
                                </button>
                              ) : (
                                <button
                                  id={`book-slot-btn-${hour}`}
                                  onClick={() => {
                                    setBookingSlotTime(hour);
                                    setWorkoutNotes('');
                                  }}
                                  className="w-full py-2 px-3 rounded-lg bg-stone-900 text-white hover:bg-stone-800 text-xs font-medium transition shadow-xs flex items-center justify-center gap-1.5"
                                >
                                  <span>Book This Slot</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-6">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Your Booked Appointments</h3>
                <p className="text-xs text-stone-500">
                  Visible only to you and your trainer. You may cancel anytime to restore your session credit.
                </p>
              </div>
              <span className="text-xs font-medium text-stone-600 bg-stone-100 px-3 py-1 rounded-full">
                {myAppointments.length} total {myAppointments.length === 1 ? 'booking' : 'bookings'}
              </span>
            </div>

            {myAppointments.length === 0 ? (
              <div className="text-center py-12 px-4">
                <CalendarIcon className="w-12 h-12 mx-auto text-stone-300 mb-3" />
                <h4 className="text-base font-semibold text-stone-900">No appointments scheduled</h4>
                <p className="text-sm text-stone-500 mt-1 max-w-sm mx-auto">
                  You do not have any active training appointments. Head over to the calendar to select an available time slot.
                </p>
                <button
                  onClick={() => setActiveTab('calendar')}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition"
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span>Browse Available Slots</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myAppointments.map((app) => (
                  <div
                    key={app.id}
                    id={`my-appointment-card-${app.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-stone-900 text-white flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] uppercase font-bold tracking-tight text-amber-400">
                          {formatShortDate(app.date).split(' ')[0]}
                        </span>
                        <span className="text-xs font-extrabold leading-none">
                          {app.date.split('-')[2]}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-sm">
                            {formatFullDate(app.date)}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                            Confirmed
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-stone-600 mt-1">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          <span>{formatTimeSlot(app.timeSlot)}</span>
                          <span className="text-stone-300">•</span>
                          <span>Coach Aster Studio</span>
                        </div>
                        {app.notes && (
                          <p className="text-xs text-stone-500 italic mt-1 bg-white/80 px-2 py-1 rounded border border-stone-200">
                            Notes: "{app.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:self-center self-end">
                      <button
                        id={`cancel-booking-btn-${app.id}`}
                        onClick={() => handleCancelClick(app)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition disabled:opacity-50"
                      >
                        Cancel & Refund Session
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Booking Confirmation Dialog Modal */}
      {bookingSlotTime && (
        <div
          id="booking-confirm-modal"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-stone-900" />
                <h3 className="font-bold text-stone-900 text-base">Confirm Training Session</h3>
              </div>
              <button
                onClick={() => setBookingSlotTime(null)}
                className="text-stone-400 hover:text-stone-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 mb-5">
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5 text-xs text-stone-700">
                <div className="flex justify-between">
                  <span className="text-stone-500">Date:</span>
                  <span className="font-semibold text-stone-900">{formatFullDate(selectedDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Time (Greece):</span>
                  <span className="font-semibold text-stone-900">
                    {formatTimeSlot(bookingSlotTime)} ({greeceTime.tzAbbr})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Capacity:</span>
                  <span className="font-semibold text-stone-900">
                    Max 4 clients (
                    {MAX_CLIENTS_PER_SLOT - (slotSummaries[bookingSlotTime]?.bookedCount || 0)} spot(s) remaining)
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-stone-200">
                  <span className="text-stone-500">Session Cost:</span>
                  <span className="font-semibold text-stone-900">
                    1 session ({remainingSessions} → {remainingSessions - 1} remaining)
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="booking-notes-input"
                  className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1"
                >
                  Session Goals / Notes (Optional)
                </label>
                <textarea
                  id="booking-notes-input"
                  rows={2}
                  value={workoutNotes}
                  onChange={(e) => setWorkoutNotes(e.target.value)}
                  placeholder="e.g. Focus on lower body, recovering from shoulder strain..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setBookingSlotTime(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
              >
                Go Back
              </button>
              <button
                id="modal-confirm-booking-btn"
                type="button"
                onClick={handleConfirmBooking}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition shadow-sm disabled:opacity-50"
              >
                {actionLoading ? 'Booking...' : 'Confirm Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog Modal */}
      {cancellingApp && (
        <div
          id="cancel-confirm-modal"
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-base">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <span>Cancel & Refund Session</span>
              </div>
              <button
                type="button"
                onClick={() => setCancellingApp(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-stone-600 mb-4">
              Are you sure you want to cancel your session on{' '}
              <strong className="text-stone-900">{formatShortDate(cancellingApp.date)}</strong> at{' '}
              <strong className="text-stone-900">{formatTimeSlot(cancellingApp.timeSlot)}</strong>?
            </p>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center gap-2 mb-5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>1 session credit</strong> will be instantly refunded to your balance.</span>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCancellingApp(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
              >
                Keep Booking
              </button>
              <button
                id="modal-confirm-cancel-btn"
                type="button"
                onClick={confirmCancellation}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition shadow-sm disabled:opacity-50"
              >
                {actionLoading ? 'Cancelling...' : 'Yes, Cancel & Refund Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
