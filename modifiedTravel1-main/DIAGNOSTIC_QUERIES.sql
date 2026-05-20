-- Diagnostic queries to inspect timeline for a trip
-- Replace :trip_id with the actual trip UUID

-- 1) Combined ordered timeline (events with timestamps)
SELECT
  event_type,
  id,
  serial_number,
  event_start,
  event_end
FROM (
  SELECT 'flight' AS event_type, id, serial_number,
    (departure_date::timestamp + departure_time::interval) AS event_start,
    (arrival_date::timestamp + arrival_time::interval) AS event_end
  FROM public.trip_flights
  WHERE trip_id = :trip_id
  UNION ALL
  SELECT 'hotel' AS event_type, id, serial_number,
    (check_in_date::timestamp + check_in_time::interval) AS event_start,
    (check_out_date::timestamp + check_out_time::interval) AS event_end
  FROM public.trip_hotels
  WHERE trip_id = :trip_id
) t
ORDER BY event_start ASC;

-- 2) Show flights that arrive after a given hotel's check-in (helps detect bad hotel times)
-- Replace :hotel_id with hotel UUID
SELECT tf.id, tf.flight_number,
  (tf.arrival_date::timestamp + tf.arrival_time::interval) AS arrival_ts
FROM public.trip_flights tf
WHERE tf.trip_id = (
  SELECT trip_id FROM public.trip_hotels WHERE id = :hotel_id
)
AND (tf.arrival_date::timestamp + tf.arrival_time::interval) > (
  SELECT (check_in_date::timestamp + check_in_time::interval) FROM public.trip_hotels WHERE id = :hotel_id
)
ORDER BY arrival_ts ASC;

-- 3) Quick check: list flights and hotels with their event_start to see ordering
SELECT 'flight' as type, id, flight_number as name, (departure_date::timestamp + departure_time::interval) AS start_ts, (arrival_date::timestamp + arrival_time::interval) AS end_ts
FROM public.trip_flights WHERE trip_id = :trip_id
UNION ALL
SELECT 'hotel' as type, id, hotel_name as name, (check_in_date::timestamp + check_in_time::interval) AS start_ts, (check_out_date::timestamp + check_out_time::interval) AS end_ts
FROM public.trip_hotels WHERE trip_id = :trip_id
ORDER BY start_ts ASC;