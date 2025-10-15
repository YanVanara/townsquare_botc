/**
 * Event Parser
 * 
 * Parses TownSquare WebSocket messages into structured event objects.
 */

class EventParser {
  constructor() {
    this.playerNames = [];
  }

  parse(command, params) {
    const parser = this[`parse_${command}`];
    
    if (parser) {
      return parser.call(this, params);
    }
    
    // Unknown event type
    return {
      type: command,
      description: 'Unknown event',
      trackable: false,
      critical: false,
      important: false,
      details: params
    };
  }

  // Gamestate update - full game state received
  parse_gs(params) {
    const { gamestate, isNight, nomination, markedPlayer, isVoteInProgress } = params;
    
    // Store player names for reference
    if (gamestate) {
      this.playerNames = gamestate.map(p => p.name);
    }
    
    return {
      type: 'gamestate',
      description: `Full gamestate received (${gamestate?.length || 0} players)`,
      trackable: true,
      critical: false,
      important: true,
      details: {
        playerCount: gamestate?.length,
        isNight,
        hasNomination: !!nomination,
        markedPlayer: markedPlayer >= 0 ? this.playerNames[markedPlayer] : null
      },
      data: {
        players: gamestate,
        isNight,
        nomination,
        markedPlayer,
        isVoteInProgress
      }
    };
  }

  // Player update - role, status, etc.
  parse_player(params) {
    const { index, property, value } = params;
    const playerName = this.playerNames[index] || `Seat ${index + 1}`;
    
    let description;
    let critical = false;
    let important = false;
    
    switch (property) {
      case 'isDead':
        description = value 
          ? `${playerName} died` 
          : `${playerName} was revived`;
        critical = true;
        break;
      case 'role':
        description = value 
          ? `${playerName} assigned role: ${value}` 
          : `${playerName} role cleared`;
        important = true;
        break;
      case 'name':
        description = `Player renamed to ${value}`;
        this.playerNames[index] = value;
        break;
      case 'id':
        description = value 
          ? `${playerName} claimed seat ${index + 1}` 
          : `${playerName} left seat ${index + 1}`;
        important = true;
        break;
      case 'isVoteless':
        description = `${playerName} ${value ? 'lost' : 'regained'} vote`;
        important = true;
        break;
      default:
        description = `${playerName} ${property} = ${value}`;
    }
    
    return {
      type: 'player_update',
      description,
      trackable: true,
      critical,
      important,
      details: {
        player: playerName,
        seat: index,
        property,
        value
      },
      data: { index, property, value }
    };
  }

  // Edition/script change
  parse_edition(params) {
    const { edition } = params;
    return {
      type: 'edition',
      description: `Script changed to ${edition.name || edition.id}`,
      trackable: true,
      critical: false,
      important: true,
      details: {
        edition: edition.name || edition.id
      },
      data: params
    };
  }

  // Nomination started/ended
  parse_nomination(params) {
    if (!params) {
      return {
        type: 'nomination_end',
        description: 'Nomination ended',
        trackable: true,
        critical: false,
        important: true,
        details: {},
        data: null
      };
    }
    
    const [nominatorIndex, nomineeIndex] = params;
    const nominator = this.playerNames[nominatorIndex] || `Seat ${nominatorIndex + 1}`;
    const nominee = this.playerNames[nomineeIndex] || `Seat ${nomineeIndex + 1}`;
    
    return {
      type: 'nomination',
      description: `${nominator} nominated ${nominee}`,
      trackable: true,
      critical: false,
      important: true,
      details: {
        nominator,
        nominee,
        nominatorSeat: nominatorIndex,
        nomineeSeat: nomineeIndex
      },
      data: params
    };
  }

  // Vote cast
  parse_vote(params) {
    const [index, vote, fromST] = params;
    const voter = this.playerNames[index] || `Seat ${index + 1}`;
    
    return {
      type: 'vote',
      description: `${voter} voted ${vote ? 'YES' : 'NO'}${fromST ? ' (from ST)' : ''}`,
      trackable: true,
      critical: false,
      important: false,
      details: {
        voter,
        seat: index,
        vote,
        fromStoryteller: fromST
      },
      data: params
    };
  }

  // Vote locked
  parse_lock(params) {
    const [lock, vote] = params;
    return {
      type: 'vote_lock',
      description: `Vote locked at position ${lock}`,
      trackable: true,
      critical: false,
      important: false,
      details: { lock, vote },
      data: params
    };
  }

  // Player swap
  parse_swap(params) {
    const [from, to] = params;
    const player1 = this.playerNames[from] || `Seat ${from + 1}`;
    const player2 = this.playerNames[to] || `Seat ${to + 1}`;
    
    // Update internal mapping
    [this.playerNames[from], this.playerNames[to]] = [this.playerNames[to], this.playerNames[from]];
    
    return {
      type: 'swap',
      description: `${player1} swapped with ${player2}`,
      trackable: true,
      critical: false,
      important: true,
      details: {
        fromSeat: from,
        toSeat: to,
        player1,
        player2
      },
      data: params
    };
  }

  // Player move
  parse_move(params) {
    const [from, to] = params;
    const player = this.playerNames[from] || `Player`;
    
    return {
      type: 'move',
      description: `${player} moved from seat ${from + 1} to seat ${to + 1}`,
      trackable: true,
      critical: false,
      important: true,
      details: {
        player,
        fromSeat: from,
        toSeat: to
      },
      data: params
    };
  }

  // Player removed
  parse_remove(params) {
    const player = this.playerNames[params] || `Seat ${params + 1}`;
    
    return {
      type: 'remove',
      description: `${player} removed from game`,
      trackable: true,
      critical: false,
      important: true,
      details: {
        player,
        seat: params
      },
      data: params
    };
  }

