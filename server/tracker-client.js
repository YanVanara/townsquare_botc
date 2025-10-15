/**
 * Tracker Client
 * 
 * Forwards TownSquare events to the Tracker API (Supabase).
 * Sends events directly to the websocket_logs table.
 */

class TrackerClient {
  constructor(apiUrl, gameId, apiKey = null) {
    this.apiUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.gameId = gameId;
    this.apiKey = apiKey;
    this.eventQueue = [];
    this.isSending = false;
  }

  /**
   * Send an event to the Tracker API
   */
  async sendEvent(event) {
    if (!this.gameId) {
      throw new Error('No game ID provided - cannot send events');
    }

    // Add to queue
    this.eventQueue.push(event);

    // Process queue if not already processing
    if (!this.isSending) {
      await this.processQueue();
    }
  }

  /**
   * Process the event queue
   */
  async processQueue() {
    if (this.eventQueue.length === 0) {
      this.isSending = false;
      return;
    }

    this.isSending = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      
      try {
        await this.sendToApi(event);
      } catch (error) {
        console.error(`Failed to send event to Tracker:`, error.message);
        // Re-queue the event
        this.eventQueue.unshift(event);
        // Wait before retry
        await this.sleep(5000);
      }
    }

    this.isSending = false;
  }

  /**
   * Send event to Supabase API
   */
  async sendToApi(event) {
    const payload = this.transformEventToPayload(event);
    const endpoint = `${this.apiUrl}/rest/v1/websocket_logs`;

    const apiKey = this.apiKey || process.env.SUPABASE_ANON_KEY || '';
    const headers = {
      'Content-Type': 'application/json',
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
      'Prefer': 'return=minimal'
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase API returned ${response.status}: ${errorText}`);
    }

    return { success: true };
  }

  /**
   * Transform event into Supabase websocket_logs payload
   */
  transformEventToPayload(event) {
    // Extract event details based on type
    let eventData = {};

    switch (event.type) {
      case 'gamestate':
        eventData = {
          playerCount: event.data.players?.length || 0,
          isNight: event.data.isNight,
          nomination: event.data.nomination,
          markedPlayer: event.data.markedPlayer
        };
        break;

      case 'player_update':
        eventData = {
          seat: event.details.seat,
          player: event.details.player,
          property: event.data.property,
          value: event.data.value
        };
        break;

      case 'role_assignment':
      case 'all_roles_assigned':
        eventData = event.data;
        break;

      case 'reminders_update':
        eventData = {
          player: event.details.player,
          seat: event.details.seat,
          tokens: event.details.tokens
        };
        break;

      case 'demon_bluffs':
        eventData = {
          bluffCount: event.details.bluffCount,
          bluffs: event.details.bluffs
        };
        break;

      case 'nomination':
        eventData = {
          nominator: event.details.nominator,
          nominee: event.details.nominee,
          nominatorSeat: event.details.nominatorSeat,
          nomineeSeat: event.details.nomineeSeat
        };
        break;

      case 'vote':
        eventData = {
          voter: event.details.voter,
          seat: event.details.seat,
          vote: event.details.vote
        };
        break;

      case 'phase_change':
        eventData = {
          isNight: event.details.isNight
        };
        break;

      case 'marked':
        eventData = {
          player: event.details.player,
          seat: event.details.seat
        };
        break;

      default:
        eventData = {
          details: event.details,
          data: event.data
        };
    }

    return {
      session_id: this.gameId,
      event_type: event.type,
      event_data: eventData,
      timestamp: event.timestamp || new Date().toISOString(),
      is_host_event: true,
      source: 'websocket'
    };
  }

  /**
   * Helper to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TrackerClient;

