# Flight Grouping & Connection Detection - Update Guide

## What's Changed

### 1. **Connection Detection Logic Fixed**
The previous bug where flights with hotels between them were incorrectly marked as "Connecting" is now fixed.

**How it works:**
- A flight is marked as "Connecting" ONLY if the very next event in the timeline is another flight (no hotel in between)
- If a hotel stay comes between two flights, both are marked as non-connecting

### 2. **Manual Flight Grouping Feature Added**
Users can now manually override auto-detection and group flights into custom connection groups.

**Use Cases:**
- Group A: "LAX → JFK → Boston" (3 connecting flights)
- Group B: "Paris → Rome" (separate trip after hotel stays)
- Group C: "Tokyo (single flight)"

---

## Database Changes Required

### SQL Schema Updates
The `trip_flights` table now has a new column:
```sql
connection_group TEXT DEFAULT 'standalone'
```

**Steps to Update Supabase:**

1. **Drop old objects** (in this order):
```sql
DROP TRIGGER IF EXISTS trigger_flights_serial ON public.trip_flights;
DROP TRIGGER IF EXISTS trigger_hotels_serial ON public.trip_hotels;
DROP FUNCTION IF EXISTS public.update_trip_serial_numbers(UUID);
```

2. **Add the new column** (if not already added by migration):
```sql
ALTER TABLE public.trip_flights 
ADD COLUMN IF NOT EXISTS connection_group TEXT DEFAULT 'standalone';
```

3. **Run the complete setup** from `TRIPS_TABLES_SETUP.sql` to recreate:
   - Updated function with manual grouping support
   - Triggers
   - All indexes and policies

---

## UI Changes

### New Components
- **FlightGroupingModal** (`/components/modals/flight-grouping-modal.tsx`)
  - Allows users to create and assign flights to connection groups
  - Shows all flights in a trip with group assignment controls
  - Supports creating custom group names
  - Calls the function to recalculate connections after saving

### Updated Components
- **flights/page.tsx**
  - Added "Group Flights" button (visible when 2+ flights exist)
  - Updated flight display to show:
    - Group name badges (purple) for manually grouped flights
    - "Connecting" badge (blue) for auto-detected connections
    - "Connected" badge (green) for manually grouped connections
  - Added connection_group field to Flight interface

---

## How to Use the Feature

### Step 1: Create Trips with Flights
- Create a new trip
- Add multiple flights with dates/times

### Step 2: Open Flight Grouping
- Expand a trip with 2+ flights
- Click the "Group Flights" button (purple link icon)

### Step 3: Assign Flights to Groups
- Click flight buttons to assign to groups:
  - **standalone**: Individual flight (no connection)
  - **Custom groups**: Create named groups like "Asia-Pacific" or "Europe"
- All flights in the same group = connected sequence

### Step 4: Save
- Click "Save Groups"
- The function recalculates everything automatically
- Flights show updated badges (Connected in green)

---

## Badge Meanings

| Badge | Meaning |
|-------|---------|
| **Connecting** (blue) | Auto-detected: next event is another flight, no hotel |
| **Connected** (green) | Manually grouped in same connection group |
| **Group: [name]** (purple) | Assigned to custom connection group |
| (none) | Single flight or non-connecting |

---

## Technical Details

### Function Logic
The `update_trip_serial_numbers()` function now:

1. **Checks manual grouping first**:
   - If flight has `connection_group` != 'standalone', checks if next flight is in same group
   - Marks as connecting if groups match

2. **Falls back to auto-detection**:
   - If no manual group, finds next event (flight or hotel)
   - Marks as connecting only if next event is flight

3. **Updates serial numbers** for all events in chronological order

### Data Flow
```
User assigns flights to groups
         ↓
FlightGroupingModal saves connection_group values
         ↓
RPC call: update_trip_serial_numbers()
         ↓
Function recalculates is_connecting_to_next based on:
  - Manual groups (first priority)
  - Auto-detection (fallback)
         ↓
UI fetches updated flights and displays badges
```

---

## Example Scenario

**Trip: "Around the World"**
- May 13: Flight EY301 LAX → JFK (22:38 - 22:39 next day)
- May 14: Hotel Holiday Inn, NYC (check-in 14:00, same day)
- May 16: Flight EY432 HAS → DED (21:42 - May 18 21:44)

**Behavior:**
- **Before grouping**: EY301 auto-marked as "Connecting" (BUG - now fixed)
- **After grouping**: 
  - Both flights marked as **"Connecting"** if assigned to Group "Round World"
  - OR EY301 shows no badge, EY432 shows no badge if "standalone"

**Connection Detection:**
- EY301 → EY432 path: Hotel exists between them = NOT auto-connecting ✓
- Manual group "Round World": Forces them as connected = green "Connected" badge ✓

---

## Next Steps

1. ✅ Run SQL setup (drop old objects, recreate function/triggers)
2. ✅ Rebuild frontend (changes to page.tsx and new modal)
3. ✅ Test:
   - Create trip with 2+ flights
   - Verify no hotel between them = auto-detected "Connecting"
   - Add hotel between flights = no auto-detection
   - Use grouping UI to manually connect them
   - Save and refresh to see updated badges
