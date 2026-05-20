-- ============================================================================
-- NEW TABLES FOR TRIP MANAGEMENT
-- ============================================================================

-- ============================================================================
-- 1. CREATE TRIPS TABLE (linked to profiles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trip_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'ongoing', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 2. CREATE TRIP_FLIGHTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trip_flights (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    flight_number TEXT NOT NULL,
    departure_date DATE NOT NULL,
    departure_time TIME NOT NULL,
    arrival_date DATE NOT NULL,
    arrival_time TIME NOT NULL,
    departure_airport TEXT NOT NULL,
    arrival_airport TEXT NOT NULL,
    airline_name TEXT,
    seat_number TEXT,
    booking_reference TEXT,
    serial_number INTEGER,
    is_connecting_to_next BOOLEAN DEFAULT FALSE,
    connection_group TEXT DEFAULT 'standalone',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 3. CREATE TRIP_HOTELS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trip_hotels (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    hotel_name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT,
    country TEXT,
    check_in_date DATE NOT NULL,
    check_in_time TIME DEFAULT '14:00:00',
    check_out_date DATE NOT NULL,
    check_out_time TIME DEFAULT '11:00:00',
    room_number TEXT,
    booking_reference TEXT,
    serial_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 4. CREATE BOOKINGS TABLE (for unified booking tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    booking_type TEXT NOT NULL CHECK (booking_type IN ('flight', 'hotel')),
    flight_id UUID REFERENCES public.trip_flights(id) ON DELETE CASCADE,
    hotel_id UUID REFERENCES public.trip_hotels(id) ON DELETE CASCADE,
    booking_status TEXT DEFAULT 'confirmed' CHECK (booking_status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    cost DECIMAL(10, 2),
    currency TEXT DEFAULT 'USD',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT flight_or_hotel CHECK (
        (booking_type = 'flight' AND flight_id IS NOT NULL AND hotel_id IS NULL) OR
        (booking_type = 'hotel' AND hotel_id IS NOT NULL AND flight_id IS NULL)
    )
);

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_flights DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_hotels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES FOR TRIPS
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can update their own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can insert their own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can delete their own trips" ON public.trips;

CREATE POLICY "Users can view their own trips"
    ON public.trips FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can update their own trips"
    ON public.trips FOR UPDATE
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own trips"
    ON public.trips FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own trips"
    ON public.trips FOR DELETE
    USING (auth.uid() = profile_id);

-- ============================================================================
-- 7. RLS POLICIES FOR TRIP_FLIGHTS
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their trip flights" ON public.trip_flights;
DROP POLICY IF EXISTS "Users can update their trip flights" ON public.trip_flights;
DROP POLICY IF EXISTS "Users can insert trip flights" ON public.trip_flights;
DROP POLICY IF EXISTS "Users can delete trip flights" ON public.trip_flights;

CREATE POLICY "Users can view their trip flights"
    ON public.trip_flights FOR SELECT
    USING (trip_id IN (
        SELECT id FROM public.trips WHERE profile_id = auth.uid()
    ));

CREATE POLICY "Users can update their trip flights"
    ON public.trip_flights FOR UPDATE
    USING (trip_id IN (SELECT id FROM public.trips WHERE profile_id = auth.uid()))
    WITH CHECK (trip_id IN (SELECT id FROM public.trips WHERE profile_id = auth.uid()));

CREATE POLICY "Users can insert trip flights"
    ON public.trip_flights FOR INSERT
    WITH CHECK (trip_id IN (SELECT id FROM public.trips WHERE profile_id = auth.uid()));

CREATE POLICY "Users can delete trip flights"
    ON public.trip_flights FOR DELETE
    USING (trip_id IN (SELECT id FROM public.trips WHERE profile_id = auth.uid()));

-- ============================================================================
-- 8. RLS POLICIES FOR TRIP_HOTELS
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their trip hotels" ON public.trip_hotels;
DROP POLICY IF EXISTS "Users can update their trip hotels" ON public.trip_hotels;
DROP POLICY IF EXISTS "Users can insert trip hotels" ON public.trip_hotels;
DROP POLICY IF EXISTS "Users can delete trip hotels" ON public.trip_hotels;

CREATE POLICY "Users can view their trip hotels"
    ON public.trip_hotels FOR SELECT
    USING (trip_id IN (
        SELECT id FROM public.trips WHERE profile_id = auth.uid()
    ));

CREATE POLICY "Users can update their trip hotels"
    ON public.trip_hotels FOR UPDATE
    USING (trip_id IN (SELECT id FROM public.trips WHERE profile_id = auth.uid()))
    WITH CHECK (trip_id IN (SELECT id FROM public.trips WHERE profile_id = auth.uid()));

CREATE POLICY "Users can insert trip hotels"
    ON public.trip_hotels FOR INSERT
    WITH CHECK (trip_id IN (SELECT id FROM public.trips WHERE profile_id = auth.uid()));

CREATE POLICY "Users can delete trip hotels"
    ON public.trip_hotels FOR DELETE
    USING (trip_id IN (SELECT id FROM public.trips WHERE profile_id = auth.uid()));

-- ============================================================================
-- 9. RLS POLICIES FOR BOOKINGS
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can delete bookings" ON public.bookings;

CREATE POLICY "Users can view their bookings"
    ON public.bookings FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can update their bookings"
    ON public.bookings FOR UPDATE
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can insert bookings"
    ON public.bookings FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete bookings"
    ON public.bookings FOR DELETE
    USING (auth.uid() = profile_id);

-- ============================================================================
-- 10. INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_trips_profile_id ON public.trips(profile_id);
CREATE INDEX IF NOT EXISTS idx_trips_start_date ON public.trips(start_date);
CREATE INDEX IF NOT EXISTS idx_trip_flights_trip_id ON public.trip_flights(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_flights_departure_date ON public.trip_flights(departure_date);
CREATE INDEX IF NOT EXISTS idx_trip_hotels_trip_id ON public.trip_hotels(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_hotels_check_in_date ON public.trip_hotels(check_in_date);
CREATE INDEX IF NOT EXISTS idx_bookings_profile_id ON public.bookings(profile_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON public.bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_flight_id ON public.bookings(flight_id);
CREATE INDEX IF NOT EXISTS idx_bookings_hotel_id ON public.bookings(hotel_id);

-- ============================================================================
-- 11b. CREATE TABLE FOR EVENT LINKS (wire connections between events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trip_event_links (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    from_type TEXT NOT NULL CHECK (from_type IN ('flight','hotel')),
    from_id UUID NOT NULL,
    to_type TEXT NOT NULL CHECK (to_type IN ('flight','hotel')),
    to_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for links
ALTER TABLE public.trip_event_links DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage event links" ON public.trip_event_links;
CREATE POLICY "Users can manage event links"
    ON public.trip_event_links FOR ALL
    USING (trip_id IN (SELECT id FROM public.trips WHERE profile_id = auth.uid()))
    WITH CHECK (trip_id IN (SELECT id FROM public.trips WHERE profile_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_trip_event_links_trip_id ON public.trip_event_links(trip_id);

CREATE OR REPLACE FUNCTION public.validate_trip_event_link()
RETURNS trigger AS $$
BEGIN
    IF NEW.from_type = NEW.to_type AND NEW.from_id = NEW.to_id THEN
        RAISE EXCEPTION 'Cannot link a node to itself';
    END IF;

    IF NEW.from_type = 'flight' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.trip_flights
            WHERE id = NEW.from_id AND trip_id = NEW.trip_id
        ) THEN
            RAISE EXCEPTION 'from_id % is not a valid flight for trip %', NEW.from_id, NEW.trip_id;
        END IF;
    ELSIF NEW.from_type = 'hotel' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.trip_hotels
            WHERE id = NEW.from_id AND trip_id = NEW.trip_id
        ) THEN
            RAISE EXCEPTION 'from_id % is not a valid hotel for trip %', NEW.from_id, NEW.trip_id;
        END IF;
    END IF;

    IF NEW.to_type = 'flight' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.trip_flights
            WHERE id = NEW.to_id AND trip_id = NEW.trip_id
        ) THEN
            RAISE EXCEPTION 'to_id % is not a valid flight for trip %', NEW.to_id, NEW.trip_id;
        END IF;
    ELSIF NEW.to_type = 'hotel' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.trip_hotels
            WHERE id = NEW.to_id AND trip_id = NEW.trip_id
        ) THEN
            RAISE EXCEPTION 'to_id % is not a valid hotel for trip %', NEW.to_id, NEW.trip_id;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.trip_event_links
        WHERE trip_id = NEW.trip_id
          AND from_type = NEW.from_type
          AND from_id = NEW.from_id
          AND to_type = NEW.to_type
          AND to_id = NEW.to_id
          AND (TG_OP = 'INSERT' OR id <> NEW.id)
    ) THEN
        RAISE EXCEPTION 'Duplicate link';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.trip_event_links
        WHERE trip_id = NEW.trip_id
          AND from_type = NEW.to_type
          AND from_id = NEW.to_id
          AND to_type = NEW.from_type
          AND to_id = NEW.from_id
          AND (TG_OP = 'INSERT' OR id <> NEW.id)
    ) THEN
        RAISE EXCEPTION 'Duplicate reverse link';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_trip_event_link ON public.trip_event_links;
CREATE TRIGGER trigger_validate_trip_event_link
BEFORE INSERT OR UPDATE ON public.trip_event_links
FOR EACH ROW
EXECUTE FUNCTION public.validate_trip_event_link();

-- ============================================================================
-- 11. FUNCTION TO CALCULATE SERIAL NUMBERS & DETECT CONNECTING FLIGHTS
-- ============================================================================
-- NOTE: connection_group field allows manual override of auto-detection
-- If set to 'standalone' (default), uses auto-detection logic
-- If set to custom group name, flights with same group are marked as connected
CREATE OR REPLACE FUNCTION public.update_trip_serial_numbers(p_trip_id UUID)
RETURNS void AS $$
DECLARE
    v_next_event_type TEXT;
    v_is_connecting BOOLEAN;
    v_serial INT := 1;
    v_rec RECORD;
    v_next_flight_group TEXT;
BEGIN
    -- Reset serial numbers
    UPDATE public.trip_flights SET serial_number = NULL WHERE trip_id = p_trip_id;
    UPDATE public.trip_hotels SET serial_number = NULL WHERE trip_id = p_trip_id;
    UPDATE public.trip_flights SET is_connecting_to_next = FALSE WHERE trip_id = p_trip_id;

    -- Create combined timeline of flights and hotels ordered by date/time
    FOR v_rec IN
        SELECT 
            'flight' AS event_type,
            id,
            (departure_date::timestamp + departure_time::interval) AS event_start,
            (arrival_date::timestamp + arrival_time::interval) AS event_end,
            connection_group,
            NULL::UUID AS hotel_id_ref
        FROM public.trip_flights
        WHERE trip_id = p_trip_id
        UNION ALL
        SELECT 
            'hotel' AS event_type,
            id,
            (check_in_date::timestamp + check_in_time::interval) AS event_start,
            (check_out_date::timestamp + check_out_time::interval) AS event_end,
            NULL::TEXT as connection_group,
            id
        FROM public.trip_hotels
        WHERE trip_id = p_trip_id
        ORDER BY event_start ASC
    LOOP
        -- Initialize for this iteration
        v_is_connecting := FALSE;
        v_next_event_type := NULL;
        v_next_flight_group := NULL;
        
        -- Update serial number
        IF v_rec.event_type = 'flight' THEN
            UPDATE public.trip_flights 
            SET serial_number = v_serial 
            WHERE id = v_rec.id;
            
            -- Check for manual grouping first
            -- If this flight has a custom connection_group (not 'standalone'),
            -- check if next flight is in same group
            IF v_rec.connection_group IS NOT NULL AND v_rec.connection_group != 'standalone' THEN
                SELECT connection_group INTO v_next_flight_group
                FROM public.trip_flights
                WHERE trip_id = p_trip_id 
                  AND (departure_date::timestamp + departure_time::interval) > v_rec.event_end
                ORDER BY (departure_date::timestamp + departure_time::interval) ASC
                LIMIT 1;
                
                -- Mark as connecting if next flight is in same manual group
                IF v_next_flight_group = v_rec.connection_group THEN
                    v_is_connecting := TRUE;
                END IF;
            ELSE
                -- Auto-detect: A flight is connecting if next event is another flight with no hotel
                SELECT event_type INTO v_next_event_type
                FROM (
                    SELECT 
                        'flight' AS event_type,
                        (departure_date::timestamp + departure_time::interval) AS event_start
                    FROM public.trip_flights
                    WHERE trip_id = p_trip_id 
                      AND (departure_date::timestamp + departure_time::interval) > v_rec.event_end
                    UNION ALL
                    SELECT 
                        'hotel' AS event_type,
                        (check_in_date::timestamp + check_in_time::interval) AS event_start
                    FROM public.trip_hotels
                    WHERE trip_id = p_trip_id 
                      AND (check_in_date::timestamp + check_in_time::interval) > v_rec.event_end
                    ORDER BY event_start ASC
                    LIMIT 1
                ) next_events;
                
                IF v_next_event_type = 'flight' THEN
                    v_is_connecting := TRUE;
                END IF;
            END IF;
            
            UPDATE public.trip_flights 
            SET is_connecting_to_next = v_is_connecting 
            WHERE id = v_rec.id;
        ELSE
            UPDATE public.trip_hotels 
            SET serial_number = v_serial 
            WHERE id = v_rec.id;
        END IF;
        
        v_serial := v_serial + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 12. TRIGGER TO AUTO-UPDATE SERIAL NUMBERS ON INSERT/DELETE ONLY
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_update_serial_numbers()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.update_trip_serial_numbers(OLD.trip_id);
    ELSE
        PERFORM public.update_trip_serial_numbers(NEW.trip_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_flights_serial ON public.trip_flights;
CREATE TRIGGER trigger_flights_serial
AFTER INSERT OR DELETE ON public.trip_flights
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_serial_numbers();

DROP TRIGGER IF EXISTS trigger_hotels_serial ON public.trip_hotels;
CREATE TRIGGER trigger_hotels_serial
AFTER INSERT OR DELETE ON public.trip_hotels
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_serial_numbers();

-- ============================================================================
-- 13. VIEW FOR COMPLETE TRIP ITINERARY (chronological order)
-- ============================================================================
CREATE OR REPLACE VIEW public.trip_itinerary AS
WITH timeline AS (
    SELECT 
        t.id AS trip_id,
        t.trip_name,
        t.profile_id,
        'flight' AS event_type,
        tf.id::text AS event_id,
        tf.serial_number,
        tf.flight_number,
        tf.departure_airport,
        tf.arrival_airport,
        (tf.departure_date::timestamp + tf.departure_time::interval) AS event_start,
        (tf.arrival_date::timestamp + tf.arrival_time::interval) AS event_end,
        jsonb_build_object(
            'flight_number', tf.flight_number,
            'departure_airport', tf.departure_airport,
            'arrival_airport', tf.arrival_airport,
            'departure_date', tf.departure_date,
            'departure_time', tf.departure_time,
            'arrival_date', tf.arrival_date,
            'arrival_time', tf.arrival_time,
            'airline', tf.airline_name,
            'seat', tf.seat_number,
            'is_connecting', tf.is_connecting_to_next
        ) AS event_details
    FROM public.trips t
    INNER JOIN public.trip_flights tf ON t.id = tf.trip_id
    
    UNION ALL
    
    SELECT 
        t.id AS trip_id,
        t.trip_name,
        t.profile_id,
        'hotel' AS event_type,
        th.id::text AS event_id,
        th.serial_number,
        th.hotel_name,
        th.city,
        th.country,
        (th.check_in_date::timestamp + th.check_in_time::interval) AS event_start,
        (th.check_out_date::timestamp + th.check_out_time::interval) AS event_end,
        jsonb_build_object(
            'hotel_name', th.hotel_name,
            'address', th.address,
            'city', th.city,
            'country', th.country,
            'check_in_date', th.check_in_date,
            'check_in_time', th.check_in_time,
            'check_out_date', th.check_out_date,
            'check_out_time', th.check_out_time,
            'room_number', th.room_number
        ) AS event_details
    FROM public.trips t
    INNER JOIN public.trip_hotels th ON t.id = th.trip_id
)
SELECT 
    trip_id,
    trip_name,
    profile_id,
    row_number() OVER (PARTITION BY trip_id ORDER BY event_start) AS seq,
    event_type,
    event_id,
    serial_number,
    flight_number,
    departure_airport,
    arrival_airport,
    event_start::date AS event_date,
    event_start,
    event_end,
    event_details
FROM timeline
ORDER BY trip_id, event_start;

-- ============================================================================
-- 14. VIEW FOR CONNECTING FLIGHTS ANALYSIS
-- ============================================================================
CREATE OR REPLACE VIEW public.connecting_flights_analysis AS
SELECT 
    tf.trip_id,
    tf.id AS flight_id,
    tf.serial_number,
    tf.flight_number,
    tf.departure_airport,
    tf.arrival_airport,
    tf.departure_date,
    tf.departure_time,
    tf.arrival_date,
    tf.arrival_time,
    tf.is_connecting_to_next,
    CASE 
        WHEN tf.is_connecting_to_next THEN 'Connecting'
        ELSE 'Non-Connecting (Hotel or Final Flight)'
    END AS connection_status,
    (
        SELECT th.hotel_name 
        FROM public.trip_hotels th
        WHERE th.trip_id = tf.trip_id
        AND (th.check_in_date::timestamp + th.check_in_time::interval) >= (tf.arrival_date::timestamp + tf.arrival_time::interval)
        ORDER BY th.check_in_date ASC
        LIMIT 1
    ) AS next_hotel_if_non_connecting
FROM public.trip_flights tf;

-- ============================================================================
-- END OF TRIP MANAGEMENT SETUP
-- ============================================================================
