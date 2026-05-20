'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFlightStore, type Flight } from '@/stores/useFlightStore';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Clock, Plane, Calendar, ShieldCheck, HelpCircle } from 'lucide-react';
import Link from 'next/link';

interface FlightWithSeatCount extends Flight {
  availableSeats: number;
}

export default function FlightsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { searchQuery, setSelectedFlight, setBookingStep } = useFlightStore();

  const [flights, setFlights] = useState<FlightWithSeatCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { origin, destination, date, passengers } = searchQuery;

  useEffect(() => {
    if (!origin || !destination) {
      router.push('/');
      return;
    }

    async function fetchFlights() {
      setLoading(true);
      setError('');
      try {
        // Fetch flights for the given route
        const { data: flightsData, error: flightsError } = await supabase
          .from('flights')
          .select('*')
          .eq('origin', origin)
          .eq('destination', destination);

        if (flightsError) throw flightsError;

        if (flightsData) {
          // Fetch seat counts for each flight
          const flightsWithSeats = await Promise.all(
            (flightsData as Flight[]).map(async (flight) => {
              const { count, error: countError } = await supabase
                .from('seats')
                .select('*', { count: 'exact', head: true })
                .eq('flight_id', flight.id)
                .eq('is_available', true);

              return {
                ...flight,
                availableSeats: countError ? 0 : count || 0,
              };
            })
          );
          setFlights(flightsWithSeats);
        }
      } catch (err: any) {
        console.error(err);
        setError('Failed to load flights. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchFlights();
  }, [origin, destination, date, supabase, router]);

  const handleSelectFlight = (flight: Flight) => {
    setSelectedFlight(flight);
    setBookingStep(3); // Next step: Passenger Details Form
    router.push('/booking');
  };

  const calculateDuration = (dep: string, arr: string) => {
    const diff = new Date(arr).getTime() - new Date(dep).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.round((diff % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
  };

  if (!origin) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-16">
      {/* Search Header Summary */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-2.5 text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-lg font-bold text-white">
              <span>{origin}</span>
              <Plane className="h-4 w-4 text-indigo-400 rotate-45" />
              <span>{destination}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-indigo-400" />
                {date ? formatDate(date) : ''}
              </span>
              <span>•</span>
              <span>{passengers} Passenger{passengers > 1 ? 's' : ''}</span>
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 px-4 py-2 transition-all shrink-0"
        >
          Modify Search
        </Link>
      </div>

      {/* Flight Listings */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white mb-4">Available Outbound Flights</h2>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-48 w-full rounded-3xl border border-white/5 bg-slate-900/30 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400 font-medium">
            {error}
          </div>
        ) : flights.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-12 text-center text-slate-400">
            <Plane className="h-10 w-10 text-slate-600 mx-auto mb-3 -rotate-45" />
            <h3 className="text-base font-semibold text-white">No Flights Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              We couldn&apos;t find any flights for the route {origin} to {destination}. Try searching for other routes like JFK to LAX.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {flights.map((flight) => {
              const isSoldOut = flight.availableSeats < passengers;

              return (
                <div
                  key={flight.id}
                  className={`rounded-3xl border p-5 md:p-6 backdrop-blur-md transition-all duration-200 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                    isSoldOut
                      ? 'border-white/5 bg-slate-950/40 opacity-60'
                      : 'border-white/10 bg-slate-900/60 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5'
                  }`}
                >
                  {/* Flight Route & Details */}
                  <div className="flex-1 space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <span className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-300">
                        {flight.flight_no}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {flight.aircraft_type}
                      </span>
                    </div>

                    {/* Timeline */}
                    <div className="flex items-center justify-between max-w-sm gap-4">
                      {/* Departure */}
                      <div>
                        <span className="block text-xl font-bold text-white">
                          {formatTime(flight.departs_at)}
                        </span>
                        <span className="block text-xs font-medium text-slate-500 mt-0.5">
                          {origin}
                        </span>
                      </div>

                      {/* Line connector */}
                      <div className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-indigo-400" />
                          {calculateDuration(flight.departs_at, flight.arrives_at)}
                        </span>
                        <div className="w-full h-[2px] bg-slate-800 relative rounded-full">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-700 bg-slate-900 p-0.5">
                            <Plane className="h-3 w-3 text-indigo-400 rotate-45" />
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
                          Non-stop
                        </span>
                      </div>

                      {/* Arrival */}
                      <div className="text-right">
                        <span className="block text-xl font-bold text-white">
                          {formatTime(flight.arrives_at)}
                        </span>
                        <span className="block text-xs font-medium text-slate-500 mt-0.5">
                          {destination}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Seat capacity & Booking Selector */}
                  <div className="flex items-center justify-between md:flex-col md:items-end gap-4 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6 shrink-0">
                    <div className="text-left md:text-right">
                      <span className="block text-xs text-slate-500 font-medium uppercase tracking-wider">
                        Price
                      </span>
                      <span className="text-2xl font-black text-white">
                        ${flight.base_price}
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 w-full md:w-auto">
                      <button
                        disabled={isSoldOut}
                        onClick={() => handleSelectFlight(flight)}
                        className={`w-full md:w-auto rounded-xl py-2.5 px-6 text-sm font-bold text-white transition-all active:scale-[0.98] ${
                          isSoldOut
                            ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-500/20 hover:scale-[1.01]'
                        }`}
                      >
                        {isSoldOut ? 'Sold Out' : 'Select Flight'}
                      </button>
                      <span
                        className={`text-[10px] font-semibold mt-1 ${
                          isSoldOut
                            ? 'text-red-400'
                            : flight.availableSeats <= 5
                            ? 'text-amber-400 animate-pulse'
                            : 'text-emerald-400'
                        }`}
                      >
                        {isSoldOut
                          ? 'No seats remaining'
                          : `${flight.availableSeats} seat${flight.availableSeats > 1 ? 's' : ''} left`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
