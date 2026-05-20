'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Info, Loader2 } from 'lucide-react';

export interface Seat {
  id: string;
  flight_id: string;
  seat_number: string;
  class: 'economy' | 'business' | 'first';
  is_available: boolean;
  extra_fee: number;
}

interface SeatMapProps {
  flightId: string;
  selectedSeatId: string | null;
  mySeatId?: string | null;
  onSeatSelect: (seat: Seat) => void;
}

export default function SeatMap({
  flightId,
  selectedSeatId,
  mySeatId = null,
  onSeatSelect,
}: SeatMapProps) {
  const supabase = useMemo(() => createClient(), []);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);

  // Fetch initial seats and setup realtime listener
  useEffect(() => {
    let active = true;

    async function fetchSeats() {
      setLoading(true);
      const { data, error } = await supabase
        .from('seats')
        .select('*')
        .eq('flight_id', flightId)
        .order('seat_number', { ascending: true });

      if (error) {
        console.error('Error fetching seats:', error);
      } else if (active && data) {
        setSeats(data as Seat[]);
      }
      setLoading(false);
    }

    fetchSeats();

    // Subscribe to realtime updates for this flight's seats
    const channel = supabase
      .channel(`flight-seats-${flightId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'seats',
          filter: `flight_id=eq.${flightId}`,
        },
        (payload: any) => {
          if (!active) return;
          const updatedSeat = payload.new as Seat;
          setSeats((prevSeats) =>
            prevSeats.map((seat) => (seat.id === updatedSeat.id ? updatedSeat : seat))
          );
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [flightId, supabase]);

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <span className="text-sm font-medium">Loading cabin layout...</span>
      </div>
    );
  }

  // Group seats by row number (extract number from seat_number like "1A" -> Row 1)
  const rows: { [key: number]: Seat[] } = {};
  seats.forEach((seat) => {
    const rowNum = parseInt(seat.seat_number.replace(/\D/g, ''), 10);
    if (!rows[rowNum]) rows[rowNum] = [];
    rows[rowNum].push(seat);
  });

  // Sort seats within each row by letter (A, B, C, D, E, F)
  Object.keys(rows).forEach((rowNum) => {
    const r = parseInt(rowNum, 10);
    rows[r].sort((a, b) => a.seat_number.localeCompare(b.seat_number));
  });

  const getSeatColor = (seat: Seat) => {
    if (seat.id === mySeatId) {
      return 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/20';
    }
    if (seat.id === selectedSeatId) {
      return 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-500/30';
    }
    if (!seat.is_available) {
      return 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed';
    }
    // Available colors based on class
    switch (seat.class) {
      case 'first':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/25';
      case 'business':
        return 'bg-violet-500/10 text-violet-300 border-violet-500/30 hover:bg-violet-500/25';
      default:
        return 'bg-sky-500/10 text-sky-300 border-sky-500/30 hover:bg-sky-500/25';
    }
  };

  const getClassBadge = (cls: string) => {
    switch (cls) {
      case 'first':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'business':
        return 'bg-violet-500/20 text-violet-300 border-violet-500/30';
      default:
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
    }
  };

  return (
    <div className="flex flex-col items-center select-none text-white w-full max-w-lg mx-auto">
      {/* Legend */}
      <div className="mb-8 flex flex-wrap justify-center gap-4.5 rounded-2xl border border-white/5 bg-slate-900/50 p-4 text-xs font-medium text-slate-300">
        <div className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-md border border-sky-500/30 bg-sky-500/10" />
          <span>Economy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-md border border-violet-500/30 bg-violet-500/10" />
          <span>Business</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-md border border-amber-500/30 bg-amber-500/10" />
          <span>First</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-md bg-indigo-600" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-md bg-slate-800 border border-slate-700" />
          <span>Occupied</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-md bg-emerald-500" />
          <span>Current Seat</span>
        </div>
      </div>

      {/* Flight cabin fuselage wrapper */}
      <div className="w-full overflow-x-auto pb-4 px-2">
        <div className="min-w-[320px] rounded-t-[100px] border-t-2 border-x-2 border-slate-700 bg-slate-950 p-6 pt-16 shadow-2xl relative">
          {/* Nose highlight */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-700 rounded-full opacity-50" />

          {/* Cabin layout */}
          <div className="space-y-4">
            {Object.keys(rows).map((rowNumStr) => {
              const rowNum = parseInt(rowNumStr, 10);
              const rowSeats = rows[rowNum];

              // Split seats for aisle representation (A-C, Aisle, D-F)
              const leftSeats = rowSeats.slice(0, 3);
              const rightSeats = rowSeats.slice(3, 6);

              return (
                <div key={rowNum} className="flex items-center justify-between gap-4">
                  {/* Row Indicator (Left) */}
                  <span className="w-5 text-center text-xs font-semibold text-slate-500">{rowNum}</span>

                  {/* Left Column of Seats */}
                  <div className="flex gap-2.5">
                    {leftSeats.map((seat) => (
                      <div
                        key={seat.id}
                        className="relative"
                        onMouseEnter={() => setHoveredSeat(seat)}
                        onMouseLeave={() => setHoveredSeat(null)}
                      >
                        <button
                          disabled={!seat.is_available && seat.id !== mySeatId}
                          onClick={() => onSeatSelect(seat)}
                          className={`h-9 w-9 rounded-xl border text-xs font-bold transition-all duration-150 active:scale-90 ${getSeatColor(
                            seat
                          )}`}
                        >
                          {seat.seat_number.slice(-1)}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Aisle */}
                  <div className="w-8 flex justify-center text-[10px] font-bold text-slate-600 uppercase tracking-widest self-stretch items-center bg-slate-900/30 rounded">
                    Aisle
                  </div>

                  {/* Right Column of Seats */}
                  <div className="flex gap-2.5">
                    {rightSeats.map((seat) => (
                      <div
                        key={seat.id}
                        className="relative"
                        onMouseEnter={() => setHoveredSeat(seat)}
                        onMouseLeave={() => setHoveredSeat(null)}
                      >
                        <button
                          disabled={!seat.is_available && seat.id !== mySeatId}
                          onClick={() => onSeatSelect(seat)}
                          className={`h-9 w-9 rounded-xl border text-xs font-bold transition-all duration-150 active:scale-90 ${getSeatColor(
                            seat
                          )}`}
                        >
                          {seat.seat_number.slice(-1)}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Row Indicator (Right) */}
                  <span className="w-5 text-center text-xs font-semibold text-slate-500">{rowNum}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dynamic Info / Tooltip Panel */}
      <div className="mt-8 w-full min-h-[72px] rounded-2xl border border-white/5 bg-slate-900/40 p-4 backdrop-blur-md flex items-center justify-center text-center">
        {hoveredSeat ? (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">Seat {hoveredSeat.seat_number}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getClassBadge(hoveredSeat.class)}`}>
                {hoveredSeat.class}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {hoveredSeat.id === mySeatId ? (
                <span className="text-emerald-400 font-semibold">Your current reserved seat.</span>
              ) : !hoveredSeat.is_available ? (
                <span className="text-red-400 font-semibold">Occupied • No fee info</span>
              ) : hoveredSeat.extra_fee > 0 ? (
                `Premium Fee: +$${hoveredSeat.extra_fee}`
              ) : (
                'Standard seat price (No extra fee)'
              )}
            </p>
          </div>
        ) : selectedSeatId ? (
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-semibold text-indigo-300">
              Seat {seats.find((s) => s.id === selectedSeatId)?.seat_number} Selected
            </p>
            <p className="text-xs text-slate-400">Proceed to complete your ticket booking.</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Info className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>Hover over a seat for class details and tap to select.</span>
          </div>
        )}
      </div>
    </div>
  );
}
