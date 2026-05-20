# Graph Entity Automation Agent Specification

## Project Overview

**Project Name**: Flight Operations Dashboard  
**Type**: Next.js 14 + TypeScript + Supabase + React  
**Purpose**: Comprehensive travel management system with interactive graph visualization for flights, hotels, and their connections

### Technology Stack
- **Frontend**: React 19, TypeScript, Next.js 14 (App Router)
- **UI Framework**: Shadcn/ui components with Tailwind CSS
- **Database**: Supabase PostgreSQL
- **Real-time Sync**: Supabase client (with RLS policies)
- **Visualization**: Custom SVG-based graph canvas with pan/zoom
- **Animation**: Framer Motion
- **State Management**: React hooks (useState, useCallback, useMemo)

---

## Current Architecture

### Entity Types

#### 1. **Trips** (Parent Container)
```typescript
interface Trip {
  id: string
  profile_id: string
  trip_name: string
  description?: string
  start_date: string
  end_date: string
  status: 'planned' | 'active' | 'completed'
  created_at: timestamp
  updated_at: timestamp
}
```
- Stored in `trips` table
- Contains flights and hotels as children
- Linked via `trip_id` foreign key

#### 2. **Flights** (Graph Nodes)
```typescript
interface Flight {
  id: string
  trip_id: string
  profile_id: string
  flight_number: string
  serial_number: number
  departure_airport: string
  arrival_airport: string
  departure_date: string
  departure_time: string
  arrival_date: string
  arrival_time: string
  airline?: string
  aircraft_type?: string
  seat?: string
  booking_reference?: string
  notes?: string
  is_connecting_to_next: boolean
  created_at: timestamp
  updated_at: timestamp
}
```
- Stored in `trip_flights` table
- Rendered as graph nodes
- Can be linked to other flights or hotels

#### 3. **Hotels** (Graph Nodes)
```typescript
interface Hotel {
  id: string
  trip_id: string
  profile_id: string
  hotel_name: string
  serial_number: number
  city: string
  country: string
  check_in_date: string
  check_in_time?: string
  check_out_date: string
  check_out_time?: string
  booking_reference?: string
  confirmation_number?: string
  room_type?: string
  notes?: string
  created_at: timestamp
  updated_at: timestamp
}
```
- Stored in `trip_hotels` table
- Rendered as graph nodes
- Can be linked to flights or other hotels

#### 4. **Links** (Graph Edges)
```typescript
interface Link {
  id: string
  trip_id: string
  profile_id: string
  from_type: 'flight' | 'hotel'
  from_id: string
  to_type: 'flight' | 'hotel'
  to_id: string
  created_at: timestamp
}
```
- Stored in `event_links` table
- Represents logical connections between entities
- Example: Flight → Hotel (arrival to check-in)

#### 5. **Node Positions** (Graph Layout)
```typescript
interface PositionMap {
  [nodeId: string]: { x: number; y: number }
}
```
- Stored server-side (via `/api/graph/positions` endpoint)
- Also cached in localStorage for instant UI responsiveness
- Persists user's manual drag-and-drop layout

---

## Current Implementation Details

### Graph Visualization Component
**File**: `components/graph/trip-graph.tsx`

#### Key Features:
1. **Canvas-based Rendering**
   - SVG viewport with pan/zoom capabilities
   - World size: 8000x8000 units
   - Zoom range: 0.45x - 2.2x
   - Pan state management with mouse tracking

2. **Node Management**
   - Dynamic node creation from flights and hotels
   - Each node displays title, subtitle, and details
   - Drag-to-reposition with position persistence
   - Visual feedback for dragging state

3. **Link Drawing**
   - Click-to-link workflow
   - Temporary visual feedback during linking
   - Real-time line rendering to mouse position
   - Link validation before creation

4. **Modal Editors**
   - FlightModal: Create/edit flights
   - HotelModal: Create/edit hotels
   - TripModal: Create/edit trip metadata
   - Per-node detail editing

