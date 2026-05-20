'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore, type CachedBooking } from '@/stores/useUserStore';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/Modal';
import SeatMap, { type Seat } from '@/components/SeatMap';
import {
  Ticket,
  Calendar,
  User,
  Plane,
  XCircle,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Clock
} from 'lucide-react';

interface AlternateFlight {
  id: string;
  flight_no: string;
  origin: string;
  destination: string;
  departs_at: string;
  arrives_at: string;
  aircraft_type: string;
  base_price: number;
}

export default function BookingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { session, setCachedBookings } = useUserStore();

  const [bookings, setBookings] = useState<CachedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(false);

  // Modal State for Cancellation
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<CachedBooking | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Rescheduling Flow State
  const [rescheduleActiveBooking, setRescheduleActiveBooking] = useState<CachedBooking | null>(null);
  const [alternateFlights, setAlternateFlights] = useState<AlternateFlight[]>([]);
  const [alternateFlightsLoading, setAlternateFlightsLoading] = useState(false);
  const [selectedAltFlight, setSelectedAltFlight] = useState<AlternateFlight | null>(null);
  const [selectedAltSeat, setSelectedAltSeat] = useState<Seat | null>(null);
  const [rescheduleConfirmModalOpen, setRescheduleConfirmModalOpen] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Monitor network status
  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchBookings = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');

    // If offline, load from Zustand Cache
    if (!navigator.onLine) {
      setBookings(useUserStore.getState().cachedBookings);
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchErr } = await supabase
        .from('bookings')
        .select(`
          id, pnr_code, booked_at, total_price, status, flight_id, seat_id,
          flight:flights (id, flight_no, origin, destination, departs_at, arrives_at, aircraft_type, base_price),
          seat:seats (id, seat_number, class, extra_fee),
          passenger:passengers (full_name, passport_no, nationality, dob)
        `)
        .order('booked_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      if (data) {
        const formatted = data
          .filter((b: any) => b && b.flight && b.seat && b.passenger && b.passenger.length > 0)
          .map((b: any) => ({
            id: b.id,
            pnr_code: b.pnr_code,
            booked_at: b.booked_at,
            total_price: b.total_price,
            status: b.status,
            flight_id: b.flight_id,
            seat_id: b.seat_id,
            flight: b.flight,
            seat: b.seat,
            passenger: b.passenger,
          })) as CachedBooking[];

        setBookings(formatted);
        setCachedBookings(formatted); // Save to Zustand persistence for offline use
      }
    } catch (err: any) {
      console.error(err);
      setError(`Failed to fetch bookings: ${err.message || err}. Reading cached bookings instead.`);
      setBookings(useUserStore.getState().cachedBookings); // read offline cache as fallback
    } finally {
      setLoading(false);
    }
  }, [session, setCachedBookings, supabase]);

  // Secure Route: must have session
  useEffect(() => {
    if (!session) {
      router.push('/login?redirect=/bookings');
      return;
    }
    fetchBookings();
  }, [session, router, fetchBookings]);

  // Handle Cancellation Action
  const triggerCancelBooking = (booking: CachedBooking) => {
    setSelectedBookingForCancel(booking);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedBookingForCancel) return;
    setCancelLoading(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('cancel_booking_atomic', {
        p_booking_id: selectedBookingForCancel.id,
      });

      if (rpcError) throw rpcError;

      const result = data as any;
      if (!result.success) {
        throw new Error(result.error || 'Cancellation failed.');
      }

      setCancelModalOpen(false);
      setSelectedBookingForCancel(null);
      await fetchBookings(); // Reload
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to cancel booking. It may be within 2 hours of departure.');
      setCancelModalOpen(false);
    } finally {
      setCancelLoading(false);
    }
  };

  // Handle Rescheduling Flow Actions
  const startReschedule = async (booking: CachedBooking) => {
    setRescheduleActiveBooking(booking);
    setAlternateFlights([]);
    setSelectedAltFlight(null);
    setSelectedAltSeat(null);
    setAlternateFlightsLoading(true);
    setError('');

    try {
      // Find alternate flights on the same route, excluding the current flight
      const { data, error: flightErr } = await supabase
        .from('flights')
        .select('*')
        .eq('origin', booking.flight.origin)
        .eq('destination', booking.flight.destination)
        .neq('id', booking.flight.id)
        .gt('departs_at', new Date().toISOString()); // Only future flights

      if (flightErr) throw flightErr;

      if (data) {
        setAlternateFlights(data as AlternateFlight[]);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch alternate flights for rescheduling.');
    } finally {
      setAlternateFlightsLoading(false);
    }
  };

  const cancelRescheduleFlow = () => {
    setRescheduleActiveBooking(null);
    setAlternateFlights([]);
    setSelectedAltFlight(null);
    setSelectedAltSeat(null);
    setError('');
  };

  const calculateFeeDifference = () => {
    if (!rescheduleActiveBooking || !selectedAltFlight || !selectedAltSeat) return 0;
    const oldPrice = Number(rescheduleActiveBooking.total_price);
    const newPrice = Number(selectedAltFlight.base_price) + Number(selectedAltSeat.extra_fee);
    const diff = newPrice - oldPrice;
    return diff > 0 ? diff : 0; // If cheaper or equal, charge $0
  };

  const handleAltSeatSelect = (seat: Seat) => {
    setSelectedAltSeat(seat);
    setError('');
  };

  const triggerRescheduleConfirmation = () => {
    if (!selectedAltSeat) {
      setError('Please select a seat on the new flight.');
      return;
    }
    setRescheduleConfirmModalOpen(true);
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleActiveBooking || !selectedAltFlight || !selectedAltSeat) return;
    setRescheduleLoading(true);
    setError('');

    const feeCharged = calculateFeeDifference();

    try {
      const { data, error: rpcError } = await supabase.rpc('reschedule_booking_atomic', {
        p_booking_id: rescheduleActiveBooking.id,
        p_new_flight_id: selectedAltFlight.id,
        p_new_seat_id: selectedAltSeat.id,
        p_fee_charged: feeCharged,
      });

      if (rpcError) throw rpcError;

      const result = data as any;
      if (!result.success) {
        throw new Error(result.error || 'Reschedule transaction failed.');
      }

      setRescheduleConfirmModalOpen(false);
      cancelRescheduleFlow();
      await fetchBookings();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Rescheduling failed. The seat might have been taken.');
      setRescheduleConfirmModalOpen(false);
    } finally {
      setRescheduleLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isWithinTwoHours = (departsAt: string) => {
    const departure = new Date(departsAt).getTime();
    const now = new Date().getTime();
    const twoHoursInMs = 2 * 60 * 60 * 1000;
    return departure - now < twoHoursInMs;
  };

  if (!session) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Your Flight Bookings</h1>
          <p className="text-xs text-slate-400 mt-1">
            View booking status, request visual seat changes, or cancel schedules.
          </p>
        </div>

        {/* Offline indicator */}
        {isOffline && (
          <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-300 font-semibold shrink-0">
            <ShieldAlert className="h-4 w-4" />
            Offline Mode: Showing Cached Bookings
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 font-medium flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Container: Bookings List OR Reschedule Wizard */}
      {!rescheduleActiveBooking ? (
        // --- BOOKINGS DASHBOARD VIEW ---
        <div>
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-56 w-full rounded-3xl border border-white/5 bg-slate-900/30 animate-pulse"
                />
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-16 text-center text-slate-400">
              <Ticket className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white">No Bookings Found</h3>
              <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto">
                You haven&apos;t reserved any flights yet. Use our search console to plan your next itinerary.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {bookings.map((booking) => {
                const departsAtStr = booking.flight.departs_at;
                const canCancel = booking.status !== 'Cancelled' && !isWithinTwoHours(departsAtStr) && !isOffline;
                const canReschedule = booking.status !== 'Cancelled' && !isOffline;

                return (
                  <div
                    key={booking.id}
                    className={`rounded-3xl border p-5 md:p-6 backdrop-blur-md transition-all duration-200 relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6 ${
                      booking.status === 'Cancelled'
                        ? 'border-white/5 bg-slate-950/20 opacity-55'
                        : 'border-white/10 bg-slate-900/40 hover:border-white/15'
                    }`}
                  >
                    {/* Visual left bar color status */}
                    <div
                      className={`absolute top-0 bottom-0 left-0 w-1.5 ${
                        booking.status === 'Cancelled'
                          ? 'bg-slate-700'
                          : booking.status === 'Rescheduled'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />

                    {/* Left: Route, Flight Info */}
                    <div className="flex-1 space-y-4">
                      {/* Booking Header Status */}
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-xs font-bold tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2.5 py-1">
                          PNR: {booking.pnr_code}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">
                          Booked: {new Date(booking.booked_at).toLocaleDateString()}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            booking.status === 'Cancelled'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : booking.status === 'Rescheduled'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>

                      {/* Timeline Flight Specs */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4 max-w-xl">
                        {/* Origin */}
                        <div>
                          <span className="block text-lg font-bold text-white">
                            {formatTime(booking.flight.departs_at)}
                          </span>
                          <span className="block text-xs font-semibold text-slate-400">
                            {booking.flight.origin}
                          </span>
                          <span className="block text-[10px] text-slate-500 mt-1">
                            {formatDate(booking.flight.departs_at)}
                          </span>
                        </div>

                        {/* Mid Indicator */}
                        <div className="flex flex-col items-center gap-1 py-2 sm:py-0">
                          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                            {booking.flight.flight_no}
                          </span>
                          <div className="w-24 h-[1px] bg-slate-800 relative">
                            <Plane className="h-3.5 w-3.5 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45" />
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {booking.flight.aircraft_type}
                          </span>
                        </div>

                        {/* Destination */}
                        <div className="sm:text-right">
                          <span className="block text-lg font-bold text-white">
                            {formatTime(booking.flight.arrives_at)}
                          </span>
                          <span className="block text-xs font-semibold text-slate-400">
                            {booking.flight.destination}
                          </span>
                          <span className="block text-[10px] text-slate-500 mt-1">
                            {formatDate(booking.flight.arrives_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Passenger details */}
                    <div className="border-t border-b sm:border-y-0 sm:border-l lg:border-r border-white/5 py-4 lg:py-0 lg:px-6 space-y-3 shrink-0 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-indigo-400" />
                        <div>
                          <span className="block font-bold text-white">
                            {booking.passenger[0]?.full_name || 'Passenger Name'}
                          </span>
                          <span className="block text-xs text-slate-500">
                            Passport: {booking.passenger[0]?.passport_no || 'N/A'} • {booking.passenger[0]?.nationality || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-semibold text-indigo-300">
                        <span className="bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                          Seat: {booking.seat.seat_number}
                        </span>
                        <span className="capitalize bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md text-slate-400">
                          {booking.seat.class}
                        </span>
                      </div>
                    </div>

                    {/* Right: Price & Action triggers */}
                    <div className="flex sm:flex-row lg:flex-col lg:items-end justify-between items-center gap-4 shrink-0 lg:pl-6">
                      <div className="lg:text-right">
                        <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                          Price Paid
                        </span>
                        <span className="text-xl font-black text-white">
                          ${booking.total_price}
                        </span>
                      </div>

                      {booking.status !== 'Cancelled' && (
                        <div className="flex gap-2.5">
                          {/* Reschedule Button */}
                          <button
                            disabled={!canReschedule}
                            onClick={() => startReschedule(booking)}
                            className="flex items-center gap-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/15 py-2 px-4 text-xs font-bold text-indigo-300 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Reschedule
                          </button>

                          {/* Cancel Button */}
                          <button
                            disabled={!canCancel}
                            onClick={() => triggerCancelBooking(booking)}
                            className="flex items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/5 hover:bg-red-500/15 py-2 px-4 text-xs font-bold text-red-400 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isWithinTwoHours(departsAtStr) ? 'Cancellations blocked within 2 hours of flight' : ''}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // --- RESCHEDULING WIZARD FLOW VIEW ---
        <div className="rounded-3xl border border-indigo-500/20 bg-slate-900/60 p-6 md:p-8 backdrop-blur-md relative">
          <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-6 w-6 text-indigo-400" />
              <div>
                <h3 className="text-lg font-bold text-white">Reschedule Wizard</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Route: {rescheduleActiveBooking.flight.origin} to {rescheduleActiveBooking.flight.destination} • Current Seat: {rescheduleActiveBooking.seat.seat_number}
                </p>
              </div>
            </div>
            <button
              onClick={cancelRescheduleFlow}
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-1.5 px-4 text-xs font-semibold text-slate-300 transition-colors"
            >
              Exit Reschedule
            </button>
          </div>

          {!selectedAltFlight ? (
            // Step 1: Select new flight
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-indigo-400" />
                Select New Flight
              </h4>

              {alternateFlightsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                </div>
              ) : alternateFlights.length === 0 ? (
                <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-12 text-center text-slate-400">
                  <AlertCircle className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-white">No Alternate Flights Found</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    There are no other scheduled flights on this route at this time.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {alternateFlights.map((alt) => (
                    <div
                      key={alt.id}
                      className="rounded-2xl border border-white/10 bg-slate-950 p-5 space-y-4 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="rounded bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                            {alt.flight_no}
                          </span>
                          <span className="text-xs text-slate-500">{alt.aircraft_type}</span>
                        </div>
                        <div className="text-sm space-y-1 font-medium">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Departs:</span>
                            <span className="text-white">
                              {formatDate(alt.departs_at)} {formatTime(alt.departs_at)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Arrives:</span>
                            <span className="text-white">
                              {formatDate(alt.arrives_at)} {formatTime(alt.arrives_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest block">
                            Base Fare
                          </span>
                          <span className="text-lg font-black text-white">${alt.base_price}</span>
                        </div>
                        <button
                          onClick={() => setSelectedAltFlight(alt)}
                          className="rounded-xl bg-indigo-600 hover:bg-indigo-50 px-4 py-2 text-xs font-bold text-white hover:text-indigo-900 transition-all"
                        >
                          Select Flight
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Step 2: Select new seat
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-indigo-400" />
                  Select Seat on Flight {selectedAltFlight.flight_no}
                </h4>
                <button
                  onClick={() => {
                    setSelectedAltFlight(null);
                    setSelectedAltSeat(null);
                  }}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <ArrowRight className="h-3 w-3 rotate-180" />
                  Back to flights
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Seat map */}
                <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-slate-950 p-6">
                  <SeatMap
                    flightId={selectedAltFlight.id}
                    selectedSeatId={selectedAltSeat?.id || null}
                    onSeatSelect={handleAltSeatSelect}
                  />
                </div>

                {/* Confirm details summary */}
                <div className="rounded-2xl border border-white/5 bg-slate-950 p-5 space-y-4.5 text-sm">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2.5">
                    Reschedule Summary
                  </h4>

                  <div className="space-y-1 text-xs">
                    <span className="text-slate-500 font-semibold block uppercase">Flight Exchange</span>
                    <div className="flex items-center gap-2 text-white font-bold">
                      <span>{rescheduleActiveBooking.flight.flight_no}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{selectedAltFlight.flight_no}</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <span className="text-slate-500 font-semibold block uppercase">Seat Swap</span>
                    <div className="flex items-center gap-2 text-white font-bold">
                      <span>Seat {rescheduleActiveBooking.seat.seat_number}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{selectedAltSeat ? `Seat ${selectedAltSeat.seat_number}` : 'Select seat...'}</span>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Current Booking Price:</span>
                      <span className="font-semibold text-white">${rescheduleActiveBooking.total_price}</span>
                    </div>
                    {selectedAltSeat && (
                      <>
                        <div className="flex justify-between text-slate-400">
                          <span>New Booking Price:</span>
                          <span className="font-semibold text-white">
                            ${Number(selectedAltFlight.base_price) + Number(selectedAltSeat.extra_fee)}
                          </span>
                        </div>
                        <div className="flex justify-between text-white font-bold pt-2 border-t border-white/5">
                          <span>Reschedule Fee Diff:</span>
                          <span className="text-indigo-400 font-black">+${calculateFeeDifference()}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    disabled={!selectedAltSeat}
                    onClick={triggerRescheduleConfirmation}
                    className={`w-full rounded-xl py-3 text-xs font-bold text-white transition-all active:scale-95 ${
                      !selectedAltSeat
                        ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-indigo-500/20'
                    }`}
                  >
                    Confirm Reschedule
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- CONFIRMATION MODALS --- */}

      {/* Cancellation Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
        title="Cancel Flight Booking"
        description={`Are you sure you want to cancel booking for Flight ${selectedBookingForCancel?.flight.flight_no} (PNR: ${selectedBookingForCancel?.pnr_code})? This will release Seat ${selectedBookingForCancel?.seat.seat_number} and update ticket status to Cancelled. This action is final.`}
        confirmText="Cancel Reservation"
        isDanger={true}
        isLoading={cancelLoading}
      />

      {/* Reschedule Confirmation Modal */}
      <Modal
        isOpen={rescheduleConfirmModalOpen}
        onClose={() => setRescheduleConfirmModalOpen(false)}
        onConfirm={handleConfirmReschedule}
        title="Confirm Flight Change"
        description={`You are changing your flight booking from ${rescheduleActiveBooking?.flight.flight_no} (Seat ${rescheduleActiveBooking?.seat.seat_number}) to ${selectedAltFlight?.flight_no} (Seat ${selectedAltSeat?.seat_number}). An additional fee difference of $${calculateFeeDifference()} will be charged. Do you want to process this update?`}
        confirmText="Process Reschedule"
        isLoading={rescheduleLoading}
      />
    </div>
  );
}