  // Player marked (on the block)
  parse_marked(params) {
    const player = params >= 0 
      ? (this.playerNames[params] || `Seat ${params + 1}`)
      : null;
    
    return {
      type: 'marked',
      description: player 
        ? `${player} is on the block` 
        : 'No player on the block',
      trackable: true,
      critical: false,
      important: true,
      details: {
        player,
        seat: params
      },
      data: params
    };
  }

  // Day/Night toggle
  parse_isNight(params) {
    return {
      type: 'phase_change',
      description: params ? 'Night has fallen' : 'Day has broken',
      trackable: true,
      critical: false,
      important: true,
      details: {
        isNight: params
      },
      data: params
    };
  }

  // Vote in progress
  parse_isVoteInProgress(params) {
    return {
      type: 'vote_status',
      description: params ? 'Voting started' : 'Voting ended',
      trackable: true,
      critical: false,
      important: false,
      details: {
        inProgress: params
      },
      data: params
    };
  }

  // Voting speed changed
  parse_votingSpeed(params) {
    return {
      type: 'voting_speed',
      description: `Voting speed set to ${params}ms`,
      trackable: false,
      critical: false,
      important: false,
      details: {
        speed: params
      },
      data: params
    };
  }

  // Fabled characters
  parse_fabled(params) {
    return {
      type: 'fabled',
      description: `Fabled characters updated (${params?.length || 0})`,
      trackable: true,
      critical: false,
      important: true,
      details: {
        count: params?.length,
        fabled: params
      },
      data: params
    };
  }

  // Ping (heartbeat)
  parse_ping(params) {
    const [playerIdOrCount, latency] = params || [];
    return {
      type: 'ping',
      description: `Ping (${playerIdOrCount} players, ${latency}ms latency)`,
      trackable: false,
      critical: false,
      important: false,
      details: {
        playerCount: playerIdOrCount,
        latency
      },
      data: params
    };
  }

  // Claim seat
  parse_claim(params) {
    const [index, playerId] = params;
    const player = this.playerNames[index] || 'Player';
    
    return {
      type: 'claim',
      description: index >= 0 
        ? `${player} claimed seat ${index + 1}` 
        : `Player ${playerId} vacated seat`,
      trackable: true,
      critical: false,
      important: true,
      details: {
        player,
        seat: index,
        playerId
      },
      data: params
    };
  }

  // Player disconnected
  parse_bye(params) {
    return {
      type: 'disconnect',
      description: `Player ${params} disconnected`,
      trackable: false,
      critical: false,
      important: false,
      details: {
        playerId: params
      },
      data: params
    };
  }

  // Vote history
  parse_clearVoteHistory() {
    return {
      type: 'vote_history_clear',
      description: 'Vote history cleared',
      trackable: false,
      critical: false,
      important: false,
      details: {},
      data: null
    };
  }

  parse_isVoteHistoryAllowed(params) {
    return {
      type: 'vote_history_setting',
      description: `Vote history ${params ? 'allowed' : 'disabled'}`,
      trackable: false,
      critical: false,
      important: false,
      details: {
        allowed: params
      },
      data: params
    };
  }

  // Pronouns update
  parse_pronouns(params) {
    const [index, pronouns] = params;
    const player = this.playerNames[index] || `Seat ${index + 1}`;
    
    return {
      type: 'pronouns',
      description: `${player} pronouns: ${pronouns}`,
      trackable: false,
      critical: false,
      important: false,
      details: {
        player,
        seat: index,
        pronouns
      },
      data: params
    };
  }

  // Tracker events - special events for data collection
  parse_tracker(params) {
    const { type } = params;
    
    switch (type) {
      case 'roleAssignment':
        return {
          type: 'role_assignment',
          description: `🎭 ${params.playerName} (seat ${params.index + 1}) assigned role: ${params.roleName} (${params.team})`,
          trackable: true,
          critical: true,
          important: true,
          details: {
            player: params.playerName,
            seat: params.index,
            role: params.roleName,
            roleId: params.roleId,
            team: params.team
          },
          data: params
        };
      
      case 'allRoles':
        const roleList = params.players.map(p => 
          `${p.playerName}: ${p.roleName} (${p.team})`
        ).join(', ');
        return {
          type: 'all_roles_assigned',
          description: `🎭🎭🎭 ALL ROLES ASSIGNED - ${params.players.length} players`,
          trackable: true,
          critical: true,
          important: true,
          details: {
            playerCount: params.players.length,
            roles: params.players
          },
          data: params
        };
      
      case 'reminders':
        return {
          type: 'reminders_update',
          description: `🏷️  ${params.playerName} (seat ${params.index + 1}) tokens: [${params.reminders.join(', ')}]`,
          trackable: true,
          critical: true,
          important: true,
          details: {
            player: params.playerName,
            seat: params.index,
            tokens: params.reminders
          },
          data: params
        };
      
      case 'demonBluffs':
        const bluffList = params.bluffs.map(b => b.roleName).join(', ');
        return {
          type: 'demon_bluffs',
          description: `👹 DEMON BLUFFS: ${bluffList || 'None'}`,
          trackable: true,
          critical: true,
          important: true,
          details: {
            bluffCount: params.bluffs.length,
            bluffs: params.bluffs
          },
          data: params
        };
      
      default:
        return {
          type: 'tracker_unknown',
          description: `Tracker event: ${type}`,
          trackable: true,
          critical: false,
          important: true,
          details: params,
          data: params
        };
    }
  }
}

module.exports = EventParser;