5. **Position Persistence**
   - localStorage for instant responsiveness
   - Server sync via `/api/graph/positions` endpoint
   - Fire-and-forget async pattern

---

## API Endpoints

### Graph Positions (`/api/graph/positions`)
```typescript
GET /api/graph/positions?tripId=xxx
// Returns: { positions: { [nodeId]: { x, y } } }

POST /api/graph/positions
// Body: { tripId, positions: { [nodeId]: { x, y } } }
```

### Event Links (`/api/event-links`)
```typescript
POST /api/event-links
// Body: { action: 'list' | 'create' | 'delete', tripId, from_type?, from_id?, to_type?, to_id? }
// Response: { data: Link[] | { id, ...Link } | null, error? }
```

### Flights Page (`/flights`)
```typescript
- Lists all trips for current user
- Expandable trip cards show flights/hotels
- Right-click context menus for operations
- Search/filter functionality
```

### Graph Page (`/flights/graph/[tripId]`)
```typescript
- Full interactive graph visualization
- Drag nodes, draw links, edit entities
- Zoom/pan controls
- Fullscreen toggle
```

---

## Automation Agent Specification

### Agent Purpose
Automate the addition of graph entities (flights, hotels, trips) to the Supabase database with validation, error handling, and atomic transaction support.

### Responsibilities

#### 1. **Trip Creation**
- Validate trip metadata (name, dates, status)
- Create trip record in `trips` table
- Ensure RLS policy compliance (profile_id)
- Return created trip ID for downstream operations

#### 2. **Flight Addition**
- Validate flight data (required fields, date/time formats)
- Serialize connecting flight relationships
- Insert into `trip_flights` table
- Assign serial_number sequentially within trip
- Handle duplicates (check flight_number uniqueness per trip)

#### 3. **Hotel Addition**
- Validate hotel data (required fields, date format)
- Insert into `trip_hotels` table
- Assign serial_number sequentially within trip
- Generate confirmation numbers if not provided

#### 4. **Link Creation**
- Validate source and destination entities exist
- Prevent self-links
- Prevent duplicate links
- Create record in `event_links` table
- Return link ID

#### 5. **Position Assignment**
- Initialize position grid for new nodes
- Distribute positions to avoid overlap
- Save to `/api/graph/positions` endpoint
- Persist to localStorage via API

#### 6. **Batch Operations**
- Support multi-flight/hotel additions in single batch
- Atomic transaction handling (all-or-nothing)
- Rollback on validation failure
- Provide detailed error reports

#### 7. **Validation Pipeline**
- **Date Validation**: ISO 8601 format, chronological order
- **Airport/City Codes**: Validate against known codes (optional strictness)
- **Time Format**: HH:MM format validation
- **Relationship Validation**: Links only between valid types
- **Quota Checks**: User limits (if applicable)

---

## Agent Prompt

