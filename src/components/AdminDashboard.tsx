import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Appointment,
  SlotSummary,
  UserProfile,
  AVAILABLE_HOURS,
  ALL_POSSIBLE_HOURS,
  DAYS_OF_WEEK,
  DayOfWeek,
  MAX_CLIENTS_PER_SLOT,
  AvailabilitySettings,
  DEFAULT_AVAILABILITY_SETTINGS,
  getDateAvailability,
} from '../types';
import {
  subscribeToAllAppointments,
  subscribeToAllClients,
  subscribeToSlotSummaries,
  subscribeToAvailabilitySettings,
  getLocalAvailabilitySettings,
  saveAvailabilitySettings,
  toggleDateClosed,
  toggleSlotBlocked,
  toggleDayOfWeekEnabled,
  updateDayHours,
  setBookingHorizon,
  cancelSlot,
  adjustClientSessions,
  bookSlot,
} from '../services/bookingService';
import {
  formatTimeSlot,
  formatFullDate,
  formatShortDate,
  getTodayString,
  getUpcomingDays,
  useGreeceTime,
} from '../utils/dateUtils';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Shield,
  Search,
  Plus,
  Trash2,
  LogOut,
  ChevronRight,
  Eye,
  CheckCircle2,
  AlertCircle,
  Dumbbell,
  Ticket,
  UserPlus,
  RefreshCw,
  X,
  SlidersHorizontal,
  CalendarCheck,
  CalendarX,
  Ban,
  Lock,
  Unlock,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';

interface AdminDashboardProps {
  onToggleClientPreview: () => void;
}

