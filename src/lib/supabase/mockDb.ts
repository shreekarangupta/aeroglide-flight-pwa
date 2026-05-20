'use client';

// Helper local DB operations for mock sandbox environment
const getMockFlights = () => {
  const key = 'mock_flights';
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(key);
  let flights = data ? JSON.parse(data) : [];
  if (flights.length === 0) {
    flights = [
      {
        id: 'flight-jfk-lax-1',
        flight_no: 'AA-101',
        origin: 'JFK',
        destination: 'LAX',
        departs_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T08:00:00Z',
        arrives_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T11:30:00Z',
        aircraft_type: 'Boeing 777-300ER',
        status: 'On Time',
        base_price: 250
      },
      {
        id: 'flight-jfk-lax-2',
        flight_no: 'AA-102',
        origin: 'JFK',
        destination: 'LAX',
        departs_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T16:00:00Z',
        arrives_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T19:30:00Z',
        aircraft_type: 'Boeing 777-300ER',
        status: 'On Time',
        base_price: 280
      },
      {
        id: 'flight-lhr-cdg-1',
        flight_no: 'BA-201',
        origin: 'LHR',
        destination: 'CDG',
        departs_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T09:00:00Z',
        arrives_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T10:15:00Z',
        aircraft_type: 'Airbus A320neo',
        status: 'On Time',
        base_price: 95
      },
      {
        id: 'flight-hnd-sin-1',
        flight_no: 'SQ-301',
        origin: 'HND',
        destination: 'SIN',
        departs_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T11:00:00Z',
        arrives_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T17:30:00Z',
        aircraft_type: 'Boeing 787-10',
        status: 'On Time',
        base_price: 320
      },
      {
        id: 'flight-dxb-syd-1',
        flight_no: 'EK-401',
        origin: 'DXB',
        destination: 'SYD',
        departs_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T02:15:00Z',
        arrives_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T22:30:00Z',
        aircraft_type: 'Airbus A380-800',
        status: 'On Time',
        base_price: 680
      }
    ];
    localStorage.setItem(key, JSON.stringify(flights));
  }
  return flights;
};

const saveMockSeats = (seats: any[]) => {
  localStorage.setItem('mock_seats', JSON.stringify(seats));
};

const getMockSeats = () => {
  const key = 'mock_seats';
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(key);
  let seats = data ? JSON.parse(data) : [];
  
  const flights = getMockFlights();
  const hasSeatsForFlights = flights.length > 0 && seats.some((s: any) => s.flight_id === flights[0].id);

  if (seats.length === 0 || !hasSeatsForFlights) {
    seats = [];
    flights.forEach((flight: any) => {
      const classes = ['first', 'business', 'business', 'economy', 'economy'];
      const fees = [150, 75, 75, 0, 0];

      for (let r = 1; r <= 5; r++) {
        const cls = classes[r - 1];
        const fee = fees[r - 1];

        ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col: string) => {
          const seatNum = `${r}${col}`;
          const isAvailable = !(r === 2 && col === 'B') && !(r === 4 && col === 'D') && !(r === 1 && col === 'A');

          seats.push({
            id: `seat-${flight.id}-${seatNum}`,
            flight_id: flight.id,
            seat_number: seatNum,
            class: cls,
            is_available: isAvailable,
            extra_fee: fee,
          });
        });
      }
    });

    localStorage.setItem(key, JSON.stringify(seats));
  }
  return seats;
};

const saveMockBookings = (bookings: any[]) => {
  localStorage.setItem('mock_bookings', JSON.stringify(bookings));
};

const getMockBookings = () => {
  const key = 'mock_bookings';
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify([]));
    return [];
  }
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.filter((b: any) => b && b.flight && b.seat && b.passenger);
    }
  } catch (e) {
    return [];
  }
  return [];
};

