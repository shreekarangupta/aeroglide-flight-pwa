'use client';

import { WifiOff, Ticket, Search, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center pt-12 pb-16 text-center animate-fade-in max-w-md mx-auto">
      <div className="rounded-3xl border border-indigo-500/20 bg-slate-900/60 p-8 backdrop-blur-md shadow-xl text-white space-y-6">
        {/* Offline Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
          <WifiOff className="h-8 w-8" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-xl font-black tracking-tight">Connection Lost</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            You are currently offline. Check your internet settings or retry the request.
          </p>
        </div>

        {/* Offline cache feature banner */}
        <div className="rounded-2xl border border-white/5 bg-slate-950 p-4 text-xs text-slate-400 text-left space-y-2">
          <span className="font-bold text-white uppercase tracking-wider block text-[10px]">
            Offline Capability
          </span>
          <p>
            Your booked flights and ticket detail structures are saved locally. You can access them at any time without an active connection.
          </p>
        </div>

        {/* Navigation Action Buttons */}
        <div className="space-y-3 pt-2">
          <Link
            href="/bookings"
            className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2"
          >
            <Ticket className="h-4 w-4" />
            View My Bookings (Offline)
          </Link>

          <button
            onClick={handleRetry}
            className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-3 text-sm font-semibold text-slate-300 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Connection
          </button>
        </div>
      </div>
    </div>
  );
}
