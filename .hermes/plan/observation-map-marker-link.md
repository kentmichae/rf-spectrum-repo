# Plan: Link Observations to Map Markers by Click

## Goal
Make every observation on the map clickable to fly the map to its location, and link the right-panel list items to fly to markers. This bridges the "what" (list data) with the "where" (map location).

## Current State
- `flyToObservation(obs)` exists and works (used in search panel)
- Markers on the map open Popups but don't fly when clicked
- Right-panel list items show data but don't trigger fly-to
- No visual highlight on the "flying to" observation
- Popups have raw text with no clickable interaction

## Implementation Steps

### Phase 1: Add fly-to-on-click to map markers
**Task 1.1**: Modify the `<Marker>` component in MapPage.tsx
- Use `eventHandlers={{ click: () => flyToObservation(obs) }}` on each Marker
- This replaces the default popup behavior with a click-to-fly behavior
- Keep the popup but use it only for quick info display (auto-open when clicked)

### Phase 2: Add clickable list items in right panel
**Task 2.1**: Make right-panel observation list items clickable
- Add `onClick={() => flyToObservation(obs)}` to each list div/button
- Add a cursor-pointer style to indicate clickability
- Add a small "pin" icon to the fly-to action

### Phase 3: Add visual highlight (active observation)
**Task 3.1**: Track `activeObservationId` in state
- When `flyToObservation(obs)` is called, set `activeObservationId = obs.id`
- Clear on map drag/center change (timeout)
- Add a glowing border/highlight to the active observation item in the list

### Phase 4: Enhance popup with better interaction
**Task 4.1**: Add a "View on Map" / "Fly-to" button in the popup
**Task 4.2**: Add frequency range highlight
**Task 4.3**: Use classification colors more prominently

### Phase 5: Test and verify
- Test clicking on map markers → map flies to location
- Test clicking on list items → map flies to location
- Test dragging the map → active highlight clears
- Verify markers remain visible with correct classification colors