export class MockSupabase {
  auth = {
    signInWithPassword: async ({ email }: any) => {
      const user = { id: 'mock-user-123', email };
      const session = { user, access_token: 'mock-jwt-token' };
      localStorage.setItem('mock_session', JSON.stringify(session));
      return { data: { session, user }, error: null };
    },
    signUp: async ({ email }: any) => {
      const user = { id: 'mock-user-123', email };
      return { data: { user }, error: null };
    },
    signOut: async () => {
      localStorage.removeItem('mock_session');
      return { error: null };
    },
    getSession: async () => {
      const s = localStorage.getItem('mock_session');
      return { data: { session: s ? JSON.parse(s) : null }, error: null };
    },
    onAuthStateChange: (cb: any) => {
      const s = localStorage.getItem('mock_session');
      const parsed = s ? JSON.parse(s) : null;
      if (cb) {
        // Trigger asynchronously to prevent synchronous React state loop crashes
        setTimeout(() => {
          cb(parsed ? 'SIGNED_IN' : 'SIGNED_OUT', parsed);
        }, 0);
      }
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  };

  channel(name: string) {
    return {
      on: function (event: any, config: any, callback: any) {
        return this;
      },
      subscribe: function () {
        return this;
      },
    };
  }

  removeChannel(ch: any) {}

  from(table: string) {
    const getResult = () => {
      if (table === 'flights') return getMockFlights();
      if (table === 'seats') return getMockSeats();
      if (table === 'bookings') return getMockBookings();
      return [];
    };

    const result = getResult();

    const createChain = (filtered: any[]) => {
      const chainObj: any = {
        eq: (field: string, value: any) => {
          const nextFiltered = filtered.filter((item: any) => {
            const val = item[field];
            if (val && typeof val === 'object') {
              return false; // don't filter on nested objects
            }
            return item[field] === value;
          });
          return createChain(nextFiltered);
        },
        neq: (field: string, value: any) => {
          const nextFiltered = filtered.filter((item: any) => item[field] !== value);
          return createChain(nextFiltered);
        },
        gt: (field: string, value: any) => {
          const nextFiltered = filtered.filter((item: any) => new Date(item[field]) > new Date(value));
          return createChain(nextFiltered);
        },
        order: (field: string, options?: any) => {
          return createChain(filtered);
        },
        then: (resolve: any) => {
          resolve({ data: filtered, error: null, count: filtered.length });
          return Promise.resolve({ data: filtered, error: null, count: filtered.length });
        },
      };
      return chainObj;
    };

    return {
      select: (columns?: string, options?: any) => {
        return createChain(result);
      }
    };
  }

  async rpc(name: string, params: any) {
    if (name === 'book_flight_atomic') {
      const {
        p_flight_id,
        p_seat_id,
        p_full_name,
        p_passport_no,
        p_nationality,
        p_dob,
        p_total_price,
        p_pnr_code,
      } = params;

      const seats = getMockSeats();
      const seatIndex = seats.findIndex((s: any) => s.id === p_seat_id);
      if (seatIndex === -1 || !seats[seatIndex].is_available) {
        return { data: { success: false, error: 'Seat is already occupied.' }, error: null };
      }

      // Mark seat as occupied
      seats[seatIndex].is_available = false;
      saveMockSeats(seats);

      // Save Booking
      const bookings = getMockBookings();
      const flights = getMockFlights();
      const flight = flights.find((f: any) => f.id === p_flight_id);

      const newBooking = {
        id: 'booking-' + Math.random().toString(36).substr(2, 9),
        pnr_code: p_pnr_code,
        booked_at: new Date().toISOString(),
        total_price: p_total_price,
        status: 'Confirmed',
        flight_id: p_flight_id,
        seat_id: p_seat_id,
        flight,
        seat: seats[seatIndex],
        passenger: [
          {
            full_name: p_full_name,
            passport_no: p_passport_no,
            nationality: p_nationality,
            dob: p_dob,
          },
        ],
      };

      bookings.push(newBooking);
      saveMockBookings(bookings);

      return { data: { success: true }, error: null };
    }

    if (name === 'cancel_booking_atomic') {
      const { p_booking_id } = params;
      const bookings = getMockBookings();
      const bookingIndex = bookings.findIndex((b: any) => b.id === p_booking_id);
      if (bookingIndex === -1) {
        return { data: { success: false, error: 'Booking not found.' }, error: null };
      }

      const booking = bookings[bookingIndex];
      // 2h Cancellation restriction rule
      const departure = new Date(booking.flight.departs_at).getTime();
      const now = new Date().getTime();
      if (departure - now < 2 * 60 * 60 * 1000) {
        return { data: { success: false, error: 'Cancellation not allowed within 2 hours of departure.' }, error: null };
      }

      booking.status = 'Cancelled';
      saveMockBookings(bookings);

      // Release seat
      const seats = getMockSeats();
      const seatIndex = seats.findIndex((s: any) => s.id === booking.seat_id);
      if (seatIndex !== -1) {
        seats[seatIndex].is_available = true;
        saveMockSeats(seats);
      }

      return { data: { success: true }, error: null };
    }

    if (name === 'reschedule_booking_atomic') {
      const { p_booking_id, p_new_flight_id, p_new_seat_id, p_fee_charged } = params;
      const bookings = getMockBookings();
      const bookingIndex = bookings.findIndex((b: any) => b.id === p_booking_id);
      if (bookingIndex === -1) {
        return { data: { success: false, error: 'Booking not found.' }, error: null };
      }

      const booking = bookings[bookingIndex];

      // Release old seat
      const seats = getMockSeats();
      const oldSeatIndex = seats.findIndex((s: any) => s.id === booking.seat_id);
      if (oldSeatIndex !== -1) seats[oldSeatIndex].is_available = true;

      // Occupy new seat
      const newSeatIndex = seats.findIndex((s: any) => s.id === p_new_seat_id);
      if (newSeatIndex === -1 || !seats[newSeatIndex].is_available) {
        return { data: { success: false, error: 'Selected seat is already taken.' }, error: null };
      }

      seats[newSeatIndex].is_available = false;
      saveMockSeats(seats);

      // Update booking flight details
      const flights = getMockFlights();
      const newFlight = flights.find((f: any) => f.id === p_new_flight_id);

      booking.flight_id = p_new_flight_id;
      booking.seat_id = p_new_seat_id;
      booking.flight = newFlight;
      booking.seat = seats[newSeatIndex];
      booking.total_price = Number(booking.total_price) + Number(p_fee_charged);
      booking.status = 'Rescheduled';

      saveMockBookings(bookings);
      return { data: { success: true }, error: null };
    }

    return { data: null, error: 'Method not found.' };
  }
}
