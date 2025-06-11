# Notification System Implementation

This document describes the notification system implementation added to the Plektos application.

## Overview

The notification system provides real-time notifications for event creators when they receive:
- RSVPs to their events (accepted/declined/tentative)
- Comments on their events (NIP-22 comments)
- Zaps to their events (kind 9735 lightning payments)

## Recent Fixes

### Issue 1: Read Status Not Persisting
**Problem**: Marking notifications as read wasn't persisting across sessions.
**Solution**: 
- Added proper localStorage persistence for read status changes
- Enhanced the notification context with debugging logs
- Ensured read status updates trigger localStorage saves

### Issue 2: No Navigation on Notification Click
**Problem**: Clicking notifications wasn't navigating users to the relevant event page.
**Solution**:
- Added React Router navigation to notification click handler
- Implemented proper dropdown state management
- Added automatic dropdown closing after navigation
- All notifications now navigate to `/event/{eventId}` when clicked

### Issue 3: Notification Dropdown Not Scrollable  
**Problem**: When there were many notifications, users couldn't scroll to view older ones.
**Solution**:
- Replaced `DropdownMenuItem` with regular `div` elements to fix scroll interference
- Improved `ScrollArea` implementation with proper height constraints
- Added visual separators between notifications
- Enhanced the test page with "Add 10 for Scroll Test" button to test scrolling functionality

### Issue 4: RSVP Status Dropdown Not Working
**Problem**: Users couldn't change their RSVP status from "Can't Go" to other statuses like "Maybe" or "I'm Going".
**Solution**: 
- Fixed the Select component state management issue
- Added useEffect to sync currentStatus with rsvpStatus state
- Changed the Select value to use only rsvpStatus (which is now synchronized)
- Fixed RSVP lookup to use latestRSVPs instead of all rsvpEvents for better accuracy

### Implementation Details of Fixes
1. **Enhanced NotificationBell Component**:
   - Added `useNavigate` hook for routing
   - Added `useState` for dropdown open/close control
   - Added `onClose` callback to notification items
   - Each notification click now marks as read AND navigates
   - Replaced `DropdownMenuItem` with `div` elements for better scroll support
   - Improved ScrollArea layout with fixed height and proper overflow handling

2. **Improved Notification Context**:
   - Added debug logging for read status changes
   - Verified localStorage operations are working properly
   - Enhanced state update reliability

3. **Better ScrollArea Implementation**:
   - Fixed height container (`h-80`) for consistent scrolling
   - Removed conflicting max-height constraints
   - Added visual separators (`divide-y`) between notifications
   - Proper padding and spacing for scroll content

4. **Fixed RSVP Status Dropdown (EventDetail.tsx)**:
   - Added `useEffect` to sync `currentStatus` with `rsvpStatus` state
   - Changed Select `value` from `currentStatus || rsvpStatus` to just `rsvpStatus`
   - Fixed RSVP lookup to use `latestRSVPs` for accurate current status detection
   - Ensured dropdown reflects and updates the user's actual RSVP status properly

## Components Implemented

### 1. Notification Types (`src/lib/notificationTypes.ts`)

Defines the TypeScript interfaces for different notification types:
- Base notification interface with common properties
- Optional properties to support different notification types (RSVP, comment, zap)

### 2. Notification Context (`src/contexts/NotificationContext.tsx`)

Provides:
- State management for notifications
- Local storage persistence
- Functions to add, mark as read, and manage notifications
- Automatic deduplication to prevent duplicate notifications

### 3. Notification Listener Hook (`src/hooks/useNotificationListener.ts`)

- Monitors Nostr events related to user's created events
- Automatically detects and processes RSVP, comment, and zap events
- Uses React Query for efficient polling and caching
- Processes only recent events (last 24 hours) to avoid spam

### 4. Notification Bell Component (`src/components/NotificationBell.tsx`)

- Bell icon with unread notification count badge
- Dropdown showing notification list
- Different icons for each notification type (heart, message, zap)
- Time-relative display using date-fns
- Mark as read functionality

### 5. Notification Manager (`src/components/NotificationManager.tsx`)

- Wrapper component that initializes the notification listener
- Should be placed high in the component tree

### 6. Integration into App Structure

- NotificationProvider added to App.tsx
- NotificationManager added to wrap the main app content
- NotificationBell added to both mobile and desktop headers

## Features

### Real-time Monitoring
- Polls for new notifications every 60 seconds
- Automatically processes new events and creates notifications
- Filters out notifications from self and old events

### User Experience
- Visual indicator in header shows unread count
- Different icons and messages for each notification type
- Persistent storage survives browser refreshes
- "Mark all as read" and "clear all" functionality

### Notification Types Supported

#### RSVP Notifications (kind 31925)
- Shows when someone RSVPs to your event
- Displays the RSVP status (accepted/declined/tentative)
- Shows event title and author name

#### Comment Notifications (kind 1111)
- Shows when someone comments on your event using NIP-22
- Displays first 50 characters of comment
- Shows event title and author name

#### Zap Notifications (kind 9735)
- Shows when someone zaps (lightning payment) to your event
- Displays zap amount in sats
- Shows optional zap comment
- Shows event title and author name

## Technical Implementation Details

### Event Filtering
```typescript
// Only monitors events created by the current user
kinds: [31922, 31923], // Date-based and time-based events
authors: [user.pubkey]

// Listens for related notifications
kinds: [31925, 1111, 9735], // RSVP, comments, zaps
"#e": userEventIds // Only events referencing user's events
```

### Deduplication Logic
- Checks for identical notification IDs
- Prevents duplicate notifications from same user within 1 minute window
- Maintains processed events set to avoid reprocessing

### Error Handling
- Graceful handling of malformed zap requests
- Skip processing of invalid events
- Console logging for debugging

### Performance Optimizations
- Uses React Query for caching and efficient polling
- Limits to 50 most recent notifications
- Only processes events from last 24 hours
- Abort signals for proper cleanup

## Usage

Once logged in, the notification bell appears in the header. Users will automatically receive notifications for:

1. **Event RSVPs**: When someone responds to their event invitation
2. **Event Comments**: When someone comments on their event post
3. **Event Zaps**: When someone sends lightning payments to their ticket-enabled events

## Testing and Debugging

### Test Page
Navigate to `/test-notifications` to access the notification debug panel where you can:
- Add test notifications of each type
- Test mark as read functionality  
- Test mark all as read functionality
- View all notifications with their current state
- See console logs for debugging

### Debugging Steps
1. Open browser developer tools (F12)
2. Check the Console tab for debug logs
3. Add test notifications and verify they appear in localStorage
4. Test clicking on notifications to verify navigation
5. Check Application > Local Storage > plektos-notifications to see stored data

## Troubleshooting

### Read State Not Persisting
- Check browser console for localStorage errors
- Verify notifications are being saved to localStorage after read state changes
- Confirm the notification context is properly updating state

### Navigation Not Working
- Verify the event route exists (`/event/:eventId`)
- Check that the eventId in notifications matches actual events
- Confirm React Router is properly configured

### Notifications Not Showing
- Verify user is logged in (notifications only show for authenticated users)
- Check Nostr event monitoring is working via console logs
- Confirm user has created events that can receive notifications

## Future Enhancements

- Browser notifications API integration
- Email/push notification options
- Notification preferences/filtering
- More notification types (follows, mentions, etc.)
- Real-time WebSocket updates instead of polling