# Duplicate Host Issue Fix

## Problem

During testing, games were experiencing disconnections with the error:
```
[Listener:6405] 🔌 Disconnected (code: 1006, reason: none)
6405 duplicate host
```

Multiple listeners were disconnecting simultaneously with **WebSocket close code 1006** (abnormal closure), and when HOSTs attempted to reconnect, they were rejected as "duplicate host".

## Root Cause

The issue was a **race condition in connection cleanup**:

### The Flow:

1. **WebSocket connections close abnormally** (code 1006 - no close frame received)
   - This can happen due to:
     - Network interruptions
     - Load balancer timeouts
     - Brief server restarts
     - Railway health check issues

2. **Connections remain in channels array**
   - The `close` event handler only notified the listener manager
   - It **did NOT remove the connection from `channels` array**
   - Cleanup only happened during the ping interval (every 30 seconds)

3. **HOST tries to reconnect immediately**
   - Duplicate host detection checks if another HOST exists in `channels[channel]`
   - Finds the old connection still there (hasn't been cleaned up yet)
   - **Rejects the new connection** as "duplicate host"

### Code Issues:

**Before Fix** (lines 373-377):
```javascript
ws.on("close", function() {
  if (ws.playerId === "host" && listenerManager) {
    listenerManager.handleHostDisconnect(ws.channel);
  }
});
```

**Problem:** The connection was never removed from the `channels` array on close, creating a window (up to 30 seconds) where duplicate host detection would incorrectly reject legitimate reconnections.

## Solution

### 1. Immediate Connection Cleanup

Added immediate removal from `channels` array when connection closes:

```javascript
ws.on("close", function() {
  // Immediately remove from channels array to prevent duplicate host errors
  if (channels[ws.channel]) {
    const index = channels[ws.channel].indexOf(ws);
    if (index > -1) {
      channels[ws.channel].splice(index, 1);
    }
    // Clean up empty channels
    if (channels[ws.channel].length === 0) {
      delete channels[ws.channel];
    }
  }
  
  if (ws.playerId === "host" && listenerManager) {
    listenerManager.handleHostDisconnect(ws.channel);
  }
});
```

**Benefits:**
- ✅ Connections are removed **immediately** when they close
- ✅ No race condition between close and reconnect
- ✅ Duplicate host detection now works correctly
- ✅ Empty channels are cleaned up to prevent memory leaks

### 2. Error Logging

Added error event handler to help diagnose future issues:

```javascript
ws.on("error", function(error) {
  console.log(`❌ WebSocket error: ${ws.channel}/${ws.playerId} - ${error.message}`);
});
```

**Benefits:**
- ✅ Helps identify what causes 1006 disconnections
- ✅ Better visibility into network/connection issues
- ✅ Easier debugging in production

## Testing

After deploying this fix:

1. **Test normal reconnection:**
   - Open a game
   - Refresh the page (HOST reconnects)
   - Should reconnect without "duplicate host" error

2. **Test network interruption:**
   - Open a game
   - Disable network briefly
   - Re-enable network
   - Should reconnect automatically

3. **Test multiple games:**
   - Open multiple games simultaneously
   - Close and reopen browser tabs
   - All games should function normally

## Expected Behavior

**After Fix:**
- Abnormal disconnections (1006) will still happen (network issues, etc.)
- But HOSTs can **immediately reconnect** without duplicate host errors
- Listeners will properly handle reconnections using the 10-minute grace period
- Better error logging will help diagnose root causes of disconnections

## Files Modified

- `server/index.js`:
  - Added immediate cleanup in close event handler (lines 374-384)
  - Added error logging (lines 272-275)

## Deployment

1. Commit changes to git
2. Push to `develop` branch
3. Railway will automatically deploy
4. Monitor logs for:
   - Reduction in "duplicate host" errors
   - Error messages that explain 1006 disconnections

## Further Investigation

If 1006 disconnections continue to be frequent, investigate:

1. **Railway health checks:** Check if health check timeouts are causing disconnections
2. **Network stability:** Monitor for network issues between client and Railway
3. **Load balancer settings:** Check Railway load balancer timeout configurations
4. **Memory/CPU usage:** Ensure server isn't getting overloaded

## Date Fixed

October 15, 2025

