'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFlightStore, type Seat } from '@/stores/useFlightStore';
import { useUserStore } from '@/stores/useUserStore';
import { createClient } from '@/lib/supabase/client';
import SeatMap from '@/components/SeatMap';
import { ArrowLeft, Ticket, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SeatsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const {
    selectedFlight,
    selectedSeat,
    passengerData,
    setSelectedSeat,
    resetFlightStore,
    setBookingStep,
  } = useFlightStore();
  const { session } = useUserStore();

  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState('');
  const [successBooking, setSuccessBooking] = useState<any>(null);

  // Validate state
  useEffect(() => {
    if (!selectedFlight || passengerData.length === 0) {
      router.push('/');
    }
  }, [selectedFlight, passengerData, router]);

  if (!selectedFlight || passengerData.length === 0) return null;

  const basePrice = selectedFlight.base_price;
  const extraFee = selectedSeat ? selectedSeat.extra_fee : 0;
  const totalPrice = Number(basePrice) + Number(extraFee);

  const handleSeatSelect = (seat: Seat) => {
    setSelectedSeat(seat);
    setError('');
  };

  const generatePNR = () => {
    // Generate a 6-character unique alphanumeric PNR code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pnr = '';
    for (let i = 0; i < 6; i++) {
      pnr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pnr;
  };

  const handleConfirmBooking = async () => {
    if (!selectedSeat) {
      setError('Please select a seat to proceed.');
      return;
    }
    if (!session) {
      router.push('/login?redirect=/seats');
      return;
    }

    setBookingLoading(true);
    setError('');

    const passenger = passengerData[0];
    const pnrCode = generatePNR();

    try {
      // Invoke the database atomic function
      const { data, error: rpcError } = await supabase.rpc('book_flight_atomic', {
        p_flight_id: selectedFlight.id,
        p_seat_id: selectedSeat.id,
        p_full_name: passenger.full_name,
        p_passport_no: passenger.passport_no,
        p_nationality: passenger.nationality,
        p_dob: passenger.dob,
        p_total_price: totalPrice,
        p_pnr_code: pnrCode,
      });

      if (rpcError) throw rpcError;

      const result = data as any;

      if (!result.success) {
        throw new Error(result.error || 'Booking failed.');
      }

      setSuccessBooking({
        pnr: pnrCode,
        seat: selectedSeat.seat_number,
        flight: selectedFlight.flight_no,
        price: totalPrice,
      });

      // Clear search booking step in store
      resetFlightStore();
      setBookingStep(1);

      // Redirect after showing success modal
      setTimeout(() => {
        router.push('/bookings');
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during booking. The seat might have just been reserved by another passenger.');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-16">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            href="/booking"
            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-2.5 text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">
              Step 4 of 4
            </span>
            <h2 className="text-lg font-bold text-white mt-0.5">Select Your Seat</h2>
          </div>
        </div>
      </div>

      {/* Booking Status Message Overlay */}
      {successBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="text-center max-w-md w-full rounded-3xl border border-indigo-500/30 bg-slate-900 p-8 shadow-2xl animate-scale-up text-white">
            <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-black mb-2">Booking Confirmed!</h2>
            <p className="text-sm text-slate-400 mb-6">
              Your flight ticket has been booked successfully.
            </p>

            <div className="rounded-2xl border border-white/5 bg-slate-950 p-4 space-y-2.5 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">PNR Code:</span>
                <span className="text-white font-bold tracking-wider">{successBooking.pnr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Flight No:</span>
                <span className="text-white font-bold">{successBooking.flight}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Seat allocation:</span>
                <span className="text-indigo-400 font-bold">Seat {successBooking.seat}</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-2.5">
                <span className="text-slate-400 font-bold">Total Paid:</span>
                <span className="text-white font-black">${successBooking.price}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-6 animate-pulse">
              Navigating to your bookings dashboard...
            </p>
          </div>
        </div>
      )}

      {/* Grid Layout: Seatmap Left, Summary Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Seat Map component column */}
        <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md shadow-xl">
          <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider text-center">
            Cabin Seat Selection
          </h3>
          <SeatMap
            flightId={selectedFlight.id}
            selectedSeatId={selectedSeat?.id || null}
            onSeatSelect={handleSeatSelect}
          />
        </div>

        {/* Booking Summary column */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md shadow-xl space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Booking Summary
            </h3>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-400 font-medium leading-relaxed">
                {error}
              </div>
            )}

            {/* Passenger Info */}
            <div className="space-y-1 text-sm border-b border-white/5 pb-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Passenger
              </span>
              <span className="block font-bold text-white">{passengerData[0].full_name}</span>
              <span className="block text-xs text-slate-400">
                {passengerData[0].nationality} • DOB: {passengerData[0].dob}
              </span>
            </div>

            {/* Flight Info */}
            <div className="space-y-1.5 text-sm border-b border-white/5 pb-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Flight details
              </span>
              <div className="flex justify-between font-bold text-white">
                <span>{selectedFlight.flight_no}</span>
                <span>{selectedFlight.origin} → {selectedFlight.destination}</span>
              </div>
              <span className="block text-xs text-slate-400">
                Departs: {new Date(selectedFlight.departs_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {/* Pricing Details */}
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Base Airfare</span>
                <span className="font-semibold text-white">${basePrice}</span>
              </div>
              {selectedSeat && (
                <div className="flex justify-between text-slate-400">
                  <span>
                    Seat {selectedSeat.seat_number} Premium ({selectedSeat.class})
                  </span>
                  <span className="font-semibold text-indigo-400">+${extraFee}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-white/5 pt-3.5 text-base font-bold">
                <span className="text-slate-300">Total Price</span>
                <span className="text-xl font-black text-white">${totalPrice}</span>
              </div>
            </div>

            {/* Confirm Action Button */}
            <button
              onClick={handleConfirmBooking}
              disabled={!selectedSeat || bookingLoading}
              className={`w-full rounded-2xl py-4 text-sm font-semibold tracking-wide text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                !selectedSeat || bookingLoading
                  ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/25'
              }`}
            >
              {bookingLoading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  Booking Ticket...
                </>
              ) : (
                <>
                  <Ticket className="h-4.5 w-4.5" />
                  Confirm & Reserve
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
