# Auto-Listener Fix Summary

## Problem

The game session "rast" was not being properly created in the tracker and Supabase database. When analyzing the Railway logs, we discovered that:

1. **WebSocket server was receiving all game events correctly** ✅
2. **However, events were not being persisted to the database** ❌

## Root Cause

The **Auto-Listener feature was disabled** on the WebSocket server deployment. This feature is responsible for:
- Spawning a game listener process when a HOST joins a channel
- Auto-creating the game in Supabase on the first gamestate event
- Syncing all game events (role assignments, deaths, phase changes) to the database
- Auto-cleaning up after 60 minutes of inactivity

## Fixes Applied

### 1. Enable Auto-Listener Feature

**Environment Variable Set:**
```bash
ENABLE_AUTO_LISTENERS=true
```

**What this does:**
- Enables the Listener Manager when the WebSocket server starts
- Automatically spawns game listener child processes when HOST joins a channel
- Manages lifecycle of listeners (spawning, monitoring, cleanup)

### 2. Configure WebSocket URL

**Environment Variable Set:**
```bash
TOWNSQUARE_WSS=wss://for-websocket-server-deployment-production.up.railway.app
```

**Why this was needed:**
- Game listeners are spawned as child processes that need to connect back to the WebSocket server
- The default value was `ws://localhost:8081` (development mode)
- Production needs to use the public Railway URL with WSS (secure WebSocket)

### 3. Verify Existing Environment Variables

**Already Configured:**
```bash
SUPABASE_URL=https://cktatkjbmvbzptbfwwbk.supabase.co
SUPABASE_ANON_KEY=<key>
TRACKER_USER_ID=bcbc7ec9-ac4a-4a34-8a8b-c51ef39b693a
```

## Verification

From the Railway logs, we can confirm the fix is working:

```
🎛️  Auto-Listener feature ENABLED
🎛️  Listener Manager initialized
   - Enabled: true
   - Inactivity timeout: 60 minutes
   - Reconnection grace: 10 minutes

🚀 Spawning Game Listener for channel: rast
✅ Game Listener spawned for channel: rast (PID: 22)

[Listener:rast] 🔌 Connecting to: wss://for-websocket-server-deployment-production.up.railway.app/rast/tracker-olrjjl6ll
[Listener:rast] ✅ Connected to TownSquare session
```

## How It Works Now

### Automatic Game Tracking Flow:

1. **HOST joins a channel** → WebSocket server detects HOST connection
2. **Listener Manager spawns a game listener** → Child process created for that channel
3. **Game listener connects to WebSocket** → Uses `tracker-` prefix to receive enriched messages
4. **First gamestate received** → Auto-creates game in Supabase
5. **Subsequent events** → Role assignments, deaths, phase changes synced to database
6. **HOST disconnects** → 10-minute grace period for reconnection
7. **After 60 minutes of inactivity** → Auto-cleanup of listener process

### Listener Features:

- **Auto-creation:** Games are automatically created in Supabase when first gamestate is received
- **Reconnection handling:** 10-minute grace period if HOST temporarily disconnects
- **Inactivity timeout:** Listeners clean up after 60 minutes of no activity
- **Health monitoring:** Periodic checks to ensure listeners are running correctly
- **Enriched messages:** Listeners receive metadata about who sent each message (HOST vs players)
- **HOST-only filtering:** Only processes events from the HOST to avoid duplicate/conflicting data

## Testing

To test the fix, create a new game session in the web app:

1. Go to https://botc-west-coast.up.railway.app/
2. Create a new game session
3. Add players
4. Assign roles
5. Check Railway logs for game creation confirmation
6. Verify the game appears in Supabase database

Expected log output:
```
✅ Game auto-created: <game-id>
✅ Players synced
✅ Role assigned in database
```

## Files Modified

No code files were modified. Only Railway environment variables were updated:

- `ENABLE_AUTO_LISTENERS` (added)
- `TOWNSQUARE_WSS` (added)

## Date Fixed

October 15, 2025

