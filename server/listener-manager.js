/**
 * Listener Manager
 * 
 * Manages lifecycle of Game Listeners (child processes) for tracking games.
 * 
 * Features:
 * - Auto-spawn listeners when HOST joins a channel
 * - Auto-cleanup after 60 minutes of inactivity
 * - Reconnection handling (keep listener alive for 10 minutes)
 * - Process monitoring and health checks
 * - Graceful shutdown
 */

const { spawn } = require('child_process');
const path = require('path');

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 60 minutes
const RECONNECTION_GRACE_PERIOD = 10 * 60 * 1000; // 10 minutes
const HEALTH_CHECK_INTERVAL = 30 * 1000; // 30 seconds

class ListenerManager {
  constructor(options = {}) {
    this.activeListeners = new Map(); // channel -> { process, metadata }
    this.enabled = options.enabled !== false; // Feature flag
    this.supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL;
    this.supabaseKey = options.supabaseKey || process.env.SUPABASE_ANON_KEY;
    this.userId = options.userId || process.env.TRACKER_USER_ID || '00000000-0000-0000-0000-000000000000';
    
    // Start health check interval
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, HEALTH_CHECK_INTERVAL);

    console.log('🎛️  Listener Manager initialized');
    console.log(`   - Enabled: ${this.enabled}`);
    console.log(`   - Inactivity timeout: ${INACTIVITY_TIMEOUT / 60000} minutes`);
    console.log(`   - Reconnection grace: ${RECONNECTION_GRACE_PERIOD / 60000} minutes`);
  }

  /**
   * Spawn a Game Listener for a channel
   */
  spawnGameListener(channel, isReconnect = false) {
    if (!this.enabled) {
      console.log(`⏭️  Listener Manager disabled, skipping spawn for: ${channel}`);
      return null;
    }

    // Check if Supabase credentials are available
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.log(`⚠️  Supabase credentials not configured, cannot spawn listener for: ${channel}`);
      return null;
    }

    // Check if already running
    const existing = this.activeListeners.get(channel);
    if (existing && existing.process && !existing.process.killed) {
      console.log(`♻️  Listener already exists for channel: ${channel}`);
      // Update activity timestamp
      existing.lastActivity = Date.now();
      existing.reconnectCount = (existing.reconnectCount || 0) + (isReconnect ? 1 : 0);
      clearTimeout(existing.inactivityTimer);
      this.setInactivityTimer(channel);
      return existing.process;
    }

    console.log(`🚀 Spawning Game Listener for channel: ${channel}`);

    // Path to game-listener script
    const listenerScript = path.join(__dirname, 'game-listener.js');

    // Spawn child process
    const child = spawn('node', [
      listenerScript,
      '--channel', channel
    ], {
      env: {
        ...process.env,
        TRACKER_API_URL: this.supabaseUrl,
        SUPABASE_ANON_KEY: this.supabaseKey,
        TRACKER_USER_ID: this.userId,
        NODE_ENV: process.env.NODE_ENV || 'production'
      },
      stdio: ['ignore', 'pipe', 'pipe'] // stdin ignored, stdout/stderr piped
    });

    // Create metadata
    const metadata = {
      process: child,
      channel,
      startTime: Date.now(),
      lastActivity: Date.now(),
      reconnectCount: 0,
      inactivityTimer: null,
      gracePeriodTimer: null
    };

    // Track the process
    this.activeListeners.set(channel, metadata);

    // Handle output
    child.stdout.on('data', (data) => {
      const output = data.toString().trim();
      console.log(`[Listener:${channel}] ${output}`);
      // Update activity timestamp on any output
      this.updateActivity(channel);
    });

    child.stderr.on('data', (data) => {
      const error = data.toString().trim();
      console.error(`[Listener:${channel}] ERROR: ${error}`);
      this.updateActivity(channel);
    });

    // Handle exit
    child.on('exit', (code, signal) => {
      console.log(`[Listener:${channel}] Process exited (code: ${code}, signal: ${signal})`);
      this.cleanupListener(channel);
    });

    // Handle errors
    child.on('error', (error) => {
      console.error(`[Listener:${channel}] Process error:`, error);
      this.cleanupListener(channel);
    });

    // Set inactivity timer
    this.setInactivityTimer(channel);

    console.log(`✅ Game Listener spawned for channel: ${channel} (PID: ${child.pid})`);

    return child;
  }

  /**
   * Handle HOST reconnection
   */
  handleHostReconnect(channel) {
    const listener = this.activeListeners.get(channel);
    
    if (!listener) {
      // No existing listener, spawn new one
      return this.spawnGameListener(channel, true);
    }

    // Listener exists, update activity and cancel any grace period
    console.log(`🔄 HOST reconnected to channel: ${channel}`);
    this.updateActivity(channel);
    
    if (listener.gracePeriodTimer) {
      clearTimeout(listener.gracePeriodTimer);
      listener.gracePeriodTimer = null;
      console.log(`   ✓ Cancelled grace period timer`);
    }

    return listener.process;
  }

  /**
   * Handle HOST disconnect
   */
  handleHostDisconnect(channel) {
    const listener = this.activeListeners.get(channel);
    
    if (!listener) {
      return; // No listener to handle
    }

    console.log(`📴 HOST disconnected from channel: ${channel}`);
    console.log(`   → Starting ${RECONNECTION_GRACE_PERIOD / 60000} minute grace period`);

    // Start grace period timer
    listener.gracePeriodTimer = setTimeout(() => {
      console.log(`⏰ Grace period expired for channel: ${channel}`);
      this.stopGameListener(channel, 'grace_period_expired');
    }, RECONNECTION_GRACE_PERIOD);
  }

  /**
   * Update activity timestamp for a channel
   */
  updateActivity(channel) {
    const listener = this.activeListeners.get(channel);
    if (listener) {
      listener.lastActivity = Date.now();
    }
  }

  /**
   * Set inactivity timer for a channel
   */
  setInactivityTimer(channel) {
    const listener = this.activeListeners.get(channel);
    if (!listener) return;

    // Clear existing timer
    if (listener.inactivityTimer) {
      clearTimeout(listener.inactivityTimer);
    }

    // Set new timer
    listener.inactivityTimer = setTimeout(() => {
      const now = Date.now();
      const timeSinceActivity = now - listener.lastActivity;
      
      if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
        console.log(`⏰ Inactivity timeout for channel: ${channel} (${Math.round(timeSinceActivity / 60000)} minutes)`);
        this.stopGameListener(channel, 'inactivity_timeout');
      } else {
        // Reschedule check
        this.setInactivityTimer(channel);
      }
    }, INACTIVITY_TIMEOUT);
  }

  /**
   * Stop a Game Listener
   */
  stopGameListener(channel, reason = 'manual') {
    const listener = this.activeListeners.get(channel);
    if (!listener) {
      console.log(`⚠️  No listener found for channel: ${channel}`);
      return false;
    }

    console.log(`🛑 Stopping listener for channel: ${channel} (reason: ${reason})`);

    // Clear timers
    if (listener.inactivityTimer) {
      clearTimeout(listener.inactivityTimer);
    }
    if (listener.gracePeriodTimer) {
      clearTimeout(listener.gracePeriodTimer);
    }

    // Kill process gracefully
    if (listener.process && !listener.process.killed) {
      try {
        listener.process.kill('SIGTERM');
        console.log(`   ✓ Sent SIGTERM to process (PID: ${listener.process.pid})`);
      } catch (error) {
        console.error(`   ✗ Error killing process:`, error);
      }
    }

    // Remove from active listeners
    this.activeListeners.delete(channel);
    
    return true;
  }

  /**
   * Cleanup listener after exit
   */
  cleanupListener(channel) {
    const listener = this.activeListeners.get(channel);
    if (!listener) return;

    // Clear timers
    if (listener.inactivityTimer) {
      clearTimeout(listener.inactivityTimer);
    }
    if (listener.gracePeriodTimer) {
      clearTimeout(listener.gracePeriodTimer);
    }

    // Remove from map
    this.activeListeners.delete(channel);
    console.log(`🧹 Cleaned up listener for channel: ${channel}`);
  }

  /**
   * Perform health checks on all active listeners
   */
  performHealthChecks() {
    const now = Date.now();
    
    for (const [channel, listener] of this.activeListeners.entries()) {
      // Check if process is still alive
      if (listener.process.killed || listener.process.exitCode !== null) {
        console.log(`⚠️  Dead process detected for channel: ${channel}, cleaning up`);
        this.cleanupListener(channel);
        continue;
      }

      // Check inactivity
      const inactiveDuration = now - listener.lastActivity;
      if (inactiveDuration > INACTIVITY_TIMEOUT) {
        console.log(`⚠️  Inactivity detected for channel: ${channel} (${Math.round(inactiveDuration / 60000)} minutes)`);
        this.stopGameListener(channel, 'health_check_inactivity');
      }
    }
  }

  /**
   * Get active listeners info
   */
  getActiveListeners() {
    const now = Date.now();
    return Array.from(this.activeListeners.entries()).map(([channel, listener]) => ({
      channel,
      pid: listener.process.pid,
      uptime: Math.round((now - listener.startTime) / 1000), // seconds
      lastActivity: Math.round((now - listener.lastActivity) / 1000), // seconds ago
      reconnectCount: listener.reconnectCount,
      hasGracePeriod: !!listener.gracePeriodTimer
    }));
  }

  /**
   * Get statistics
   */
  getStats() {
    const now = Date.now();
    const listeners = Array.from(this.activeListeners.values());
    
    return {
      total: listeners.length,
      enabled: this.enabled,
      avgUptime: listeners.length > 0 
        ? Math.round(listeners.reduce((sum, l) => sum + (now - l.startTime), 0) / listeners.length / 1000)
        : 0,
      totalReconnects: listeners.reduce((sum, l) => sum + (l.reconnectCount || 0), 0)
    };
  }

  /**
   * Graceful shutdown - stop all listeners
   */
  shutdown() {
    console.log('🛑 Shutting down Listener Manager...');
    
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Stop all listeners
    const channels = Array.from(this.activeListeners.keys());
    for (const channel of channels) {
      this.stopGameListener(channel, 'server_shutdown');
    }

    console.log('✅ Listener Manager shutdown complete');
  }
}

module.exports = ListenerManager;

