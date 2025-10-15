/**
 * Game Manager
 * 
 * Handles auto-creation and synchronization of games from TownSquare to Tracker.
 * This is the intelligence layer that converts TownSquare events into Tracker database updates.
 */

class GameManager {
  constructor(supabaseUrl, supabaseKey, userId = null) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
    this.userId = userId || '00000000-0000-0000-0000-000000000000'; // Default tracker user
    this.gameId = null;
    this.channelId = null;
    this.playerCache = new Map(); // name -> player_profile_id
    this.sessionPlayerCache = new Map(); // seat -> session_player_id
    this.currentScript = null;
  }

  /**
   * Auto-create game when first gamestate event is received
   */
  async handleNewGame(channelId, gamestateEvent) {
    if (this.gameId) {
      console.log(`Game already exists: ${this.gameId}`);
      return this.gameId;
    }

    this.channelId = channelId;
    const { gamestate, isNight } = gamestateEvent.data;

    console.log(`🎮 Auto-creating game for channel: ${channelId}`);

    try {
      // Create game session
      const gameData = {
        websocket_channel_id: channelId,
        script_id: await this.getScriptId(this.currentScript || 'tb'), // Default to Trouble Brewing
        storyteller_name: 'TownSquare MJ',
        session_date: new Date().toISOString().split('T')[0],
        status: 'in_progress',
        start_time: new Date().toISOString(),
        user_id: this.userId,
        listener_status: 'running',
        townsquare_url: this.getTownsquareUrl(channelId),
        notes: 'Auto-created from TownSquare session'
      };

      const game = await this.createGame(gameData);
      this.gameId = game.id;

      console.log(`✅ Game created: ${this.gameId}`);

      // Sync initial players
      if (gamestate && gamestate.length > 0) {
        await this.syncPlayers(gamestate);
      }

      // Create first turn if night
      if (isNight) {
        await this.createTurn(1, 'night', true);
      }

      return this.gameId;
    } catch (error) {
      console.error('❌ Error creating game:', error);
      throw error;
    }
  }

  /**
   * Sync players from gamestate
   */
  async syncPlayers(players) {
    if (!this.gameId) {
      console.log('⏭️ No game ID, skipping player sync');
      return;
    }

    console.log(`👥 Syncing ${players.length} players...`);

    let matchedCount = 0;
    let createdCount = 0;

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (!player.name) continue;

      try {
        // Check cache first (normalized name)
        const normalizedName = player.name.trim();
        let profileId = this.playerCache.get(normalizedName);
        let wasInCache = !!profileId;

        if (!profileId) {
          // Not in cache - find or create
          const profile = await this.findOrCreatePlayerProfile(player.name);
          profileId = profile.id;
          this.playerCache.set(normalizedName, profileId);
          
          // Track if we matched existing or created new
          if (profile.notes && profile.notes.includes('Auto-created from TownSquare')) {
            // Check if it was just created (updated_at is very recent)
            const createdAt = new Date(profile.created_at);
            const now = new Date();
            if (now - createdAt < 5000) { // Created in last 5 seconds
              createdCount++;
            } else {
              matchedCount++;
            }
          } else {
            matchedCount++;
          }
        } else {
          // Was in cache - no need to query
          if (!wasInCache) {
            console.log(`   ⚡ Using cached player: ${normalizedName}`);
          }
        }

        // Create or update session player
        await this.upsertSessionPlayer(profileId, i + 1, player);
      } catch (error) {
        console.error(`❌ Error syncing player ${player.name}:`, error.message);
      }
    }

    // Summary
    console.log(`✅ Players synced: ${matchedCount} matched existing, ${createdCount} created new`);
  }

  /**
   * Update player role assignment
   */
  async assignRole(playerName, seat, roleId, roleName, team) {
    if (!this.gameId) return;

    try {
      // Find session player by seat
      const sessionPlayerId = this.sessionPlayerCache.get(seat);
      if (!sessionPlayerId) {
        console.log(`⚠️ No session player found for seat ${seat}`);
        return;
      }

      // Get role UUID from database
      const role = await this.findRoleByName(roleName);
      if (!role) {
        console.log(`⚠️ Role not found: ${roleName}`);
        return;
      }

      // Update session player
      await this.updateSessionPlayer(sessionPlayerId, {
        role_id: role.id,
        final_alignment: (team === 'townsfolk' || team === 'outsider') ? 'good' : 'evil'
      });

      console.log(`✅ Role assigned: ${playerName} → ${roleName}`);
    } catch (error) {
      console.error('Error assigning role:', error);
    }
  }

  /**
   * Update player death status
   */
  async updatePlayerStatus(seat, isDead) {
    if (!this.gameId) return;

    try {
      const sessionPlayerId = this.sessionPlayerCache.get(seat);
      if (!sessionPlayerId) return;

      await this.updateSessionPlayer(sessionPlayerId, {
        is_alive: !isDead
      });

      console.log(`✅ Player status updated (seat ${seat}): ${isDead ? 'dead' : 'alive'}`);
    } catch (error) {
      console.error('Error updating player status:', error);
    }
  }

  /**
   * Handle script/edition change
   */
  async handleScriptChange(editionId) {
    this.currentScript = editionId;
    
    if (this.gameId) {
      // Update game session with new script
      const scriptId = await this.getScriptId(editionId);
      await this.updateGame({ script_id: scriptId });
      console.log(`✅ Script updated: ${editionId}`);
    }
  }

  /**
   * Handle phase change (create turns)
   */
  async handlePhaseChange(isNight, turnNumber) {
    if (!this.gameId) return;

    try {
      const phase = isNight ? 'night' : 'day';
      await this.createTurn(turnNumber, phase, false);
      console.log(`✅ Turn created: ${turnNumber} (${phase})`);
    } catch (error) {
      console.error('Error creating turn:', error);
    }
  }

  // ===== Database Operations =====

  async createGame(data) {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/game_sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to create game: ${response.status}`);
    }

    const games = await response.json();
    return games[0];
  }

  async updateGame(data) {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/game_sessions?id=eq.${this.gameId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`
        },
        body: JSON.stringify(data)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update game: ${response.status}`);
    }
  }

  async findOrCreatePlayerProfile(name) {
    // Normalize name for matching (trim and lowercase)
    const normalizedName = name.trim();
    
    // Strategy 1: Try exact match (case-sensitive) for this user
    let response = await fetch(
      `${this.supabaseUrl}/rest/v1/player_profiles?name=eq.${encodeURIComponent(normalizedName)}&user_id=eq.${this.userId}&deleted_at=is.null&order=updated_at.desc&limit=1`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`
        }
      }
    );

    let players = await response.json();
    if (players && players.length > 0) {
      console.log(`   ✓ Matched existing player: ${normalizedName} (exact match for this user)`);
      return players[0];
    }

    // Strategy 2: Try case-insensitive match for this user
    response = await fetch(
      `${this.supabaseUrl}/rest/v1/player_profiles?name=ilike.${encodeURIComponent(normalizedName)}&user_id=eq.${this.userId}&deleted_at=is.null&order=updated_at.desc&limit=1`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`
        }
      }
    );

    players = await response.json();
    if (players && players.length > 0) {
      console.log(`   ✓ Matched existing player: ${normalizedName} (case-insensitive match for this user)`);
      return players[0];
    }

    // Strategy 3: Global search across ALL users (find players from Discord, other sources, etc.)
    // This helps match players created by different systems
    response = await fetch(
      `${this.supabaseUrl}/rest/v1/player_profiles?name=ilike.${encodeURIComponent(normalizedName)}&deleted_at=is.null&order=updated_at.desc&limit=1`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`
        }
      }
    );

    players = await response.json();
    if (players && players.length > 0) {
      console.log(`   ✓ Matched existing player: ${normalizedName} (global match with "${players[0].name}" from ${players[0].notes || 'unknown source'})`);
      return players[0];
    }

    // No match found - create new player profile
    console.log(`   → Creating new player profile: ${normalizedName}`);
    response = await fetch(`${this.supabaseUrl}/rest/v1/player_profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        name: normalizedName,
        user_id: this.userId,
        notes: 'Auto-created from TownSquare'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create player: ${response.status} - ${errorText}`);
    }

    players = await response.json();
    console.log(`   ✓ New player created: ${normalizedName}`);
    return players[0];
  }

  async upsertSessionPlayer(playerProfileId, seatPosition, playerData) {
    // Check if session player already exists
    let response = await fetch(
      `${this.supabaseUrl}/rest/v1/session_players?session_id=eq.${this.gameId}&seat_position=eq.${seatPosition}`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`
        }
      }
    );

    const existing = await response.json();
    
    if (existing && existing.length > 0) {
      // Update existing
      const sessionPlayerId = existing[0].id;
      this.sessionPlayerCache.set(seatPosition - 1, sessionPlayerId);
      return sessionPlayerId;
    }

    // Create new
    response = await fetch(`${this.supabaseUrl}/rest/v1/session_players`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        session_id: this.gameId,
        player_profile_id: playerProfileId,
        seat_position: seatPosition,
        is_alive: !playerData.isDead,
        has_ghost_vote: false
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create session player: ${response.status}`);
    }

    const sessionPlayers = await response.json();
    const sessionPlayerId = sessionPlayers[0].id;
    this.sessionPlayerCache.set(seatPosition - 1, sessionPlayerId);
    return sessionPlayerId;
  }

  async updateSessionPlayer(sessionPlayerId, data) {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/session_players?id=eq.${sessionPlayerId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`
        },
        body: JSON.stringify(data)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update session player: ${response.status}`);
    }
  }

  async findRoleByName(roleName) {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/roles?name=eq.${encodeURIComponent(roleName)}&limit=1`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`
        }
      }
    );

    const roles = await response.json();
    return roles && roles.length > 0 ? roles[0] : null;
  }

  async getScriptId(scriptCode) {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/scripts?code=eq.${scriptCode}&limit=1`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`
        }
      }
    );

    const scripts = await response.json();
    if (scripts && scripts.length > 0) {
      return scripts[0].id;
    }

    // Default to first script if not found
    const defaultResponse = await fetch(
      `${this.supabaseUrl}/rest/v1/scripts?limit=1`,
      {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`
        }
      }
    );

    const defaultScripts = await defaultResponse.json();
    return defaultScripts[0].id;
  }

  async createTurn(turnNumber, phase, isFirstNight) {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/turns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        session_id: this.gameId,
        turn_number: turnNumber,
        phase,
        is_first_night: isFirstNight,
        started_at: new Date().toISOString()
      })
    });

    if (!response.ok && response.status !== 409) {
      // Ignore conflicts (turn already exists)
      throw new Error(`Failed to create turn: ${response.status}`);
    }
  }

  getTownsquareUrl(channelId) {
    const baseUrl = process.env.TOWNSQUARE_URL || 'http://localhost:8082';
    return `${baseUrl}/#${channelId}`;
  }
}

module.exports = GameManager;

