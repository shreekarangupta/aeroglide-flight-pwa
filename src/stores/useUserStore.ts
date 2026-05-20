import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserSession {
  id: string;
  email: string;
  fullName?: string;
}

export interface CachedBooking {
  id: string;
  pnr_code: string;
  booked_at: string;
  total_price: number;
  status: string;
  flight_id: string;
  seat_id: string;
  flight: {
    id: string;
    flight_no: string;
    origin: string;
    destination: string;
    departs_at: string;
    arrives_at: string;
    aircraft_type: string;
    base_price: number;
  };
  seat: {
    id: string;
    seat_number: string;
    class: string;
    extra_fee: number;
  };
  passenger: {
    full_name: string;
    passport_no: string;
    nationality: string;
    dob: string;
  }[];
}

interface UserStore {
  session: UserSession | null;
  cachedBookings: CachedBooking[];
  setSession: (session: UserSession | null) => void;
  setCachedBookings: (bookings: CachedBooking[]) => void;
  resetUserStore: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      session: null,
      cachedBookings: [],
      setSession: (session) => set({ session }),
      setCachedBookings: (bookings) => set({ cachedBookings: bookings }),
      resetUserStore: () => set({ session: null, cachedBookings: [] }),
    }),
    {
      name: 'user-auth-bookings',
    }
  )
);
