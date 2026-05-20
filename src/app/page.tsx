'use client';

import { useRouter } from 'next/navigation';
import { useFlightStore } from '@/stores/useFlightStore';
import { Plane, Calendar, Users, MapPin, ArrowRightLeft, Sparkles } from 'lucide-react';
import { useState } from 'react';

const AIRPORTS = [
  { code: 'JFK', name: 'New York (JFK)' },
  { code: 'LAX', name: 'Los Angeles (LAX)' },
  { code: 'LHR', name: 'London (LHR)' },
  { code: 'CDG', name: 'Paris (CDG)' },
  { code: 'HND', name: 'Tokyo (HND)' },
  { code: 'SIN', name: 'Singapore (SIN)' },
  { code: 'DXB', name: 'Dubai (DXB)' },
  { code: 'SYD', name: 'Sydney (SYD)' },
];

export default function SearchPage() {
  const router = useRouter();
  const { searchQuery, setSearchQuery, setBookingStep } = useFlightStore();

  const [origin, setOrigin] = useState(searchQuery.origin || '');
  const [destination, setDestination] = useState(searchQuery.destination || '');
  const [date, setDate] = useState(searchQuery.date || '');
  const [passengers, setPassengers] = useState(searchQuery.passengers || 1);
  const [error, setError] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!origin) {
      setError('Please select an origin airport.');
      return;
    }
    if (!destination) {
      setError('Please select a destination airport.');
      return;
    }
    if (origin === destination) {
      setError('Origin and destination cannot be the same.');
      return;
    }
    if (!date) {
      setError('Please choose a departure date.');
      return;
    }
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      setError('Departure date cannot be in the past.');
      return;
    }

    // Save to Zustand store
    setSearchQuery({ origin, destination, date, passengers });
    setBookingStep(2); // Next step: Flights List
    router.push('/flights');
  };

  const swapAirports = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  return (
    <div className="flex flex-col items-center justify-center pt-8 pb-16 animate-fade-in">
      {/* Hero Section */}
      <div className="text-center max-w-2xl mb-12">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-4 py-1.5 text-sm font-semibold text-indigo-300 border border-indigo-500/20 mb-4 animate-scale-up">
          <Sparkles className="h-4 w-4" />
          Seamless Sky Bookings
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
          Where Next, Explorer?
        </h1>
        <p className="text-slate-400 text-base md:text-lg">
          Fly globally with real-time seat allocations, direct scheduling, and an offline-ready experience.
        </p>
      </div>

      {/* Search Console Card */}
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/60 p-6 md:p-8 backdrop-blur-md shadow-xl shadow-indigo-500/5 relative overflow-hidden animate-slide-up">
        {/* Glow accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />

        <form onSubmit={handleSearch} className="space-y-6 relative">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 font-medium">
              {error}
            </div>
          )}

          {/* From & To Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
            {/* Origin */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                From (Origin)
              </label>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3.5 text-sm text-white focus:border-indigo-500 focus:outline-none transition-all duration-200"
              >
                <option value="">Select origin airport</option>
                {AIRPORTS.map((ap) => (
                  <option key={`origin-${ap.code}`} value={ap.code}>
                    {ap.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button (between items on desktop) */}
            <div className="absolute left-1/2 top-[58px] -translate-x-1/2 -translate-y-1/2 z-10 hidden md:block">
              <button
                type="button"
                onClick={swapAirports}
                className="rounded-full border border-white/10 bg-slate-900 p-2 text-indigo-400 hover:text-indigo-300 hover:scale-110 active:scale-95 transition-all shadow-md shadow-slate-950"
              >
                <ArrowRightLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Destination */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                To (Destination)
              </label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3.5 text-sm text-white focus:border-indigo-500 focus:outline-none transition-all duration-200"
              >
                <option value="">Select destination airport</option>
                {AIRPORTS.map((ap) => (
                  <option key={`dest-${ap.code}`} value={ap.code}>
                    {ap.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date & Passengers Input */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Departure Date */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                Departure Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none transition-all duration-200"
              />
            </div>

            {/* Passengers Count */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-indigo-400" />
                Passengers
              </label>
              <input
                type="number"
                min="1"
                max="9"
                value={passengers}
                onChange={(e) => setPassengers(parseInt(e.target.value, 10) || 1)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none transition-all duration-200"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 py-4 text-sm font-semibold tracking-wide text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.01] transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Plane className="h-4.5 w-4.5 -rotate-45" />
            Search Flights
          </button>
        </form>
      </div>
    </div>
  );
}