export function AdminDashboard({ onToggleClientPreview }: AdminDashboardProps) {
  const { userProfile, signOut } = useAuth();
  const greeceTime = useGreeceTime();
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [allClients, setAllClients] = useState<UserProfile[]>([]);
  const [slotSummaries, setSlotSummaries] = useState<Record<string, SlotSummary>>({});
  const [activeTab, setActiveTab] = useState<'schedule' | 'availability' | 'clients' | 'all-bookings'>('schedule');

  // Availability Settings State
  const [availabilitySettings, setAvailabilitySettings] = useState<AvailabilitySettings>(getLocalAvailabilitySettings());

  // Day closure modal state (quick toggle from Day View)
  const [dayClosureModalOpen, setDayClosureModalOpen] = useState(false);
  const [dayClosureReasonInput, setDayClosureReasonInput] = useState('');

  // Add extra slot modal state (from Day View)
  const [addSlotModalOpen, setAddSlotModalOpen] = useState(false);
  const [extraSlotToAdd, setExtraSlotToAdd] = useState('06:00');

  // New Date Override in Availability tab state
  const [overrideDateInput, setOverrideDateInput] = useState(getTodayString());
  const [overrideReasonInput, setOverrideReasonInput] = useState('');

  // Active day in weekly editor
  const [expandedDay, setExpandedDay] = useState<DayOfWeek>('monday');

  // Client search
  const [searchQuery, setSearchQuery] = useState('');

  // Manual booking modal
  const [manualBookingSlot, setManualBookingSlot] = useState<string | null>(null);
  const [selectedClientIdForBooking, setSelectedClientIdForBooking] = useState<string>('');
  const [manualBookingNotes, setManualBookingNotes] = useState('');

  // Session edit dialog
  const [editingClient, setEditingClient] = useState<UserProfile | null>(null);
  const [customSessionCount, setCustomSessionCount] = useState<number>(5);

  // Cancellation confirmation modal
  const [cancellingApp, setCancellingApp] = useState<Appointment | null>(null);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Subscribe to availability settings
  useEffect(() => {
    const unsub = subscribeToAvailabilitySettings((settings) => {
      setAvailabilitySettings(settings);
    });
    return () => unsub();
  }, []);

  // Subscribe to all confirmed appointments (Admin full visibility)
  useEffect(() => {
    const unsub = subscribeToAllAppointments((appointments) => {
      setAllAppointments(appointments);
    });
    return () => unsub();
  }, []);

  // Subscribe to all registered clients
  useEffect(() => {
    const unsub = subscribeToAllClients((clients) => {
      setAllClients(clients);
    });
    return () => unsub();
  }, []);

  // Subscribe to slot summaries for selected date
  useEffect(() => {
    const unsub = subscribeToSlotSummaries(selectedDate, (summaries) => {
      setSlotSummaries(summaries);
    });
    return () => unsub();
  }, [selectedDate]);

  const bookingHorizon = availabilitySettings.bookingHorizonDays || 14;
  const upcomingDays = getUpcomingDays(bookingHorizon);
  const selectedDayAvail = getDateAvailability(selectedDate, availabilitySettings);

  // Appointments for the selected date
  const appointmentsForSelectedDate = allAppointments.filter((app) => app.date === selectedDate);

  // Helper to get all appointments for a specific time slot on the selected date
  const getAppointmentsForSlot = (timeSlot: string): Appointment[] => {
    return appointmentsForSelectedDate.filter((app) => app.timeSlot === timeSlot);
  };

  // Cancel an appointment as admin (triggers modal dialog)
  const handleAdminCancelClick = (app: Appointment) => {
    setCancellingApp(app);
  };

  const confirmAdminCancel = async () => {
    if (!cancellingApp) return;
    const targetApp = cancellingApp;
    setLoading(true);
    setCancellingApp(null);

    const res = await cancelSlot(targetApp);
    setLoading(false);
    if (res.success) {
      setFeedback({
        type: 'success',
        text: `Cancelled booking for ${targetApp.clientName}. 1 session was refunded back.`,
      });
      setTimeout(() => setFeedback(null), 5000);
    } else {
      setFeedback({ type: 'error', text: res.error || 'Failed to cancel appointment.' });
    }
  };

  // Adjust sessions for a client
  const handleAdjustSessions = async (client: UserProfile, delta: number) => {
    setLoading(true);
    const newCount = Math.max(0, client.remainingSessions + delta);
    const res = await adjustClientSessions(client.uid, newCount);
    setLoading(false);
    if (res.success) {
      setFeedback({
        type: 'success',
        text: `Updated ${client.displayName}'s balance to ${newCount} session(s).`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } else {
      setFeedback({ type: 'error', text: res.error || 'Failed to update session balance.' });
    }
  };

  const handleSaveCustomSessions = async () => {
    if (!editingClient) return;
    setLoading(true);
    const res = await adjustClientSessions(editingClient.uid, customSessionCount);
    setLoading(false);
    setEditingClient(null);
    if (res.success) {
      setFeedback({
        type: 'success',
        text: `Set ${editingClient.displayName}'s balance to ${customSessionCount} session(s).`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } else {
      setFeedback({ type: 'error', text: res.error || 'Failed to update session balance.' });
    }
  };

  // Manual booking by admin on behalf of a client
  const handleManualBooking = async () => {
    if (!manualBookingSlot || !selectedClientIdForBooking) return;
    const client = allClients.find((c) => c.uid === selectedClientIdForBooking);
    if (!client) return;

    setLoading(true);
    const res = await bookSlot({
      user: client,
      date: selectedDate,
      timeSlot: manualBookingSlot,
      notes: manualBookingNotes.trim() ? `[Trainer Booked] ${manualBookingNotes.trim()}` : '[Trainer Booked]',
    });
    setLoading(false);

    if (res.success) {
      setFeedback({
        type: 'success',
        text: `Booked ${client.displayName} into ${formatTimeSlot(manualBookingSlot)}.`,
      });
      setManualBookingSlot(null);
      setSelectedClientIdForBooking('');
      setManualBookingNotes('');
      setTimeout(() => setFeedback(null), 5000);
    } else {
      setFeedback({ type: 'error', text: res.error || 'Failed to book slot for client.' });
    }
  };

  // Filter clients for roster tab
  const filteredClients = allClients.filter(
    (c) =>
      c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalClientsCount = allClients.filter((c) => c.role === 'client').length;
  const todayBookingsCount = allAppointments.filter((a) => a.date === getTodayString()).length;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-16">
      {/* Top Admin Header */}
      <header className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 text-amber-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-white leading-tight">Coach Aster Studio</h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-semibold tracking-wide uppercase border border-amber-400/30">
                  Admin (Full Visibility)
                </span>
              </div>
              <p className="text-xs text-stone-400">asterast6@gmail.com</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Greece Time Display */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800/90 border border-stone-700 text-xs text-stone-200 shadow-2xs"
              title="Studio schedule operates in Greece time (Europe/Athens)"
            >
              <span className="text-xs">🇬🇷</span>
              <span className="text-stone-400 font-medium">Greece:</span>
              <span className="font-bold text-white font-mono tracking-tight">{greeceTime.timeWithSeconds}</span>
              <span className="text-[10px] font-bold text-amber-300 bg-amber-950/70 border border-amber-800/60 px-1.5 py-0.5 rounded">
                {greeceTime.tzAbbr}
              </span>
            </div>

            <button
              id="admin-preview-client-view-btn"
              onClick={onToggleClientPreview}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition"
              title="Test client booking experience"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Preview Client View</span>
            </button>

            <button
              id="admin-signout-btn"
              onClick={() => signOut()}
              className="flex items-center gap-1.5 text-xs font-medium text-stone-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-stone-800 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-start justify-between shadow-sm transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span className="text-sm font-medium">{feedback.text}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold opacity-60 hover:opacity-100 ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Today's Appointments
              </span>
              <Clock className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-2xl font-bold text-stone-900 mt-2">{todayBookingsCount}</p>
            <p className="text-xs text-stone-500 mt-1">Scheduled for {formatShortDate(getTodayString())}</p>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Total Registered Clients
              </span>
              <Users className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-2xl font-bold text-stone-900 mt-2">{totalClientsCount}</p>
            <p className="text-xs text-stone-500 mt-1">Active client profiles</p>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Slot Capacity Rule
              </span>
              <Dumbbell className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-2xl font-bold text-stone-900 mt-2">Max 4 / Hour</p>
            <p className="text-xs text-stone-500 mt-1">Strict limit enforced automatically</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-stone-200 mb-6 overflow-x-auto scrollbar-thin">
          <button
            id="admin-tab-schedule"
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition shrink-0 ${
              activeTab === 'schedule'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Master Schedule (Day View)</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-800 text-xs font-bold">
              {appointmentsForSelectedDate.length}
            </span>
          </button>

          <button
            id="admin-tab-availability"
            onClick={() => setActiveTab('availability')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition shrink-0 ${
              activeTab === 'availability'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Operating Hours & Days</span>
            {Object.keys(availabilitySettings.dateOverrides || {}).length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
                {Object.keys(availabilitySettings.dateOverrides || {}).length}
              </span>
            )}
          </button>

          <button
            id="admin-tab-clients"
            onClick={() => setActiveTab('clients')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition shrink-0 ${
              activeTab === 'clients'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Client Roster & Sessions</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-800 text-xs font-bold">
              {totalClientsCount}
            </span>
          </button>

          <button
            id="admin-tab-all-bookings"
            onClick={() => setActiveTab('all-bookings')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition shrink-0 ${
              activeTab === 'all-bookings'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>All Bookings Ledger ({allAppointments.length})</span>
          </button>
        </div>

        {/* TAB 1: MASTER SCHEDULE (FULL VISIBILITY) */}
        {activeTab === 'schedule' && (
          <div>
            {/* Date Selector Row */}
            <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Viewing Schedule For
                  </h3>
                  <p className="text-lg font-bold text-stone-900">
                    {formatFullDate(selectedDate)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="admin-date-picker" className="text-xs font-medium text-stone-600">
                    Select date:
                  </label>
                  <input
                    id="admin-date-picker"
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
                  const dayAppointmentsCount = allAppointments.filter((a) => a.date === day.dateStr).length;
                  const dayAvail = getDateAvailability(day.dateStr, availabilitySettings);

                  return (
                    <button
                      key={day.dateStr}
                      id={`admin-day-btn-${day.dateStr}`}
                      onClick={() => setSelectedDate(day.dateStr)}
                      className={`flex flex-col items-center justify-center min-w-[78px] sm:min-w-[88px] p-2.5 rounded-xl border text-center transition shrink-0 ${
                        isSelected
                          ? 'bg-stone-900 text-white border-stone-900 shadow-sm font-semibold'
                          : dayAvail.isClosed
                          ? 'bg-stone-100/70 hover:bg-stone-100 text-stone-400 border-stone-200'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      <span className="text-[11px] uppercase tracking-tight opacity-80">{day.label}</span>
                      <span className="text-sm font-bold mt-0.5">{day.subLabel}</span>
                      <div className="flex items-center gap-1 mt-1">
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            isSelected ? 'bg-stone-800 text-amber-300' : 'bg-stone-200 text-stone-700'
                          }`}
                        >
                          {dayAppointmentsCount} {dayAppointmentsCount === 1 ? 'client' : 'clients'}
                        </span>
                        {dayAvail.isClosed && (
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                              isSelected ? 'bg-amber-400 text-stone-900' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            Off
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Visibility & Client Access Banner */}
            <div
              className={`p-4 rounded-2xl border mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition shadow-xs ${
                selectedDayAvail.isClosed
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
              }`}
            >
              <div className="flex items-start sm:items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedDayAvail.isClosed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {selectedDayAvail.isClosed ? <CalendarX className="w-5 h-5" /> : <CalendarCheck className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">
                      {selectedDayAvail.isClosed ? 'Studio Closed to Clients' : 'Studio Open to Clients'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        selectedDayAvail.isClosed ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                      }`}
                    >
                      {selectedDayAvail.isClosed ? 'Closed' : `${selectedDayAvail.activeHours.length} Slots Visible`}
                    </span>
                  </div>
                  <p className="text-xs opacity-80 mt-0.5">
                    {selectedDayAvail.isClosed
                      ? `Reason: ${selectedDayAvail.reason || 'Trainer marked this date as unavailable'}. Clients cannot book on this day.`
                      : 'Clients can see and book spots in all open hourly slots on this date.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {selectedDayAvail.isClosed ? (
                  <button
                    id="admin-reopen-date-btn"
                    onClick={async () => {
                      setLoading(true);
                      await toggleDateClosed(selectedDate, false);
                      setLoading(false);
                      setFeedback({
                        type: 'success',
                        text: `Reopened ${formatShortDate(selectedDate)} for client bookings.`,
                      });
                      setTimeout(() => setFeedback(null), 4000);
                    }}
                    disabled={loading}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Reopen Date</span>
                  </button>
                ) : (
                  <button
                    id="admin-close-date-modal-btn"
                    onClick={() => {
                      setDayClosureReasonInput('');
                      setDayClosureModalOpen(true);
                    }}
                    disabled={loading}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <CalendarX className="w-3.5 h-3.5" />
                    <span>Close Date to Clients</span>
                  </button>
                )}

                <button
                  id="admin-add-extra-slot-btn"
                  onClick={() => {
                    const availableToAdd = ALL_POSSIBLE_HOURS.filter(
                      (h) => !selectedDayAvail.activeHours.includes(h)
                    );
                    setExtraSlotToAdd(availableToAdd[0] || '06:00');
                    setAddSlotModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Extra Slot</span>
                </button>

                <button
                  id="admin-manage-schedule-shortcut-btn"
                  onClick={() => setActiveTab('availability')}
                  className="px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Manage Operating Rules</span>
                </button>
              </div>
            </div>

            {/* Hour-by-Hour Master Breakdown */}
            {(() => {
              const bookedHours = appointmentsForSelectedDate.map((a) => a.timeSlot);
              const dateOverride = availabilitySettings.dateOverrides[selectedDate];
              const blockedOverrideHours = dateOverride?.blockedHours || [];
              const extraOverrideHours = dateOverride?.extraHours || [];

              const allSlotHours = Array.from(
                new Set([
                  ...selectedDayAvail.activeHours,
                  ...blockedOverrideHours,
                  ...extraOverrideHours,
                  ...bookedHours,
                ])
              ).sort((a, b) => a.localeCompare(b));

              if (allSlotHours.length === 0) {
                return (
                  <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center shadow-sm">
                    <Clock className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                    <h4 className="text-base font-bold text-stone-900">No Hours Scheduled for this Date</h4>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1 mb-4">
                      This day currently has no active time slots for clients. You can add a slot below or configure recurring weekly hours.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => {
                          setExtraSlotToAdd('08:00');
                          setAddSlotModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold shadow-xs"
                      >
                        + Add Slot for Today
                      </button>
                      <button
                        onClick={() => setActiveTab('availability')}
                        className="px-3.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold"
                      >
                        Configure Operating Hours
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {allSlotHours.map((hour) => {
                    const appointmentsInSlot = getAppointmentsForSlot(hour);
                    const bookedCount = appointmentsInSlot.length;
                    const isFull = bookedCount >= MAX_CLIENTS_PER_SLOT;
                    const availableSpots = Math.max(0, MAX_CLIENTS_PER_SLOT - bookedCount);
                    const isBlocked =
                      selectedDayAvail.isClosed ||
                      selectedDayAvail.blockedHours.includes(hour) ||
                      !selectedDayAvail.activeHours.includes(hour);

                    return (
                      <div
                        key={hour}
                        id={`admin-slot-row-${hour}`}
                        className={`border rounded-2xl p-4 sm:p-5 shadow-sm transition ${
                          isBlocked
                            ? 'bg-amber-50/20 border-amber-200/80'
                            : 'bg-white border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-100 gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                isBlocked ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-700'
                              }`}
                            >
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-base font-bold text-stone-900">
                                {formatTimeSlot(hour)}
                              </span>
                              <span className="text-xs text-stone-500 ml-2">
                                ({bookedCount} of {MAX_CLIENTS_PER_SLOT} spots occupied)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                            {/* Status Pill */}
                            {isBlocked ? (
                              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold flex items-center gap-1">
                                <Ban className="w-3 h-3 text-amber-700" />
                                <span>Blocked from Clients</span>
                              </span>
                            ) : isFull ? (
                              <span className="px-2.5 py-1 rounded-full bg-stone-900 text-white text-xs font-semibold">
                                Full (4/4)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>{availableSpots} {availableSpots === 1 ? 'spot' : 'spots'} open to clients</span>
                              </span>
                            )}

                            {/* Block / Unblock Quick Toggle */}
                            <button
                              id={`admin-toggle-slot-${hour}`}
                              onClick={async () => {
                                setLoading(true);
                                const res = await toggleSlotBlocked(selectedDate, hour, !isBlocked);
                                setLoading(false);
                                if (res.success) {
                                  setFeedback({
                                    type: 'success',
                                    text: isBlocked
                                      ? `Unblocked ${formatTimeSlot(hour)} on ${formatShortDate(selectedDate)} for client bookings.`
                                      : `Blocked ${formatTimeSlot(hour)} on ${formatShortDate(selectedDate)} from clients.`,
                                  });
                                  setTimeout(() => setFeedback(null), 3500);
                                }
                              }}
                              disabled={loading}
                              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition border disabled:opacity-50 ${
                                isBlocked
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                  : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-300'
                              }`}
                            >
                              {isBlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                              <span>{isBlocked ? 'Unblock Slot' : 'Block Slot'}</span>
                            </button>

                            {!isFull && (
                              <button
                                id={`admin-add-client-slot-${hour}`}
                                onClick={() => {
                                  setManualBookingSlot(hour);
                                  setSelectedClientIdForBooking(allClients.find((c) => c.role === 'client')?.uid || '');
                                  setManualBookingNotes('');
                                }}
                                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 transition"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Add Client</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Roster of 4 Spots */}
                        <div className="mt-3.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          {[0, 1, 2, 3].map((index) => {
                            const app = appointmentsInSlot[index];

                            if (app) {
                              return (
                                <div
                                  key={app.id}
                                  id={`admin-booked-card-${app.id}`}
                                  className="p-3 rounded-xl border border-stone-200 bg-stone-50/70 flex flex-col justify-between"
                                >
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                        Spot {index + 1}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                        Booked
                                      </span>
                                    </div>
                                    <p className="text-sm font-bold text-stone-900 truncate">
                                      {app.clientName}
                                    </p>
                                    <p className="text-xs text-stone-500 truncate">{app.clientEmail}</p>
                                    {app.notes && (
                                      <p className="text-[11px] text-stone-600 italic mt-1 line-clamp-2 bg-white p-1 rounded border border-stone-200">
                                        &ldquo;{app.notes}&rdquo;
                                      </p>
                                    )}
                                  </div>

                                  <div className="mt-3 pt-2 border-t border-stone-200 flex justify-end">
                                    <button
                                      id={`admin-cancel-app-${app.id}`}
                                      onClick={() => handleAdminCancelClick(app)}
                                      disabled={loading}
                                      className="text-[11px] font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 disabled:opacity-50"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Remove / Refund</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={`empty-${index}`}
                                className="p-3 rounded-xl border border-dashed border-stone-300 bg-stone-50/30 flex flex-col justify-center items-center text-center min-h-[90px]"
                              >
                                <span className="text-[11px] font-medium text-stone-400">
                                  Spot {index + 1} Available
                                </span>
                                <button
                                  onClick={() => {
                                    setManualBookingSlot(hour);
                                    setSelectedClientIdForBooking(
                                      allClients.find((c) => c.role === 'client')?.uid || ''
                                    );
                                    setManualBookingNotes('');
                                  }}
                                  className="mt-1.5 text-[11px] font-semibold text-stone-700 hover:text-stone-900 underline"
                                >
                                  + Assign Client
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 2: OPERATING HOURS & DAYS (ADMIN SCHEDULE CONTROL) */}
        {activeTab === 'availability' && (
          <div className="space-y-8">
            {/* Top Summary & Quick Actions */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-stone-200">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-stone-900">
                      Operating Schedule & Client Visibility
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1">
                      <span>🇬🇷</span>
                      <span>Athens Time ({greeceTime.tzAbbr} • 24h)</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                      Live Real-Time Sync
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1 max-w-2xl">
                    Configure which days and hours are visible to clients in Greece local time (Europe/Athens). Set recurring weekly open days, click any hour chip to toggle it on or off, or close specific holiday dates.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    id="admin-copy-mon-to-weekdays-btn"
                    onClick={async () => {
                      setLoading(true);
                      const monHours = availabilitySettings.weeklySchedule.monday.hours;
                      const newSettings = { ...availabilitySettings };
                      (['tuesday', 'wednesday', 'thursday', 'friday'] as DayOfWeek[]).forEach((day) => {
                        newSettings.weeklySchedule[day] = {
                          enabled: availabilitySettings.weeklySchedule.monday.enabled,
                          hours: [...monHours],
                        };
                      });
                      await saveAvailabilitySettings(newSettings);
                      setLoading(false);
                      setFeedback({
                        type: 'success',
                        text: "Copied Monday's hours to Tuesday through Friday.",
                      });
                      setTimeout(() => setFeedback(null), 4000);
                    }}
                    disabled={loading}
                    className="px-3.5 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Mon to Tue-Fri</span>
                  </button>

                  <button
                    id="admin-reset-schedule-btn"
                    onClick={async () => {
                      if (
                        window.confirm(
                          'Reset all weekly operating hours to studio defaults (Mon-Fri 7am-7pm, Sat 8am-2pm, Sun Closed)?'
                        )
                      ) {
                        setLoading(true);
                        await saveAvailabilitySettings({
                          ...DEFAULT_AVAILABILITY_SETTINGS,
                          dateOverrides: availabilitySettings.dateOverrides,
                        });
                        setLoading(false);
                        setFeedback({
                          type: 'success',
                          text: 'Reset operating schedule to default studio hours.',
                        });
                        setTimeout(() => setFeedback(null), 4000);
                      }
                    }}
                    disabled={loading}
                    className="px-3.5 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-medium flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Defaults</span>
                  </button>
                </div>
              </div>

              {/* Advance Booking Horizon Setting */}
              <div className="pt-5">
                <label className="text-xs font-bold text-stone-900 uppercase tracking-wider block mb-1">
                  Client Booking Window (Advance Horizon)
                </label>
                <p className="text-xs text-stone-500 mb-3">
                  Controls how many days into the future clients can view and book appointments.
                </p>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {[7, 14, 30, 60].map((days) => {
                    const isSelected = (availabilitySettings.bookingHorizonDays || 14) === days;
                    return (
                      <button
                        key={days}
                        id={`horizon-btn-${days}`}
                        onClick={async () => {
                          setLoading(true);
                          await setBookingHorizon(days);
                          setLoading(false);
                          setFeedback({
                            type: 'success',
                            text: `Updated booking window to ${days} days in advance.`,
                          });
                          setTimeout(() => setFeedback(null), 3000);
                        }}
                        disabled={loading}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                          isSelected
                            ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                      >
                        {days} Days Advance
                        {days === 14 && <span className="ml-1 text-[10px] opacity-75">(Standard)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Weekly Recurring Schedule by Day */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 shadow-sm">
              <div className="mb-5">
                <h4 className="text-base font-bold text-stone-900">Weekly Days & Hourly Time Slots</h4>
                <p className="text-xs text-stone-500 mt-0.5">
                  Toggle each day open or closed, and click any hour chip to enable or disable that slot for clients.
                </p>
              </div>

              <div className="space-y-4">
                {DAYS_OF_WEEK.map(({ key, label }) => {
                  const dayConfig = availabilitySettings.weeklySchedule[key] || { enabled: false, hours: [] };
                  const isDayEnabled = dayConfig.enabled;
                  const activeHours = dayConfig.hours || [];
                  const isExpanded = expandedDay === key;

                  return (
                    <div
                      key={key}
                      id={`weekly-day-card-${key}`}
                      className={`border rounded-xl transition ${
                        isDayEnabled ? 'border-stone-200 bg-white' : 'border-stone-200 bg-stone-50/70'
                      }`}
                    >
                      {/* Day Header Row */}
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setExpandedDay(isExpanded ? ('' as DayOfWeek) : key)}
                            className="flex items-center gap-2 font-bold text-sm text-stone-900 hover:text-stone-700 text-left"
                          >
                            <span className="w-24 capitalize">{label}</span>
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                                isDayEnabled
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-stone-200 text-stone-600'
                              }`}
                            >
                              {isDayEnabled ? `${activeHours.length} hours active` : 'Closed'}
                            </span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center">
                          {/* Day Toggle Switch */}
                          <button
                            id={`toggle-day-btn-${key}`}
                            onClick={async () => {
                              setLoading(true);
                              await toggleDayOfWeekEnabled(key, !isDayEnabled);
                              setLoading(false);
                              setFeedback({
                                type: 'success',
                                text: `${label} marked as ${!isDayEnabled ? 'open' : 'closed'} for client bookings.`,
                              });
                              setTimeout(() => setFeedback(null), 3000);
                            }}
                            disabled={loading}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition border ${
                              isDayEnabled
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-stone-200 text-stone-700 border-stone-300 hover:bg-stone-300'
                            }`}
                          >
                            {isDayEnabled ? 'Day Open' : 'Day Closed'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpandedDay(isExpanded ? ('' as DayOfWeek) : key)}
                            className="px-2.5 py-1 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100 rounded-lg"
                          >
                            {isExpanded ? 'Collapse' : 'Edit Hours'}
                          </button>
                        </div>
                      </div>

                      {/* Hours Grid (when expanded) */}
                      {isExpanded && (
                        <div className="p-4 pt-0 border-t border-stone-100 mt-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-3 pt-3">
                            <span className="text-xs font-semibold text-stone-700">
                              Click hour chips to toggle visibility:
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={async () => {
                                  setLoading(true);
                                  await updateDayHours(key, AVAILABLE_HOURS);
                                  setLoading(false);
                                }}
                                className="px-2 py-0.5 text-[11px] font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded"
                              >
                                Standard (7-19)
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  setLoading(true);
                                  await updateDayHours(key, [
                                    '07:00',
                                    '08:00',
                                    '09:00',
                                    '10:00',
                                    '11:00',
                                    '12:00',
                                  ]);
                                  setLoading(false);
                                }}
                                className="px-2 py-0.5 text-[11px] font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded"
                              >
                                Morning (7-12)
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  setLoading(true);
                                  await updateDayHours(key, [
                                    '16:00',
                                    '17:00',
                                    '18:00',
                                    '19:00',
                                    '20:00',
                                    '21:00',
                                  ]);
                                  setLoading(false);
                                }}
                                className="px-2 py-0.5 text-[11px] font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded"
                              >
                                Evening (16-21)
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  setLoading(true);
                                  await updateDayHours(key, ALL_POSSIBLE_HOURS);
                                  setLoading(false);
                                }}
                                className="px-2 py-0.5 text-[11px] font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded"
                              >
                                Select All
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  setLoading(true);
                                  await updateDayHours(key, []);
                                  setLoading(false);
                                }}
                                className="px-2 py-0.5 text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded"
                              >
                                Clear All
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-1.5">
                            {ALL_POSSIBLE_HOURS.map((h) => {
                              const isHourActive = activeHours.includes(h);
                              return (
                                <button
                                  key={h}
                                  type="button"
                                  id={`hour-chip-${key}-${h}`}
                                  onClick={async () => {
                                    const newHours = isHourActive
                                      ? activeHours.filter((item) => item !== h)
                                      : [...activeHours, h].sort((a, b) => a.localeCompare(b));
                                    setLoading(true);
                                    await updateDayHours(key, newHours);
                                    setLoading(false);
                                  }}
                                  className={`py-2 px-1 rounded-lg text-xs font-semibold text-center border transition ${
                                    isHourActive
                                      ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                                      : 'bg-stone-50 hover:bg-stone-100 text-stone-400 border-dashed border-stone-300'
                                  }`}
                                >
                                  {h}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Specific Date Closures & Overrides */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 mb-5">
                <div>
                  <h4 className="text-base font-bold text-stone-900">
                    Specific Date Closures & Holidays
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Close the studio on specific dates (e.g. holidays, vacations, private events) without changing your weekly schedule.
                  </p>
                </div>
              </div>

              {/* Add New Closure Form */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-6">
                <h5 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">
                  Add Date Closure
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-stone-600 block mb-1">
                      Select Date:
                    </label>
                    <input
                      type="date"
                      value={overrideDateInput}
                      onChange={(e) => setOverrideDateInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-stone-600 block mb-1">
                      Reason (shown to clients):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Memorial Day / Trainer Vacation"
                      value={overrideReasonInput}
                      onChange={(e) => setOverrideReasonInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      id="admin-add-date-closure-btn"
                      onClick={async () => {
                        if (!overrideDateInput) return;
                        setLoading(true);
                        await toggleDateClosed(
                          overrideDateInput,
                          true,
                          overrideReasonInput.trim() || undefined
                        );
                        setLoading(false);
                        setOverrideReasonInput('');
                        setFeedback({
                          type: 'success',
                          text: `Closed ${formatShortDate(overrideDateInput)} to client bookings.`,
                        });
                        setTimeout(() => setFeedback(null), 4000);
                      }}
                      disabled={loading || !overrideDateInput}
                      className="w-full py-2 px-4 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                    >
                      <CalendarX className="w-3.5 h-3.5" />
                      <span>Close Date</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Overrides List */}
              <div>
                <h5 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">
                  Active Date Overrides ({Object.keys(availabilitySettings.dateOverrides || {}).length})
                </h5>

                {Object.keys(availabilitySettings.dateOverrides || {}).length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-stone-200 rounded-xl">
                    <CalendarCheck className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                    <p className="text-xs font-medium text-stone-600">No date closures or overrides set.</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      The studio follows the standard weekly schedule above without exceptions.
                    </p>
                  </div>
                ) : (
                  <div className="border border-stone-200 rounded-xl overflow-hidden">
                    <div className="divide-y divide-stone-200">
                      {Object.entries(availabilitySettings.dateOverrides).map(([dateStr, override]) => {
                        return (
                          <div
                            key={dateStr}
                            id={`override-row-${dateStr}`}
                            className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-stone-50/60 transition"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-stone-900">
                                  {formatFullDate(dateStr)}
                                </span>
                                {override.isClosed ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    Closed
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    Custom Slots
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-stone-500 mt-0.5">
                                {override.reason ? `Reason: "${override.reason}"` : 'No reason specified'}
                                {override.blockedHours && override.blockedHours.length > 0 && (
                                  <span className="ml-2">({override.blockedHours.length} slots blocked)</span>
                                )}
                                {override.extraHours && override.extraHours.length > 0 && (
                                  <span className="ml-2">({override.extraHours.length} extra slots open)</span>
                                )}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                id={`delete-override-${dateStr}`}
                                onClick={async () => {
                                  setLoading(true);
                                  const newSettings = { ...availabilitySettings };
                                  delete newSettings.dateOverrides[dateStr];
                                  await saveAvailabilitySettings(newSettings);
                                  setLoading(false);
                                  setFeedback({
                                    type: 'success',
                                    text: `Removed override for ${formatShortDate(dateStr)}.`,
                                  });
                                  setTimeout(() => setFeedback(null), 3000);
                                }}
                                disabled={loading}
                                className="px-3 py-1 rounded-lg text-xs font-semibold text-stone-600 hover:text-red-700 hover:bg-red-50 border border-stone-200 transition flex items-center gap-1 disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remove Override</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CLIENT ROSTER & SESSIONS */}
        {activeTab === 'clients' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stone-200 mb-6">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Client Accounts & Session Management</h3>
                <p className="text-xs text-stone-500">
                  Track client remaining sessions, replenish packages, or adjust balances.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="client-roster-search"
                  type="text"
                  placeholder="Search client name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>
            </div>

            {filteredClients.length === 0 ? (
              <div className="text-center py-12 text-stone-500 text-sm">
                No clients match your search query.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                      <th className="pb-3 pr-4">Client</th>
                      <th className="pb-3 px-4">Role</th>
                      <th className="pb-3 px-4 text-center">Remaining Sessions</th>
                      <th className="pb-3 px-4">Bookings</th>
                      <th className="pb-3 pl-4 text-right">Quick Session Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredClients.map((client) => {
                      const clientBookingsCount = allAppointments.filter((a) => a.clientId === client.uid).length;

                      return (
                        <tr key={client.uid} id={`client-row-${client.uid}`} className="hover:bg-stone-50/70">
                          <td className="py-4 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs uppercase">
                                {client.displayName?.substring(0, 2) || 'CL'}
                              </div>
                              <div>
                                <p className="font-bold text-stone-900 text-sm">{client.displayName}</p>
                                <p className="text-xs text-stone-500">{client.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                client.role === 'admin'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-stone-100 text-stone-700'
                              }`}
                            >
                              {client.role === 'admin' ? 'Admin / Trainer' : 'Client'}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-stone-100">
                              <Ticket className="w-3.5 h-3.5 text-stone-500" />
                              <span
                                className={`text-base font-extrabold ${
                                  client.remainingSessions > 0 ? 'text-stone-900' : 'text-red-600'
                                }`}
                              >
                                {client.remainingSessions}
                              </span>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-xs text-stone-600">
                            {clientBookingsCount} active
                          </td>

                          <td className="py-4 pl-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                id={`quick-add-1-${client.uid}`}
                                onClick={() => handleAdjustSessions(client, 1)}
                                disabled={loading}
                                className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition"
                                title="Add 1 session"
                              >
                                +1
                              </button>
                              <button
                                id={`quick-add-5-${client.uid}`}
                                onClick={() => handleAdjustSessions(client, 5)}
                                disabled={loading}
                                className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition"
                                title="Add 5 sessions package"
                              >
                                +5
                              </button>
                              <button
                                id={`quick-add-10-${client.uid}`}
                                onClick={() => handleAdjustSessions(client, 10)}
                                disabled={loading}
                                className="px-2 py-1 rounded bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition"
                                title="Add 10 sessions package"
                              >
                                +10
                              </button>
                              <button
                                id={`edit-sessions-${client.uid}`}
                                onClick={() => {
                                  setEditingClient(client);
                                  setCustomSessionCount(client.remainingSessions);
                                }}
                                className="px-2.5 py-1 rounded border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-medium ml-1 transition"
                              >
                                Set Count
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ALL BOOKINGS LEDGER */}
        {activeTab === 'all-bookings' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-6">
              <div>
                <h3 className="text-lg font-bold text-stone-900">All Confirmed Appointments</h3>
                <p className="text-xs text-stone-500">
                  Trainer visibility across all client bookings.
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-stone-100 text-stone-800 rounded-full">
                {allAppointments.length} total active bookings
              </span>
            </div>

            {allAppointments.length === 0 ? (
              <div className="text-center py-12 text-stone-500 text-sm">
                No bookings found across the entire calendar.
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {allAppointments.map((app) => (
                  <div
                    key={app.id}
                    id={`ledger-app-${app.id}`}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] uppercase font-bold text-amber-400">
                          {formatShortDate(app.date).split(' ')[0]}
                        </span>
                        <span className="text-xs font-bold leading-none">{app.date.split('-')[2]}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-sm">{app.clientName}</span>
                          <span className="text-xs text-stone-500">({app.clientEmail})</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-stone-600 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          <span>
                            {formatFullDate(app.date)} • {formatTimeSlot(app.timeSlot)}
                          </span>
                        </div>
                        {app.notes && (
                          <p className="text-xs text-stone-500 italic mt-0.5">"{app.notes}"</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        id={`ledger-cancel-${app.id}`}
                        onClick={() => handleAdminCancelClick(app)}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition"
                      >
                        Cancel Booking
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Manual Booking Dialog Modal */}
      {manualBookingSlot && (
        <div
          id="admin-manual-booking-modal"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-stone-900" />
                <h3 className="font-bold text-stone-900 text-base">Assign Client to Slot</h3>
              </div>
              <button
                onClick={() => setManualBookingSlot(null)}
                className="text-stone-400 hover:text-stone-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 mb-5">
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1">
                <p>
                  <strong className="text-stone-700">Date:</strong> {formatFullDate(selectedDate)}
                </p>
                <p>
                  <strong className="text-stone-700">Slot:</strong> {formatTimeSlot(manualBookingSlot)}
                </p>
              </div>

              <div>
                <label
                  htmlFor="manual-booking-client-select"
                  className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1"
                >
                  Select Registered Client
                </label>
                <select
                  id="manual-booking-client-select"
                  value={selectedClientIdForBooking}
                  onChange={(e) => setSelectedClientIdForBooking(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                >
                  <option value="">-- Choose Client --</option>
                  {allClients
                    .filter((c) => c.role === 'client')
                    .map((client) => (
                      <option key={client.uid} value={client.uid}>
                        {client.displayName} ({client.email}) — {client.remainingSessions} sessions left
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="manual-booking-notes-input"
                  className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1"
                >
                  Appointment Notes
                </label>
                <input
                  id="manual-booking-notes-input"
                  type="text"
                  value={manualBookingNotes}
                  onChange={(e) => setManualBookingNotes(e.target.value)}
                  placeholder="e.g. In-person request, knee rehab..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setManualBookingSlot(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                id="admin-confirm-manual-booking-btn"
                type="button"
                onClick={handleManualBooking}
                disabled={loading || !selectedClientIdForBooking}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition disabled:opacity-50"
              >
                {loading ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Session Count Dialog Modal */}
      {editingClient && (
        <div
          id="admin-session-count-modal"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-stone-900" />
                <h3 className="font-bold text-stone-900 text-base">Adjust Sessions Balance</h3>
              </div>
              <button
                onClick={() => setEditingClient(null)}
                className="text-stone-400 hover:text-stone-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 mb-5">
              <p className="text-xs text-stone-600">
                Set remaining personal training sessions for{' '}
                <strong className="text-stone-900">{editingClient.displayName}</strong>.
              </p>

              <div>
                <label
                  htmlFor="custom-session-input"
                  className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1"
                >
                  Remaining Sessions Count
                </label>
                <input
                  id="custom-session-input"
                  type="number"
                  min={0}
                  max={200}
                  value={customSessionCount}
                  onChange={(e) => setCustomSessionCount(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 text-stone-900 font-bold focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingClient(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                id="admin-save-session-count-btn"
                type="button"
                onClick={handleSaveCustomSessions}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Balance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Cancel Confirmation Modal */}
      {cancellingApp && (
        <div
          id="admin-cancel-confirm-modal"
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-base">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <span>Cancel Booking & Refund Session</span>
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
              Cancel booking for <strong className="text-stone-900">{cancellingApp.clientName}</strong> on{' '}
              <strong className="text-stone-900">{formatShortDate(cancellingApp.date)}</strong> at{' '}
              <strong className="text-stone-900">{formatTimeSlot(cancellingApp.timeSlot)}</strong>?
            </p>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center gap-2 mb-5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>1 session credit</strong> will be refunded to {cancellingApp.clientName}&apos;s balance immediately.</span>
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
                id="modal-confirm-admin-cancel-btn"
                type="button"
                onClick={confirmAdminCancel}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition shadow-sm disabled:opacity-50"
              >
                {loading ? 'Cancelling...' : 'Yes, Cancel & Refund Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Closure Modal */}
      {dayClosureModalOpen && (
        <div
          id="admin-day-closure-modal"
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-base">
                <CalendarX className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Close Date to Clients</span>
              </div>
              <button
                type="button"
                onClick={() => setDayClosureModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-stone-600 mb-3">
              Closing <strong className="text-stone-900">{formatFullDate(selectedDate)}</strong> will hide all time slots on this date from clients so they cannot book.
            </p>

            <div className="mb-4">
              <label htmlFor="closure-reason-input" className="text-xs font-semibold text-stone-700 block mb-1">
                Reason for closure (optional, visible to clients):
              </label>
              <input
                id="closure-reason-input"
                type="text"
                placeholder="e.g. Studio Maintenance / Holiday / Private Workshop"
                value={dayClosureReasonInput}
                onChange={(e) => setDayClosureReasonInput(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDayClosureModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                id="confirm-close-date-btn"
                type="button"
                onClick={async () => {
                  setLoading(true);
                  setDayClosureModalOpen(false);
                  await toggleDateClosed(selectedDate, true, dayClosureReasonInput.trim() || undefined);
                  setLoading(false);
                  setFeedback({
                    type: 'success',
                    text: `Closed ${formatShortDate(selectedDate)} to client bookings.`,
                  });
                  setTimeout(() => setFeedback(null), 4000);
                }}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition shadow-xs disabled:opacity-50"
              >
                {loading ? 'Closing Date...' : 'Confirm Date Closure'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Extra Slot Modal */}
      {addSlotModalOpen && (
        <div
          id="admin-add-slot-modal"
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-base">
                <Plus className="w-5 h-5 text-stone-700 shrink-0" />
                <span>Add Extra Slot to {formatShortDate(selectedDate)}</span>
              </div>
              <button
                type="button"
                onClick={() => setAddSlotModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-stone-600 mb-4">
              Select a time slot to make available for clients on <strong className="text-stone-900">{formatShortDate(selectedDate)}</strong>:
            </p>

            <div className="mb-5">
              <label htmlFor="select-extra-hour" className="text-xs font-semibold text-stone-700 block mb-1">
                Time Slot:
              </label>
              <select
                id="select-extra-hour"
                value={extraSlotToAdd}
                onChange={(e) => setExtraSlotToAdd(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 bg-white"
              >
                {ALL_POSSIBLE_HOURS.map((h) => {
                  const isAlreadyActive = selectedDayAvail.activeHours.includes(h);
                  return (
                    <option key={h} value={h}>
                      {formatTimeSlot(h)} {isAlreadyActive ? '(Already Open)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAddSlotModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                id="confirm-add-extra-slot-btn"
                type="button"
                onClick={async () => {
                  setLoading(true);
                  setAddSlotModalOpen(false);
                  const newSettings = { ...availabilitySettings };
                  const currentOverride = newSettings.dateOverrides[selectedDate] || { isClosed: false };
                  const currentExtra = currentOverride.extraHours || [];
                  if (!currentExtra.includes(extraSlotToAdd)) {
                    currentOverride.extraHours = [...currentExtra, extraSlotToAdd].sort((a, b) => a.localeCompare(b));
                  }
                  if (currentOverride.blockedHours) {
                    currentOverride.blockedHours = currentOverride.blockedHours.filter((h) => h !== extraSlotToAdd);
                  }
                  newSettings.dateOverrides[selectedDate] = currentOverride;
                  await saveAvailabilitySettings(newSettings);
                  setLoading(false);
                  setFeedback({
                    type: 'success',
                    text: `Added ${formatTimeSlot(extraSlotToAdd)} to ${formatShortDate(selectedDate)}.`,
                  });
                  setTimeout(() => setFeedback(null), 3500);
                }}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition shadow-xs disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