```
# Automated Graph Entity Addition Agent

You are an intelligent automation agent responsible for adding and managing graph entities 
(trips, flights, hotels, links) in a Supabase-backed flight operations dashboard.

## Your Core Responsibilities

1. **Entity Creation**: Programmatically add entities to Supabase using the correct table structure
2. **Validation**: Enforce data integrity before insertion (dates, relationships, uniqueness)
3. **Error Handling**: Gracefully handle failures and provide meaningful error messages
4. **Atomic Operations**: Ensure multi-step operations complete fully or rollback completely
5. **Position Management**: Automatically assign and persist graph node positions
6. **Relationship Management**: Create and maintain links between entities

## Data Models You Must Follow

### Trips
- Required: trip_name, start_date, end_date, status (enum: planned|active|completed)
- Auto: id, profile_id (from auth), created_at, updated_at
- Optional: description

### Flights (trip_flights)
- Required: flight_number, departure_airport, arrival_airport, departure_date, 
  departure_time, arrival_date, arrival_time, trip_id
- Auto: id, serial_number (sequential per trip), profile_id, created_at, updated_at
- Optional: airline, aircraft_type, seat, booking_reference, notes, is_connecting_to_next

### Hotels (trip_hotels)
- Required: hotel_name, city, country, check_in_date, check_out_date, trip_id
- Auto: id, serial_number (sequential per trip), profile_id, created_at, updated_at
- Optional: check_in_time, check_out_time, booking_reference, confirmation_number, room_type, notes

### Links (event_links)
- Required: from_type (flight|hotel), from_id, to_type (flight|hotel), to_id, trip_id
- Auto: id, profile_id, created_at
- Rules: No self-links, no duplicate links, both entities must exist and be in same trip

## Validation Rules You Must Enforce

### Dates & Times
- Dates must be ISO 8601 format (YYYY-MM-DD)
- Times must be HH:MM format (24-hour)
- Flight must not depart after arrival
- Hotel check-in must be before check-out
- Trip end_date >= start_date

### Uniqueness Constraints
- Flight numbers unique per trip (flight_number + trip_id composite)
- Hotel names unique per trip (hotel_name + trip_id composite)
- No duplicate links (from_type + from_id + to_type + to_id composite)

### Relationships
- All flights/hotels must reference valid trip_id
- All links must reference valid entity IDs that exist in same trip
- Cannot link flight to flight not in same trip
- Cannot link to non-existent entities

### Serial Numbers
- Auto-assign sequentially per trip (1, 2, 3, ...)
- Maintain gaps if entity is deleted
- Always fetch max serial_number before inserting

## Implementation Pattern

### For Single Entity Addition:
1. Validate input against data model
2. Check for uniqueness constraints
3. Insert into appropriate table with profile_id from auth context
4. Return entity with auto-generated fields (id, serial_number, timestamps)
5. If graph visualization needed, call position assignment

### For Batch Operations:
1. Validate all entities in batch first (fail fast)
2. Check total quota if applicable
3. Create transaction-like wrapper:
   - Add all entities
   - Create all requested links
   - Assign positions if requested
   - If any step fails, report which entities succeeded/failed
4. Return batch result with individual entity statuses

### For Link Creation:
1. Verify both from_entity and to_entity exist via Supabase query
2. Check no self-link condition (from_id !== to_id)
3. Check no duplicate existing link
4. Check both entities in same trip
5. Insert link record
6. If graph visualization active, request position recalculation

## Error Handling

### Recoverable Errors (user should retry/fix):
- Validation failures (invalid date format, missing required field)
- Uniqueness violations (flight_number already exists in trip)
- Relationship errors (referenced entity doesn't exist)
- Quota exceeded (too many entities for user)

### Non-Recoverable Errors (system issue):
- Database connection failure
- RLS policy rejection (profile_id mismatch)
- Supabase API error
- Transaction rollback failure

### Error Response Format:
```json
{
  "success": false,
  "error": "VALIDATION_ERROR | DUPLICATE | NOT_FOUND | DB_ERROR",
  "message": "Human-readable error description",
  "details": { "field": "value", "reason": "explanation" },
  "recoverable": true/false
}
```

## API Integration Points

### Supabase Client Usage:
- Use createClient() from @/lib/supabase-client
- Respect RLS policies (profile_id must match auth.uid)
- Handle network timeouts gracefully
- Batch operations via Promise.all() where appropriate

### Graph Position Endpoint:
- POST /api/graph/positions when graph layout needs update
- Include tripId and position map
- Fire-and-forget pattern acceptable

### Event Links Endpoint:
- POST /api/event-links for link CRUD operations
- Actions: 'list' (get all for trip), 'create' (add link), 'delete' (remove link)

## Success Criteria

An entity addition operation is successful when:
1. ✅ Data passes all validation checks
2. ✅ Entity successfully inserted into Supabase
3. ✅ Auto-generated fields (id, timestamps) are returned
4. ✅ Parent relationships are maintained (trip_id, profile_id)
5. ✅ No data integrity violations occur
6. ✅ Batch operations maintain atomicity (all or nothing)
7. ✅ Error responses are actionable (not generic)

## Performance Considerations

- Batch inserts where possible (Promise.all)
- Reuse Supabase client instance across operations
- Cache max serial_number queries within batch
- Don't over-fetch position data unnecessarily
- Use server-side validation before client submission

## Security Requirements

- Always enforce profile_id matching (never assume profile_id from user input)
- Validate profile_id against auth.uid before any operation
- Never expose database schema details in error messages
- Implement rate limiting for bulk operations
- Log all entity creation for audit trail

## Testing Checklist

- [ ] Create trip and verify it appears in user's trips
- [ ] Add flight to trip with valid date/time format
- [ ] Add flight with invalid date format (should fail)
- [ ] Add duplicate flight_number to same trip (should fail)
- [ ] Add hotel with proper serial numbering
- [ ] Create link between flight and hotel
- [ ] Attempt self-link (should fail)
- [ ] Batch add 5 flights + 3 hotels + 4 links (verify atomicity)
- [ ] Verify positions are assigned and persisted
- [ ] Delete entity and verify remaining serial numbers maintain order
```

