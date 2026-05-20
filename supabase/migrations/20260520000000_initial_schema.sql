-- Supabase Database Schema for Flight Management PWA App

-- 1. Create tables
create table flights (
  id uuid default gen_random_uuid() primary key,
  flight_no text not null,
  origin text not null,
  destination text not null,
  departs_at timestamptz not null,
  arrives_at timestamptz not null,
  aircraft_type text not null,
  status text not null default 'Scheduled',
  base_price numeric not null
);

create table seats (
  id uuid default gen_random_uuid() primary key,
  flight_id uuid not null references flights(id) on delete cascade,
  seat_number text not null,
  class text not null check (class in ('economy', 'business', 'first')),
  is_available boolean not null default true,
  extra_fee numeric not null default 0,
  unique (flight_id, seat_number)
);

create table bookings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  flight_id uuid not null references flights(id) on delete cascade,
  seat_id uuid not null references seats(id) on delete cascade,
  status text not null default 'Confirmed' check (status in ('Confirmed', 'Cancelled', 'Rescheduled')),
  booked_at timestamptz not null default now(),
  total_price numeric not null,
  pnr_code text not null unique
);

create table passengers (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null references bookings(id) on delete cascade,
  full_name text not null,
  passport_no text not null,
  nationality text not null,
  dob date not null
);

create table reschedules (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null references bookings(id) on delete cascade,
  old_flight_id uuid not null references flights(id) on delete cascade,
  new_flight_id uuid not null references flights(id) on delete cascade,
  requested_at timestamptz not null default now(),
  fee_charged numeric not null default 0
);

-- Enable Realtime for seats table
alter publish supabase_realtime add table seats;

-- 2. Row Level Security (RLS) Policies
alter table flights enable row level security;
alter table seats enable row level security;
alter table bookings enable row level security;
alter table passengers enable row level security;
alter table reschedules enable row level security;

-- Flights & Seats policies
create policy "Flights are viewable by everyone" on flights for select using (true);
create policy "Seats are viewable by everyone" on seats for select using (true);

-- Bookings policies
create policy "Users can view their own bookings" on bookings for select using (auth.uid() = user_id);
create policy "Users can insert their own bookings" on bookings for insert with check (auth.uid() = user_id);
create policy "Users can update their own bookings" on bookings for update using (auth.uid() = user_id);

-- Passengers policies
create policy "Users can view their booking passengers" on passengers for select
  using (exists (select 1 from bookings where bookings.id = passengers.booking_id and bookings.user_id = auth.uid()));
create policy "Users can insert their booking passengers" on passengers for insert
  with check (exists (select 1 from bookings where bookings.id = passengers.booking_id and bookings.user_id = auth.uid()));
create policy "Users can update their booking passengers" on passengers for update
  using (exists (select 1 from bookings where bookings.id = passengers.booking_id and bookings.user_id = auth.uid()));

-- Reschedules policies
create policy "Users can view their reschedules" on reschedules for select
  using (exists (select 1 from bookings where bookings.id = reschedules.booking_id and bookings.user_id = auth.uid()));
create policy "Users can insert their reschedules" on reschedules for insert
  with check (exists (select 1 from bookings where bookings.id = reschedules.booking_id and bookings.user_id = auth.uid()));


-- 3. Cancellation Time Constraint Trigger (Cancellation not allowed within 2 hours of departure)
create or replace function check_cancellation_time()
returns trigger as $$
declare
  v_departs_at timestamptz;
begin
  if NEW.status = 'Cancelled' and OLD.status != 'Cancelled' then
    select departs_at into v_departs_at from flights where id = OLD.flight_id;
    if v_departs_at < (now() + interval '2 hours') then
      raise exception 'Cancellation is not allowed within 2 hours of departure';
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_check_cancellation_time
before update on bookings
for each row
execute function check_cancellation_time();


-- 4. Atomic seat booking RPC (prevents race conditions)
create or replace function book_flight_atomic(
  p_flight_id uuid,
  p_seat_id uuid,
  p_full_name text,
  p_passport_no text,
  p_nationality text,
  p_dob date,
  p_total_price numeric,
  p_pnr_code text
)
returns json as $$
declare
  v_seat_available boolean;
  v_booking_id uuid;
  v_user_id uuid;
