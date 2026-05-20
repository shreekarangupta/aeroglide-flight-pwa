import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SearchQuery {
  origin: string;
  destination: string;
  date: string;
  passengers: number;
}

export interface Flight {
  id: string;
  flight_no: string;
  origin: string;
  destination: string;
  departs_at: string;
  arrives_at: string;
  aircraft_type: string;
  status: string;
  base_price: number;
}

export interface Seat {
  id: string;
  flight_id: string;
  seat_number: string;
  class: 'economy' | 'business' | 'first';
  is_available: boolean;
  extra_fee: number;
}

export interface Passenger {
  full_name: string;
  passport_no: string;
  nationality: string;
  dob: string;
}

interface FlightStore {
  searchQuery: SearchQuery;
  selectedFlight: Flight | null;
  selectedSeat: Seat | null;
  bookingStep: number;
  passengerData: Passenger[];
  setSearchQuery: (query: Partial<SearchQuery>) => void;
  setSelectedFlight: (flight: Flight | null) => void;
  setSelectedSeat: (seat: Seat | null) => void;
  setBookingStep: (step: number) => void;
  setPassengerData: (data: Passenger[]) => void;
  resetFlightStore: () => void;
}

const initialSearchQuery: SearchQuery = {
  origin: '',
  destination: '',
  date: '',
  passengers: 1,
};

export const useFlightStore = create<FlightStore>()(
  persist(
    (set) => ({
      searchQuery: initialSearchQuery,
      selectedFlight: null,
      selectedSeat: null,
      bookingStep: 1,
      passengerData: [],

      setSearchQuery: (query) =>
        set((state) => ({
          searchQuery: { ...state.searchQuery, ...query },
        })),

      setSelectedFlight: (flight) => set({ selectedFlight: flight }),
      setSelectedSeat: (seat) => set({ selectedSeat: seat }),
      setBookingStep: (step) => set({ bookingStep: step }),
      setPassengerData: (data) => set({ passengerData: data }),

      resetFlightStore: () =>
        set({
          searchQuery: initialSearchQuery,
          selectedFlight: null,
          selectedSeat: null,
          bookingStep: 1,
          passengerData: [],
        }),
    }),
    {
      name: 'flight-booking-progress',
      // Exclude passport_no from being persisted to local storage
      partialize: (state) => {
        const { passengerData, ...rest } = state;
        return {
          ...rest,
          passengerData: passengerData.map((passenger) => ({
            full_name: passenger.full_name,
            passport_no: '', // empty out the sensitive passport number
            nationality: passenger.nationality,
            dob: passenger.dob,
          })),
        };
      },
    }
  )
);
