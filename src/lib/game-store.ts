import { GameState, generateRoomCode, generatePlayerId, distributeRoles, checkWinCondition, NightActions, GamePhase } from './game-types';

// In-memory game store
const games = new Map<string, GameState>();

export function createRoom(hostName: string): GameState {
  const code = generateRoomCode();
  const hostId = generatePlayerId();

  const game: GameState = {
    code,
    hostId,
    players: [{
      id: hostId,
      name: hostName,
      role: undefined,
      isAlive: true,
      sniperUsed: false,
    }],
    settings: {
      mafia: 2,
      doctors: 1,
      snipers: 1,
      investigators: 1,
    },
    phase: 'waiting',
    round: 0,
    nightActions: {
      kills: [],
      saves: [],
      sniperTarget: undefined,
      sniperShooter: undefined,
      investigations: [],
      mafiaVotes: {},
      doctorSaves: {},
      investigatorChecks: {},
    },
    votes: {},
    eliminatedPlayers: [],
    lastNightKilled: [],
    lastNightSaved: [],
    lastNightSniped: undefined,
    lastVoteEliminated: undefined,
    winner: undefined,
    discussionTime: 180,
    nightActionsComplete: false,
  };

  games.set(code, game);
  return game;
}

export function getRoom(code: string): GameState | null {
  return games.get(code) || null;
}

export function joinRoom(code: string, playerName: string): GameState | { error: string } {
  const game = games.get(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.phase !== 'waiting') return { error: 'اللعبة بدأت بالفعل' };
  if (game.players.length >= 12) return { error: 'الغرفة ممتلئة' };
  if (game.players.some(p => p.name === playerName)) return { error: 'الاسم مستخدم بالفعل' };

  const playerId = generatePlayerId();
  game.players.push({
    id: playerId,
    name: playerName,
    role: undefined,
    isAlive: true,
    sniperUsed: false,
  });

  return game;
}