begin
  -- Get auth user ID
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock the seat row for updates to prevent race conditions
  select is_available into v_seat_available
  from seats
  where id = p_seat_id and flight_id = p_flight_id
  for update;

  if v_seat_available is null then
    raise exception 'Seat does not exist';
  end if;

  if not v_seat_available then
    raise exception 'Seat is already occupied';
  end if;

  -- Reserve the seat
  update seats
  set is_available = false
  where id = p_seat_id;

  -- Create booking
  insert into bookings (user_id, flight_id, seat_id, status, booked_at, total_price, pnr_code)
  values (v_user_id, p_flight_id, p_seat_id, 'Confirmed', now(), p_total_price, p_pnr_code)
  returning id into v_booking_id;

  -- Insert passenger details
  insert into passengers (booking_id, full_name, passport_no, nationality, dob)
  values (v_booking_id, p_full_name, p_passport_no, p_nationality, p_dob);

  return json_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'pnr_code', p_pnr_code
  );
exception
  when others then
    return json_build_object(
      'success', false,
      'error', SQLERRM
    );
end;
$$ language plpgsql security definer;


-- 5. Atomic Cancellation RPC
create or replace function cancel_booking_atomic(
  p_booking_id uuid
)
returns json as $$
declare
  v_user_id uuid;
  v_seat_id uuid;
  v_booking_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock booking row
  select user_id, seat_id into v_booking_user_id, v_seat_id
  from bookings
  where id = p_booking_id
  for update;

  if v_booking_user_id is null then
    raise exception 'Booking not found';
  end if;

  -- Verify ownership
  if v_booking_user_id != v_user_id then
    raise exception 'Unauthorized to cancel this booking';
  end if;

  -- Update booking (will run cancellation time check trigger)
  update bookings
  set status = 'Cancelled'
  where id = p_booking_id;

  -- Free the seat
  update seats
  set is_available = true
  where id = v_seat_id;

  return json_build_object(
    'success', true,
    'booking_id', p_booking_id
  );
exception
  when others then
    return json_build_object(
      'success', false,
      'error', SQLERRM
    );
end;
$$ language plpgsql security definer;


-- 6. Atomic Rescheduling RPC
create or replace function reschedule_booking_atomic(
  p_booking_id uuid,
  p_new_flight_id uuid,
  p_new_seat_id uuid,
  p_fee_charged numeric
)
returns json as $$
declare
  v_user_id uuid;
  v_old_flight_id uuid;
  v_old_seat_id uuid;
  v_booking_user_id uuid;
  v_new_seat_available boolean;
  v_old_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock booking row
  select user_id, flight_id, seat_id, status into v_booking_user_id, v_old_flight_id, v_old_seat_id, v_old_status
  from bookings
  where id = p_booking_id
  for update;

  if v_booking_user_id is null then
    raise exception 'Booking not found';
  end if;

  -- Verify ownership
  if v_booking_user_id != v_user_id then
    raise exception 'Unauthorized to reschedule this booking';
  end if;

  if v_old_status = 'Cancelled' then
    raise exception 'Cannot reschedule a cancelled booking';
  end if;

  -- Lock and check new seat availability
  select is_available into v_new_seat_available
  from seats
  where id = p_new_seat_id and flight_id = p_new_flight_id
  for update;

  if v_new_seat_available is null then
    raise exception 'New seat does not exist';
  end if;

  if not v_new_seat_available then
    raise exception 'New seat is already occupied';
  end if;

  -- Free old seat
  update seats
  set is_available = true
  where id = v_old_seat_id;

  -- Reserve new seat
  update seats
  set is_available = false
  where id = p_new_seat_id;

  -- Update booking with new flight, seat, status and add fee to total price
  update bookings
  set flight_id = p_new_flight_id,
      seat_id = p_new_seat_id,
      status = 'Rescheduled',
      total_price = total_price + p_fee_charged
  where id = p_booking_id;

  -- Record reschedule history
  insert into reschedules (booking_id, old_flight_id, new_flight_id, requested_at, fee_charged)
  values (p_booking_id, v_old_flight_id, p_new_flight_id, now(), p_fee_charged);

  return json_build_object(
    'success', true,
    'booking_id', p_booking_id
  );
