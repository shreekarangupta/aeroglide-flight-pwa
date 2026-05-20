'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFlightStore, type Passenger } from '@/stores/useFlightStore';
import { useUserStore } from '@/stores/useUserStore';
import { ArrowLeft, User, Globe, CreditCard, Calendar, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function BookingPage() {
  const router = useRouter();
  const { selectedFlight, setPassengerData, setBookingStep } = useFlightStore();
  const { session } = useUserStore();

  const [fullName, setFullName] = useState('');
  const [passportNo, setPassportNo] = useState('');
  const [nationality, setNationality] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');

  // Secure route: Must have flight selected. If not logged in, prompt user.
  useEffect(() => {
    if (!selectedFlight) {
      router.push('/');
    }
  }, [selectedFlight, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!session) {
      router.push('/login?redirect=/booking');
      return;
    }

    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!passportNo.trim() || passportNo.length < 5) {
      setError('Please enter a valid passport number.');
      return;
    }
    if (!nationality.trim()) {
      setError('Nationality is required.');
      return;
    }
    if (!dob) {
      setError('Date of birth is required.');
      return;
    }

    // Verify age is not negative / future
    const dobDate = new Date(dob);
    if (dobDate >= new Date()) {
      setError('Date of birth cannot be in the future.');
      return;
    }

    // Save to Zustand
    const passenger: Passenger = {
      full_name: fullName.trim(),
      passport_no: passportNo.trim(),
      nationality: nationality.trim(),
      dob,
    };

    setPassengerData([passenger]);
    setBookingStep(4); // Next step: Seat Selection
    router.push('/seats');
  };

  if (!selectedFlight) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in pb-16">
      {/* Header Summary */}
      <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-md">
        <Link
          href="/flights"
          className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-2.5 text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">
            Step 3 of 4
          </span>
          <h2 className="text-lg font-bold text-white mt-0.5">Passenger Details</h2>
        </div>
      </div>

      {/* Flight Recap */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-md">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Flight Details
        </h3>
        <div className="flex justify-between items-center text-sm font-medium">
          <div>
            <span className="text-white block font-bold">{selectedFlight.flight_no}</span>
            <span className="text-slate-400 text-xs mt-0.5">
              {selectedFlight.origin} to {selectedFlight.destination}
            </span>
          </div>
          <div className="text-right">
            <span className="text-white block">
              {new Date(selectedFlight.departs_at).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <span className="text-slate-400 text-xs mt-0.5">
              {new Date(selectedFlight.departs_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Passenger Details Card */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 md:p-8 backdrop-blur-md shadow-xl relative overflow-hidden">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 font-medium">
              {error}
            </div>
          )}

          {!session && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3 text-amber-300">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <div className="text-xs leading-relaxed">
                <span className="font-bold">Authentication Required:</span> You need to sign in to your account to complete a flight booking. Clicking below will redirect you to sign in.
              </div>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-indigo-400" />
              Full Name (as in Passport)
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-all duration-200"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Passport Number */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-indigo-400" />
                Passport Number
              </label>
              <input
                type="text"
                required
                value={passportNo}
                onChange={(e) => setPassportNo(e.target.value)}
                placeholder="e.g. A1234567"
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-all duration-200"
              />
            </div>

            {/* Nationality */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-indigo-400" />
                Nationality
              </label>
              <input
                type="text"
                required
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="e.g. United States"
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-all duration-200"
              />
            </div>
          </div>

          {/* Date of Birth */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-indigo-400" />
              Date of Birth
            </label>
            <input
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none transition-all duration-200"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 py-4 text-sm font-semibold tracking-wide text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.01] transition-all duration-200 active:scale-[0.99]"
          >
            {session ? 'Select Seat' : 'Sign In & Select Seat'}
          </button>
        </form>
      </div>
    </div>
  );
}