---

## Implementation Guide for Agent

### Step 1: Entity Validation Module
```typescript
// Create validation functions for each entity type
validateTrip(data): { valid: boolean, errors: string[] }
validateFlight(data): { valid: boolean, errors: string[] }
validateHotel(data): { valid: boolean, errors: string[] }
validateLink(data, supabase): { valid: boolean, errors: string[] } // needs async DB check
```

### Step 2: Supabase Operations Module
```typescript
// Create CRUD functions
createTrip(supabase, profile_id, tripData): Promise<Trip>
addFlight(supabase, profile_id, flightData): Promise<Flight>
addHotel(supabase, profile_id, hotelData): Promise<Hotel>
createLink(supabase, profile_id, linkData): Promise<Link>
```

### Step 3: Batch Operation Handler
```typescript
// Handle multi-entity addition with atomic behavior
batchAdd(supabase, profile_id, {
  trip?: TripData,
  flights?: FlightData[],
  hotels?: HotelData[],
  links?: LinkData[]
}): Promise<BatchResult>
```

### Step 4: Position Assignment
```typescript
// Auto-position new nodes in graph
assignGraphPositions(tripId, nodeIds): Promise<PositionMap>
```

### Step 5: Error Recovery
```typescript
// Implement rollback logic for failed batch operations
rollbackCreatedEntities(supabase, createdIds): Promise<void>
```

---

## Integration Points

### Frontend Integration
- Call agent from flight modal, hotel modal, and trip modal
- Receive validation errors and display in UI
- Handle position updates for graph visualization
- Update trip list after successful entity addition

### API Integration
- Agent runs as server-side logic (Next.js API routes)
- Or as middleware in modal submission handlers
- Validation can happen client-side before agent call

### Database Integration
- Supabase PostgreSQL with RLS policies
- Foreign key constraints maintained by agent
- Transactions for atomic multi-step operations

---

## Success Metrics

1. **Validation Accuracy**: 100% of invalid data rejected before DB insertion
2. **Atomicity**: 0% partial failures (all-or-nothing batch operations)
3. **Performance**: Batch insert 10 entities in < 500ms
4. **Error Messages**: 100% actionable (users know what failed and why)
5. **Audit Trail**: Complete logging of all operations for debugging

---

## Future Enhancements

- [ ] Bulk CSV import for flights/hotels
- [ ] AI-powered flight grouping suggestions
- [ ] Automatic duplicate detection (similar flight numbers, same dates)
- [ ] Graph layout optimization (force-directed graph positioning)
- [ ] Multi-user collaborative editing with conflict resolution
- [ ] Undo/redo operations via transaction log