exception
  when others then
    return json_build_object(
      'success', false,
      'error', SQLERRM
    );
end;
$$ language plpgsql security definer;


-- 7. Seed flights
insert into flights (id, flight_no, origin, destination, departs_at, arrives_at, aircraft_type, status, base_price) values
('f1000000-0000-0000-0000-000000000001', 'AA-101', 'JFK', 'LAX', '2026-06-01 08:00:00+00', '2026-06-01 11:30:00+00', 'Boeing 777', 'Scheduled', 250.00),
('f1000000-0000-0000-0000-000000000002', 'AA-102', 'JFK', 'LAX', '2026-06-02 16:00:00+00', '2026-06-02 19:30:00+00', 'Boeing 777', 'Scheduled', 270.00),
('f2000000-0000-0000-0000-000000000001', 'BA-201', 'LHR', 'CDG', '2026-06-01 09:00:00+00', '2026-06-01 11:15:00+00', 'Airbus A320', 'Scheduled', 120.00),
('f2000000-0000-0000-0000-000000000002', 'BA-202', 'LHR', 'CDG', '2026-06-02 18:00:00+00', '2026-06-02 20:15:00+00', 'Airbus A320', 'Scheduled', 130.00),
('f3000000-0000-0000-0000-000000000001', 'SQ-301', 'HND', 'SIN', '2026-06-01 11:00:00+00', '2026-06-01 17:00:00+00', 'Boeing 787', 'Scheduled', 450.00),
('f3000000-0000-0000-0000-000000000002', 'SQ-302', 'HND', 'SIN', '2026-06-03 01:00:00+00', '2026-06-03 07:00:00+00', 'Boeing 787', 'Scheduled', 480.00),
('f4000000-0000-0000-0000-000000000001', 'EK-401', 'DXB', 'SYD', '2026-06-01 22:00:00+00', '2026-06-02 18:00:00+00', 'Airbus A380', 'Scheduled', 850.00),
('f4000000-0000-0000-0000-000000000002', 'EK-402', 'DXB', 'SYD', '2026-06-03 09:00:00+00', '2026-06-04 05:00:00+00', 'Airbus A380', 'Scheduled', 900.00);

-- 8. Seed seats (30 seats per flight: 6 First Class, 12 Business Class, 12 Economy Class)
do $$
declare
  r record;
  seat_letters text[] := array['A', 'B', 'C', 'D', 'E', 'F'];
  class_name text;
  fee numeric;
  row_num int;
  letter text;
begin
  for r in select id from flights loop
    -- First Class (Row 1)
    class_name := 'first';
    fee := 150.00;
    row_num := 1;
    foreach letter in array seat_letters loop
      insert into seats (flight_id, seat_number, class, is_available, extra_fee)
      values (r.id, row_num || letter, class_name, true, fee);
    end loop;

    -- Business Class (Rows 2-3)
    class_name := 'business';
    fee := 75.00;
    for row_num in 2..3 loop
      foreach letter in array seat_letters loop
        insert into seats (flight_id, seat_number, class, is_available, extra_fee)
        values (r.id, row_num || letter, class_name, true, fee);
      end loop;
    end loop;

    -- Economy Class (Rows 4-5)
    class_name := 'economy';
    fee := 0.00;
    for row_num in 4..5 loop
      foreach letter in array seat_letters loop
        insert into seats (flight_id, seat_number, class, is_available, extra_fee)
        values (r.id, row_num || letter, class_name, true, fee);
      end loop;
    end loop;
  end loop;
end;
$$;

-- 9. Seed a test user account for Supabase Auth
-- Email: test@gmail.com
-- Password: password123
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'test@gmail.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Test User"}',
  false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  coalesce(concat('{"sub":"', 'd0000000-0000-0000-0000-000000000001', '","email":"', 'test@gmail.com', '"}')::jsonb, '{}'::jsonb),
  'email',
  now(),
  now(),
  now()
) ON CONFLICT (id, provider) DO NOTHING;

