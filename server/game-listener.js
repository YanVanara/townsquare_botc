#!/usr/bin/env node

/**
 * Game Listener (Child Process)
 * 
 * Standalone script that connects to a single TownSquare game session
 * and tracks all events to the Tracker database.
 * 
 * Usage: node game-listener.js --channel=<channelId>
 */

const WebSocket = require('ws');
const argv = require('minimist')(process.argv.slice(2));
const EventParser = require('./event-parser');
const GameManager = require('./game-manager');
const TrackerClient = require('./tracker-client');

// Configuration
const TOWNSQUARE_WSS = process.env.TOWNSQUARE_WSS || 'ws://localhost:8081';
const PING_INTERVAL = 30000; // 30 seconds

class GameListener {
  constructor(channelId, options = {}) {
    this.channelId = channelId;
    this.playerId = `tracker-${this.generateId()}`;
    this.ws = null;
    this.eventParser = new EventParser();
    
    // Game Manager for auto-creation and syncing
    this.gameManager = options.trackerApiUrl
      ? new GameManager(options.trackerApiUrl, options.apiKey, options.userId)
      : null;
    
    // Tracker Client for event logging
    this.trackerClient = options.trackerApiUrl 
      ? new TrackerClient(options.trackerApiUrl, null, options.apiKey)
      : null;
    
    this.eventCount = 0;
    this.hostEventCount = 0;
    this.gameCreated = false;
    this.startTime = new Date();
    this.lastActivityTime = Date.now();
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  connect() {
    const url = `${TOWNSQUARE_WSS}/${this.channelId}/${this.playerId}`;
    console.log(`🔌 Connecting to: ${url}`);

    try {
      this.ws = new WebSocket(url);
      this.ws.on('open', this.onOpen.bind(this));
      this.ws.on('message', this.onMessage.bind(this));
      this.ws.on('error', this.onError.bind(this));
      this.ws.on('close', this.onClose.bind(this));
    } catch (error) {
      console.error('❌ Connection error:', error);
      process.exit(1);
    }
  }

  onOpen() {
    console.log('✅ Connected to TownSquare session');
    
    // Start ping interval
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send('ping', '[0,{}]');
      }
    }, PING_INTERVAL);
  }

  async onMessage(data) {
    try {
      this.lastActivityTime = Date.now();
      this.eventCount++;

      // Parse enriched message format
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (e) {
        return; // Skip unparseable messages
      }

      // Check if this is an enriched message from our modified server
      const isHostMessage = message._meta?.isHost || false;
      
      if (!isHostMessage) {
        return; // Skip non-host messages
      }

      this.hostEventCount++;

      const command = message.type;
      const params = message.payload;

      if (!command) return;

      // Parse the event
      const event = this.eventParser.parse(command, params);

      // Handle game management (auto-creation and syncing)
      if (this.gameManager && isHostMessage) {
        try {
          await this.handleGameManagement(event);
        } catch (error) {
          console.error(`❌ Game management error: ${error.message}`);
        }
      }

      // Forward to Tracker API for logging
      if (this.trackerClient && event.trackable && this.gameManager && this.gameManager.gameId) {
        // Update tracker client with game ID if needed
        if (!this.trackerClient.gameId) {
          this.trackerClient.gameId = this.gameManager.gameId;
        }
        
        try {
          await this.trackerClient.sendEvent(event);
        } catch (error) {
          console.error(`❌ Failed to log: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing message: ${error.message}`);
    }
  }

  async handleGameManagement(event) {
    switch (event.type) {
      case 'gamestate':
        // Auto-create game on first gamestate
        if (!this.gameCreated && event.data && event.data.players) {
          await this.gameManager.handleNewGame(this.channelId, event);
          this.gameCreated = true;
          console.log(`✅ Game auto-created: ${this.gameManager.gameId}`);
        } else if (this.gameCreated && event.data && event.data.players) {
          // Sync players on subsequent gamestates
          await this.gameManager.syncPlayers(event.data.players);
        }
        break;
      
      case 'role_assignment':
        // Assign role to player
        if (event.data && this.gameCreated) {
          await this.gameManager.assignRole(
            event.data.playerName,
            event.data.index,
            event.data.roleId,
            event.data.roleName,
            event.data.team
          );
        }
        break;
      
      case 'player_update':
        // Update player status (death, etc.)
        if (event.data && event.data.property === 'isDead' && this.gameCreated) {
          await this.gameManager.updatePlayerStatus(
            event.data.index,
            event.data.value
          );
        }
        break;
      
      case 'edition':
        // Update script
        if (event.data && event.data.edition) {
          const editionId = event.data.edition.id || event.data.edition;
          await this.gameManager.handleScriptChange(editionId);
        }
        break;
      
      case 'phase_change':
        // Create turn records
        if (event.details && this.gameCreated) {
          const turnNumber = Math.floor(Date.now() / 1000) % 100; // Temporary
          await this.gameManager.handlePhaseChange(event.details.isNight, turnNumber);
        }
        break;
    }
  }

  onError(error) {
    console.error('❌ WebSocket error:', error.message);
  }

  onClose(code, reason) {
    console.log(`🔌 Disconnected (code: ${code}, reason: ${reason || 'none'})`);
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Exit after disconnection
    setTimeout(() => {
      const duration = Math.round((Date.now() - this.startTime.getTime()) / 1000);
      console.log(`📊 Session stats:`);
      console.log(`   - Duration: ${duration}s`);
      console.log(`   - Events: ${this.eventCount}`);
      console.log(`   - Host events: ${this.hostEventCount}`);
      if (this.gameManager && this.gameManager.gameId) {
        console.log(`   - Game ID: ${this.gameManager.gameId}`);
      }
      process.exit(0);
    }, 1000);
  }

  send(command, params) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify([command, params]));
    }
  }

  disconnect() {
    if (this.ws) {
      this.send('bye', this.playerId);
      this.ws.close(1000);
    }
  }
}

// Main execution
if (require.main === module) {
  const channelId = argv.channel || argv.c;
  const trackerApiUrl = argv['tracker-api'] || argv.t || process.env.TRACKER_API_URL;
  const apiKey = argv['api-key'] || argv.k || process.env.SUPABASE_ANON_KEY;
  const userId = argv['user-id'] || argv.u || process.env.TRACKER_USER_ID;

  if (!channelId) {
    console.error('❌ Error: Channel ID is required');
    console.error('Usage: node game-listener.js --channel=<channelId>');
    process.exit(1);
  }

  if (!trackerApiUrl || !apiKey) {
    console.error('⚠️ Warning: Tracker API not configured, running in passive mode');
  }

  console.log(`🎮 Game Listener starting for channel: ${channelId}`);

  const listener = new GameListener(channelId, {
    trackerApiUrl,
    apiKey,
    userId
  });

  listener.connect();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    listener.disconnect();
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down...');
    listener.disconnect();
  });
}

module.exports = GameListener;