export function startGame(code: string, hostId: string): GameState | { error: string } {
  const game = games.get(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط الهوست يمكنه بدء اللعبة' };
  if (game.phase !== 'waiting') return { error: 'اللعبة بدأت بالفعل' };
  if (game.players.length < 8) return { error: 'يجب أن يكون هناك 8 لاعبين على الأقل' };

  const totalSpecial = game.settings.mafia + game.settings.doctors + game.settings.snipers + game.settings.investigators;
  if (totalSpecial > game.players.length) return { error: 'عدد الأدوار يتجاوز عدد اللاعبين' };

  game.players = distributeRoles(game.players, game.settings);
  game.phase = 'role-reveal';
  game.round = 1;

  return game;
}

export function updateSettings(code: string, hostId: string, settings: { mafia: number; doctors: number; snipers: number; investigators: number; discussionTime?: number }): GameState | { error: string } {
  const game = games.get(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط الهوست يمكنه تعديل الإعدادات' };
  if (game.phase !== 'waiting') return { error: 'لا يمكن تعديل الإعدادات بعد بدء اللعبة' };

  const totalSpecial = settings.mafia + settings.doctors + settings.snipers + settings.investigators;
  if (totalSpecial > game.players.length) return { error: 'عدد الأدوار يتجاوز عدد اللاعبين' };
  if (settings.mafia < 1) return { error: 'يجب أن يكون هناك مافيا واحد على الأقل' };

  game.settings = {
    mafia: settings.mafia,
    doctors: settings.doctors,
    snipers: settings.snipers,
    investigators: settings.investigators,
  };
  if (settings.discussionTime) {
    game.discussionTime = settings.discussionTime;
  }

  return game;
}

export function submitNightAction(
  code: string,
  playerId: string,
  action: { type: 'kill' | 'save' | 'shoot' | 'investigate'; targetId: string }
): GameState | { error: string } {
  const game = games.get(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.phase !== 'night') return { error: 'ليس الوقت المناسب لهذا الإجراء' };

  const player = game.players.find(p => p.id === playerId);
  if (!player) return { error: 'اللاعب غير موجود' };
  if (!player.isAlive) return { error: 'أنت خارج اللعبة' };

  const target = game.players.find(p => p.id === action.targetId);
  if (!target) return { error: 'الهدف غير موجود' };
  if (!target.isAlive) return { error: 'الهدف خارج اللعبة' };

  switch (action.type) {
    case 'kill':
      if (player.role !== 'mafia') return { error: 'فقط المافيا يمكنها القتل' };
      game.nightActions.mafiaVotes[playerId] = action.targetId;
      break;

    case 'save':
      if (player.role !== 'doctor') return { error: 'فقط الطبيب يمكنه الإنقاذ' };
      game.nightActions.doctorSaves[playerId] = action.targetId;
      break;

    case 'shoot':
      if (player.role !== 'sniper') return { error: 'فقط القناص يمكنه الإطلاق' };
      if (player.sniperUsed) return { error: 'لقد استخدمت رصاصتك بالفعل' };
      game.nightActions.sniperTarget = action.targetId;
      game.nightActions.sniperShooter = playerId;
      break;

    case 'investigate':
      if (player.role !== 'investigator') return { error: 'فقط المحقق يمكنه التحقيق' };
      game.nightActions.investigatorChecks[playerId] = action.targetId;
      const isMafia = target.role === 'mafia';
      game.nightActions.investigations.push({
        playerId: action.targetId,
        investigatorId: playerId,
        isMafia,
      });
      break;
  }

  // Check if all night actions are complete
  checkNightActionsComplete(game);

  return game;
}

function checkNightActionsComplete(game: GameState): void {
  const aliveMafia = game.players.filter(p => p.role === 'mafia' && p.isAlive);
  const aliveDoctors = game.players.filter(p => p.role === 'doctor' && p.isAlive);
  const aliveSnipers = game.players.filter(p => p.role === 'sniper' && p.isAlive && !p.sniperUsed);
  const aliveInvestigators = game.players.filter(p => p.role === 'investigator' && p.isAlive);

  const allMafiaVoted = aliveMafia.every(m => game.nightActions.mafiaVotes[m.id]);
  const allDoctorsSaved = aliveDoctors.every(d => game.nightActions.doctorSaves[d.id]);
  const allInvestigatorsChecked = aliveInvestigators.every(i => game.nightActions.investigatorChecks[i.id]);
  // Sniper can choose not to shoot, so we don't require them to act
  const sniperActioned = aliveSnipers.length === 0 || game.nightActions.sniperTarget !== undefined || true;

  game.nightActionsComplete = allMafiaVoted && allDoctorsSaved && allInvestigatorsChecked && sniperActioned;
}

export function resolveNight(code: string, hostId: string): GameState | { error: string } {
  const game = games.get(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط الهوست يمكنه إنهاء الليل' };
  if (game.phase !== 'night') return { error: 'ليس الوقت المناسب' };

  // Resolve mafia kills - majority vote
  const mafiaVotes = game.nightActions.mafiaVotes;
  const voteCounts: Record<string, number> = {};

  Object.values(mafiaVotes).forEach(targetId => {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  });

  let maxVotes = 0;
  let killTarget = '';
  Object.entries(voteCounts).forEach(([targetId, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      killTarget = targetId;
    }
  });

  const killed: string[] = [];
  const saved: string[] = [];

  // Check if the kill target was saved by a doctor
  const doctorSaves = Object.values(game.nightActions.doctorSaves);
  if (killTarget) {
    if (doctorSaves.includes(killTarget)) {
      saved.push(killTarget);
    } else {
      killed.push(killTarget);
    }
  }

  // Handle sniper shot
  let sniped: string | undefined;
  if (game.nightActions.sniperTarget) {
    const sniperPlayer = game.players.find(p => p.id === game.nightActions.sniperShooter);
    if (sniperPlayer && !sniperPlayer.sniperUsed) {
      sniped = game.nightActions.sniperTarget;
      sniperPlayer.sniperUsed = true;
      // Check if sniper target was saved by doctor
      if (doctorSaves.includes(sniped)) {
        saved.push(sniped);
        sniped = undefined;
      } else {
        killed.push(sniped);
      }
    }
  }

  // Apply deaths
  killed.forEach(playerId => {
    const player = game.players.find(p => p.id === playerId);
    if (player) {
      player.isAlive = false;
      game.eliminatedPlayers.push(playerId);
    }
  });

  game.lastNightKilled = killed;
  game.lastNightSaved = saved;
  game.lastNightSniped = sniped;
  game.lastVoteEliminated = undefined;

  // Check win condition
  const winner = checkWinCondition(game);
  if (winner) {
    game.phase = 'gameover';
    game.winner = winner;
  } else {
    game.phase = 'night-result';
  }

  return game;
}

export function advanceToDay(code: string, hostId: string): GameState | { error: string } {
  const game = games.get(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط الهوست يمكنه المتابعة' };
  if (game.phase !== 'night-result') return { error: 'ليس الوقت المناسب' };

  game.phase = 'day-discussion';
  game.votes = {};
  game.lastVoteEliminated = undefined;

  return game;
}

export function startVoting(code: string, hostId: string): GameState | { error: string } {
  const game = games.get(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط الهوست يمكنه بدء التصويت' };
  if (game.phase !== 'day-discussion') return { error: 'ليس الوقت المناسب' };

  game.phase = 'day-voting';
  game.votes = {};

  return game;
}

export function submitVote(code: string, playerId: string, targetId: string): GameState | { error: string } {
  const game = games.get(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.phase !== 'day-voting') return { error: 'ليس وقت التصويت' };

  const player = game.players.find(p => p.id === playerId);
  if (!player) return { error: 'اللاعب غير موجود' };
  if (!player.isAlive) return { error: 'لا يمكنك التصويت وأنت خارج اللعبة' };

  if (targetId !== 'skip') {
    const target = game.players.find(p => p.id === targetId);
    if (!target) return { error: 'الهدف غير موجود' };
    if (!target.isAlive) return { error: 'لا يمكنك التصويت ضد لاعب خارج اللعبة' };
  }

  game.votes[playerId] = targetId;

  return game;
}

export function resolveVotes(code: string, hostId: string): GameState | { error: string } {
  const game = games.get(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط الهوست يمكنه إنهاء التصويت' };
  if (game.phase !== 'day-voting') return { error: 'ليس وقت التصويت' };

  // Count votes
  const voteCounts: Record<string, number> = {};
  Object.values(game.votes).forEach(targetId => {
    if (targetId !== 'skip') {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }
  });

  let maxVotes = 0;
  let eliminated = '';
  let tie = false;

  Object.entries(voteCounts).forEach(([targetId, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      eliminated = targetId;
      tie = false;
    } else if (count === maxVotes) {
      tie = true;
    }
  });

  // In case of tie or no votes, no one is eliminated
  if (tie || !eliminated || maxVotes === 0) {
    game.lastVoteEliminated = undefined;
  } else {
    const player = game.players.find(p => p.id === eliminated);
    if (player) {
      player.isAlive = false;
      game.eliminatedPlayers.push(eliminated);
      game.lastVoteEliminated = eliminated;
    }
  }

  // Check win condition
  const winner = checkWinCondition(game);
  if (winner) {
    game.phase = 'gameover';
    game.winner = winner;
  } else {
    game.phase = 'vote-result';
  }

  return game;
}

export function advanceToNight(code: string, hostId: string): GameState | { error: string } {
  const game = games.get(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط الهوست يمكنه المتابعة' };
  if (game.phase !== 'vote-result') return { error: 'ليس الوقت المناسب' };

  game.phase = 'night';
  game.round += 1;
  game.nightActions = {
    kills: [],
    saves: [],
    sniperTarget: undefined,
    sniperShooter: undefined,
    investigations: [],
    mafiaVotes: {},
    doctorSaves: {},
    investigatorChecks: {},
  };
  game.votes = {};
  game.nightActionsComplete = false;

  return game;
}

export function getPlayerInvestigation(code: string, playerId: string): { isMafia: boolean } | { error: string } {
  const game = games.get(code);
  if (!game) return { error: 'الغرفة غير موجودة' };

  const investigation = game.nightActions.investigations.find(
    inv => inv.investigatorId === playerId
  );
  if (!investigation) return { error: 'لا يوجد تحقيق' };

  return { isMafia: investigation.isMafia };
}

// Get public game state (without revealing secrets)
export function getPublicGameState(code: string, playerId?: string): Partial<GameState> & { playerRole?: string; playerInvestigation?: { isMafia: boolean } | null; mafiaBuddies?: string[] } | null {
  const game = games.get(code);
  if (!game) return null;

  const base: any = {
    code: game.code,
    hostId: game.hostId,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      isAlive: p.isAlive,
      role: game.phase === 'gameover' ? p.role : undefined,
    })),
    settings: game.settings,
    phase: game.phase,
    round: game.round,
    eliminatedPlayers: game.eliminatedPlayers,
    lastNightKilled: game.lastNightKilled,
    lastNightSaved: game.lastNightSaved,
    lastNightSniped: game.lastNightSniped,
    lastVoteEliminated: game.lastVoteEliminated,
    winner: game.winner,
    discussionTime: game.discussionTime,
    nightActionsComplete: game.nightActionsComplete,
    votes: game.phase === 'day-voting' || game.phase === 'vote-result'
      ? game.votes
      : {},
  };

  if (playerId) {
    const player = game.players.find(p => p.id === playerId);
    if (player) {
      base.playerRole = player.role;
      base.playerSniperUsed = player.sniperUsed;
      base.playerIsAlive = player.isAlive;

      // If mafia, show other mafia members
      if (player.role === 'mafia') {
        base.mafiaBuddies = game.players
          .filter(p => p.role === 'mafia' && p.id !== playerId)
          .map(p => p.name);
      }

      // If investigator, show investigation result
      const investigation = game.nightActions.investigations.find(
        inv => inv.investigatorId === playerId
      );
      base.playerInvestigation = investigation ? { isMafia: investigation.isMafia } : null;
    }
  }

  return base;
}
