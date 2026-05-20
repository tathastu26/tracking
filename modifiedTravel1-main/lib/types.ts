/**
 * Shared TypeScript interfaces and types for the application
 */

export type NodeType = 'flight' | 'hotel'

export interface Link {
  id: string
  trip_id: string
  from_type: NodeType
  from_id: string
  to_type: NodeType
  to_id: string
  created_at?: string
}

export interface Flight {
  id: string
  flight_number: string
  departure_airport: string
  arrival_airport: string
  departure_date: string
  departure_time: string
  arrival_date: string
  arrival_time: string
  airline_name?: string
  serial_number?: number
  is_connecting_to_next: boolean
  connection_group?: string
  seat_number?: string
  trip_id: string
}

export interface Hotel {
  id: string
  hotel_name: string
  address: string
  city: string
  country: string
  check_in_date: string
  check_in_time: string
  check_out_date: string
  check_out_time: string
  serial_number?: number
  room_number?: string
  trip_id: string
}

export interface Trip {
  id: string
  trip_name: string
  start_date: string
  end_date: string
  status: string
  description?: string
  profile_id: string
  flights?: Flight[]
  hotels?: Hotel[]
}
