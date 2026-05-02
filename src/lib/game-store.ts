import { GameState, generateRoomCode, generatePlayerId, distributeRoles, checkWinCondition, GamePhase, MafiaChatMessage, PublicChatMessage, JustificationChatMessage } from './game-types';
import { Redis } from '@upstash/redis';

const GAME_PREFIX = 'spygame:';
const GAME_TTL = 86400; // 24 hours

function createRedisClient(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn('[SpyGame] Redis not configured.');
    return null;
  }
  try {
    return new Redis({ url, token });
  } catch (err) {
    console.error('[SpyGame] Failed to initialize Redis:', err);
    return null;
  }
}

let _redis: Redis | null | undefined = undefined;
function getRedis(): Redis | null {
  if (_redis === undefined) _redis = createRedisClient();
  return _redis;
}

const games = new Map<string, GameState>();

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

async function getGame(code: string): Promise<GameState | null> {
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.get<GameState>(`${GAME_PREFIX}${code}`);
    } catch (err) {
      console.error('[SpyGame] Redis get error:', err);
      if (isProduction()) return null;
      return games.get(code) || null;
    }
  }
  if (isProduction()) return null;
  return games.get(code) || null;
}

async function saveGame(game: GameState): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`${GAME_PREFIX}${game.code}`, game, { ex: GAME_TTL });
      return;
    } catch (err) {
      console.error('[SpyGame] Redis set error:', err);
      if (isProduction()) throw new Error('Failed to save game data.');
    }
  }
  if (isProduction()) throw new Error('No Redis available in production!');
  games.set(game.code, game);
}

export function isRedisConfigured(): boolean {
  return getRedis() !== null;
}

// ====== CREATE ROOM - Host is a spectator, NOT a player ======
export async function createRoom(hostName: string, options?: { isBotHost?: boolean }): Promise<GameState> {
  const code = generateRoomCode();
  const hostId = generatePlayerId();

  const game: GameState = {
    code,
    hostId,
    hostName: hostName,
    players: [], // Host is NOT a player
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
      mafiaSilenceVotes: {},
      doctorSaves: {},
      investigatorChecks: {},
    },
    votes: {},
    eliminatedPlayers: [],
    lastNightKilled: [],
    lastNightSaved: [],
    lastNightSniped: undefined,
    lastNightSilenced: [],
    lastVoteEliminated: undefined,
    winner: undefined,
    discussionTime: 180,
    votingTime: 120,
    votingTimerStartedAt: undefined,
    nightActionsComplete: false,
    sniperDied: false,
    accusedPlayers: [],
    isTie: false,
    revotes: {},
    justificationTime: 60,
    mafiaChat: [],
    publicChat: [],
    justificationChat: [],
    isBotHost: options?.isBotHost || false,
    lastDoctorSaveTargets: {},
  };

  await saveGame(game);
  return game;
}

export async function getRoom(code: string): Promise<GameState | null> {
  return getGame(code);
}

export async function joinRoom(code: string, playerName: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة - تأكد من صحة الرمز' };
  if (game.phase !== 'waiting') return { error: 'اللعبة بدأت بالفعل' };
  if (game.players.length >= 12) return { error: 'الغرفة ممتلئة' };
  if (game.players.some(p => p.name === playerName)) return { error: 'الاسم مستخدم بالفعل' };
  if (game.hostName === playerName) return { error: 'هذا الاسم محجوز للمراقب' };

  const playerId = generatePlayerId();
  game.players.push({
    id: playerId,
    name: playerName,
    role: undefined,
    isAlive: true,
    sniperUsed: false,
    isSilenced: false,
    doctorSelfSaveUsed: false,
  });

  await saveGame(game);
  return game;
}

export async function startGame(code: string, hostId: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط المراقب يمكنه بدء اللعبة' };
  if (game.phase !== 'waiting') return { error: 'اللعبة بدأت بالفعل' };
  if (game.players.length < 8) return { error: 'يجب أن يكون هناك 8 لاعبين على الأقل' };

  const totalSpecial = game.settings.mafia + game.settings.doctors + game.settings.snipers + game.settings.investigators;
  if (totalSpecial > game.players.length) return { error: 'عدد الأدوار يتجاوز عدد اللاعبين' };

  game.players = distributeRoles(game.players, game.settings);
  game.phase = 'role-reveal';
  game.round = 1;

  await saveGame(game);
  return game;
}

export async function updateSettings(code: string, hostId: string, settings: { mafia: number; doctors: number; snipers: number; investigators: number; discussionTime?: number; votingTime?: number }): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط المراقب يمكنه تعديل الإعدادات' };
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
  if (settings.votingTime) {
    game.votingTime = settings.votingTime;
  }

  await saveGame(game);
  return game;
}

// ====== NIGHT ACTIONS - Now includes 'silence' for mafia ======
export async function submitNightAction(
  code: string,
  playerId: string,
  action: { type: 'kill' | 'save' | 'shoot' | 'investigate' | 'silence'; targetId: string }
): Promise<GameState | { error: string }> {
  const game = await getGame(code);
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

    case 'silence':
      if (player.role !== 'mafia') return { error: 'فقط المافيا يمكنها التسكيت' };
      if (action.targetId === playerId) return { error: 'لا يمكنك تسكيت نفسك' };
      game.nightActions.mafiaSilenceVotes[playerId] = action.targetId;
      break;

    case 'save':
      if (player.role !== 'doctor') return { error: 'فقط الطبيب يمكنه الإنقاذ' };
      // Can't save yourself more than once per game
      if (action.targetId === playerId) {
        if (player.doctorSelfSaveUsed) return { error: 'لا يمكنك إنقاذ نفسك أكثر من مرة في اللعبة' };
      }
      // Can't save the same person two rounds in a row
      const lastSave = game.lastDoctorSaveTargets[playerId];
      if (lastSave && lastSave === action.targetId) {
        return { error: 'لا يمكنك إنقاذ نفس الشخص مرتين متتاليتين' };
      }
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

  checkNightActionsComplete(game);
  await saveGame(game);
  return game;
}

function checkNightActionsComplete(game: GameState): void {
  const aliveMafia = game.players.filter(p => p.role === 'mafia' && p.isAlive);
  const aliveDoctors = game.players.filter(p => p.role === 'doctor' && p.isAlive);
  const aliveSnipers = game.players.filter(p => p.role === 'sniper' && p.isAlive && !p.sniperUsed);
  const aliveInvestigators = game.players.filter(p => p.role === 'investigator' && p.isAlive);

  const allMafiaVotedKill = aliveMafia.every(m => game.nightActions.mafiaVotes[m.id]);
  const allMafiaVotedSilence = aliveMafia.every(m => game.nightActions.mafiaSilenceVotes[m.id]);
  const allDoctorsSaved = aliveDoctors.every(d => game.nightActions.doctorSaves[d.id]);
  const allInvestigatorsChecked = aliveInvestigators.every(i => game.nightActions.investigatorChecks[i.id]);
  const sniperActioned = aliveSnipers.length === 0 || game.nightActions.sniperTarget !== undefined;

  game.nightActionsComplete = allMafiaVotedKill && allMafiaVotedSilence && allDoctorsSaved && allInvestigatorsChecked && sniperActioned;
}

// ====== RESOLVE NIGHT - Includes silencing and sniper penalty ======
export async function resolveNight(code: string, hostId: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط المراقب يمكنه إنهاء الليل' };
  if (game.phase !== 'night') return { error: 'ليس الوقت المناسب' };

  // 1. Resolve mafia KILL (majority vote - BUG FIX 5: no kill if tie)
  const mafiaKillVotes = game.nightActions.mafiaVotes;
  const killVoteCounts: Record<string, number> = {};
  Object.values(mafiaKillVotes).forEach(targetId => {
    killVoteCounts[targetId] = (killVoteCounts[targetId] || 0) + 1;
  });
  let maxKillVotes = 0;
  let killTarget = '';
  let killTie = false;
  Object.entries(killVoteCounts).forEach(([targetId, count]) => {
    if (count > maxKillVotes) {
      maxKillVotes = count;
      killTarget = targetId;
      killTie = false;
    } else if (count === maxKillVotes && count > 0) {
      killTie = true;
    }
  });
  // If mafia disagree (tie), no one gets killed
  if (killTie) {
    killTarget = '';
  }

  // 2. Resolve mafia SILENCE (majority vote - BUG FIX 5: no silence if tie)
  const mafiaSilenceVotes = game.nightActions.mafiaSilenceVotes;
  const silenceVoteCounts: Record<string, number> = {};
  Object.values(mafiaSilenceVotes).forEach(targetId => {
    silenceVoteCounts[targetId] = (silenceVoteCounts[targetId] || 0) + 1;
  });
  let maxSilenceVotes = 0;
  let silenceTarget = '';
  let silenceTie = false;
  Object.entries(silenceVoteCounts).forEach(([targetId, count]) => {
    if (count > maxSilenceVotes) {
      maxSilenceVotes = count;
      silenceTarget = targetId;
      silenceTie = false;
    } else if (count === maxSilenceVotes && count > 0) {
      silenceTie = true;
    }
  });
  // If mafia disagree on silence (tie), no one gets silenced
  if (silenceTie) {
    silenceTarget = '';
  }

  // 3. Process kills and saves
  const killed: string[] = [];
  const saved: string[] = [];
  const doctorSaves = Object.values(game.nightActions.doctorSaves);

  // Mafia kill
  if (killTarget) {
    if (doctorSaves.includes(killTarget)) {
      saved.push(killTarget);
    } else {
      killed.push(killTarget);
    }
  }

  // 4. Process sniper shot
  let sniped: string | undefined;
  game.sniperDied = false;

  if (game.nightActions.sniperTarget) {
    const sniperPlayer = game.players.find(p => p.id === game.nightActions.sniperShooter);
    if (sniperPlayer && !sniperPlayer.sniperUsed) {
      const sniperTarget = game.nightActions.sniperTarget;
      const targetPlayer = game.players.find(p => p.id === sniperTarget);

      sniped = sniperTarget;
      sniperPlayer.sniperUsed = true;

      if (doctorSaves.includes(sniped)) {
        // Doctor saved the sniper's target
        saved.push(sniped);
        sniped = undefined;
      } else {
        // Target is hit
        killed.push(sniped);

        // If target is NOT mafia, sniper dies too!
        if (targetPlayer && targetPlayer.role !== 'mafia') {
          game.sniperDied = true;
          sniperPlayer.isAlive = false;
          game.eliminatedPlayers.push(sniperPlayer.id);
          killed.push(sniperPlayer.id);
        }
      }
    }
  }

  // 5. Apply deaths
  killed.forEach(playerId => {
    const player = game.players.find(p => p.id === playerId);
    if (player && player.isAlive) {
      player.isAlive = false;
      if (!game.eliminatedPlayers.includes(playerId)) {
        game.eliminatedPlayers.push(playerId);
      }
    }
  });

  // 6. Apply silencing (separate from kill - doctor can't prevent silence)
  const silenced: string[] = [];
  if (silenceTarget) {
    const silencedPlayer = game.players.find(p => p.id === silenceTarget);
    if (silencedPlayer && silencedPlayer.isAlive) {
      silencedPlayer.isSilenced = true;
      silenced.push(silenceTarget);
    }
  }

  // 7. Update doctor save tracking
  Object.entries(game.nightActions.doctorSaves).forEach(([docId, targetId]) => {
    game.lastDoctorSaveTargets[docId] = targetId;
    if (docId === targetId) {
      const doc = game.players.find(p => p.id === docId);
      if (doc) doc.doctorSelfSaveUsed = true;
    }
  });

  // 8. Update game state
  game.lastNightKilled = [...new Set(killed)];
  game.lastNightSaved = saved;
  game.lastNightSniped = sniped;
  game.lastNightSilenced = silenced;
  game.lastVoteEliminated = undefined;

  const winner = checkWinCondition(game);
  if (winner) {
    game.phase = 'gameover';
    game.winner = winner;
  } else {
    game.phase = 'night-result';
  }

  await saveGame(game);
  return game;
}

export async function advanceToDay(code: string, hostId: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط المراقب يمكنه المتابعة' };
  if (game.phase !== 'night-result') return { error: 'ليس الوقت المناسب' };

  game.phase = 'day-discussion';
  game.votes = {};
  game.lastVoteEliminated = undefined;

  await saveGame(game);
  return game;
}

export async function startVoting(code: string, hostId: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط المراقب يمكنه بدء التصويت' };
  if (game.phase !== 'day-discussion') return { error: 'ليس الوقت المناسب' };

  game.phase = 'day-voting';
  game.votes = {};
  game.votingTimerStartedAt = Date.now();

  await saveGame(game);
  return game;
}

export async function submitVote(code: string, playerId: string, targetId: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
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

  // BUG FIX 4: Prevent self-voting
  if (targetId === playerId) return { error: 'لا يمكنك التصويت ضد نفسك' };

  // BUG FIX 6: Prevent changing vote
  if (game.votes[playerId]) return { error: 'لقد صوّت بالفعل ولا يمكنه تغيير صوته' };

  game.votes[playerId] = targetId;

  await saveGame(game);
  return game;
}

// ====== RESOLVE FIRST VOTE - Find accused players, NO direct elimination ======
export async function resolveVotes(code: string, hostId: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط المراقب يمكنه إنهاء التصويت' };
  if (game.phase !== 'day-voting') return { error: 'ليس وقت التصويت' };

  const voteCounts: Record<string, number> = {};
  Object.values(game.votes).forEach(targetId => {
    if (targetId !== 'skip') {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }
  });

  let maxVotes = 0;
  const topPlayers: string[] = [];

  Object.entries(voteCounts).forEach(([targetId, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      topPlayers.length = 0;
      topPlayers.push(targetId);
    } else if (count === maxVotes) {
      topPlayers.push(targetId);
    }
  });

  // No votes or all skipped
  if (topPlayers.length === 0 || maxVotes === 0) {
    game.accusedPlayers = [];
    game.isTie = false;
    game.lastVoteEliminated = undefined;
    game.phase = 'vote-result';
    await saveGame(game);
    return game;
  }

  game.accusedPlayers = topPlayers;
  game.isTie = topPlayers.length > 1;

  // Move to vote-result first (show who got most votes)
  game.phase = 'vote-result';
  game.lastVoteEliminated = undefined;

  await saveGame(game);
  return game;
}

// ====== START JUSTIFICATION - Accused players defend themselves ======
export async function startJustification(code: string, hostId: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط المراقب يمكنه بدء التبرير' };
  if (game.phase !== 'vote-result') return { error: 'ليس الوقت المناسب' };
  if (game.accusedPlayers.length === 0) return { error: 'لا يوجد متهمون للتبرير' };

  game.phase = 'justification';
  game.justificationChat = [];

  await saveGame(game);
  return game;
}

// ====== START REVOTE - After justification, revote on accused only ======
export async function startRevote(code: string, hostId: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط المراقب يمكنه بدء إعادة التصويت' };
  if (game.phase !== 'justification') return { error: 'ليس الوقت المناسب' };
  if (game.accusedPlayers.length === 0) return { error: 'لا يوجد متهمون' };

  game.phase = 'day-revoting';
  game.revotes = {};
  game.votingTimerStartedAt = Date.now();

  await saveGame(game);
  return game;
}

// ====== SUBMIT REVOTE - Players vote on accused only ======
export async function submitRevote(code: string, playerId: string, targetId: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.phase !== 'day-revoting') return { error: 'ليس وقت إعادة التصويت' };

  const player = game.players.find(p => p.id === playerId);
  if (!player) return { error: 'اللاعب غير موجود' };
  if (!player.isAlive) return { error: 'لا يمكنك التصويت وأنت خارج اللعبة' };

  // Accused CAN vote in revote, but NOT on themselves
  if (targetId !== 'skip') {
    if (targetId === playerId) return { error: 'لا يمكنك التصويت ضد نفسك' };
    const target = game.players.find(p => p.id === targetId);
    if (!target || !target.isAlive) return { error: 'الهدف غير صالح' };
  }

  // BUG FIX 6: Prevent changing revote
  if (game.revotes[playerId]) return { error: 'لقد صوّت بالفعل ولا يمكنه تغيير صوته' };

  game.revotes[playerId] = targetId;

  await saveGame(game);
  return game;
}

// ====== RESOLVE FINAL VOTE - After revote, actually eliminate ======
export async function resolveFinalVotes(code: string, hostId: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط المراقب يمكنه إنهاء التصويت' };
  if (game.phase !== 'day-revoting') return { error: 'ليس وقت إعادة التصويت' };

  const voteCounts: Record<string, number> = {};
  Object.values(game.revotes).forEach(targetId => {
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

  // Only eliminate if clear majority (no tie)
  if (!tie && eliminated && maxVotes > 0) {
    const player = game.players.find(p => p.id === eliminated);
    if (player) {
      player.isAlive = false;
      game.eliminatedPlayers.push(eliminated);
      game.lastVoteEliminated = eliminated;
    }
  } else {
    game.lastVoteEliminated = undefined;
  }

  game.accusedPlayers = [];
  game.isTie = false;

  const winner = checkWinCondition(game);
  if (winner) {
    game.phase = 'gameover';
    game.winner = winner;
  } else {
    game.phase = 'final-vote-result';
  }

  await saveGame(game);
  return game;
}

// ====== ADVANCE FROM ROLE-REVEAL TO NIGHT (first round) ======
export async function advanceFromRoleReveal(code: string, hostId: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط المراقب يمكنه المتابعة' };
  if (game.phase !== 'role-reveal') return { error: 'ليس الوقت المناسب' };

  // Clear any silenced state and transition to night
  game.players.forEach(p => { p.isSilenced = false; });

  game.phase = 'night';
  game.nightActions = {
    kills: [],
    saves: [],
    sniperTarget: undefined,
    sniperShooter: undefined,
    investigations: [],
    mafiaVotes: {},
    mafiaSilenceVotes: {},
    doctorSaves: {},
    investigatorChecks: {},
  };
  game.votes = {};
  game.nightActionsComplete = false;
  game.sniperDied = false;
  // Clear mafia chat for new round
  game.mafiaChat = [];
  game.justificationChat = [];

  await saveGame(game);
  return game;
}

export async function advanceToNight(code: string, hostId: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.hostId !== hostId) return { error: 'فقط المراقب يمكنه المتابعة' };
  // Allow advancing from both 'final-vote-result' and 'vote-result' (when no accused)
  if (game.phase !== 'final-vote-result' && game.phase !== 'vote-result') return { error: 'ليس الوقت المناسب' };
  // If in vote-result phase, ensure there are no accused players
  if (game.phase === 'vote-result' && game.accusedPlayers.length > 0) return { error: 'يجب إكمال عملية التبرير أولاً' };

  // Clear silenced state
  game.players.forEach(p => { p.isSilenced = false; });

  game.phase = 'night';
  game.round += 1;
  game.nightActions = {
    kills: [],
    saves: [],
    sniperTarget: undefined,
    sniperShooter: undefined,
    investigations: [],
    mafiaVotes: {},
    mafiaSilenceVotes: {},
    doctorSaves: {},
    investigatorChecks: {},
  };
  game.votes = {};
  game.nightActionsComplete = false;
  game.sniperDied = false;
  // Clear mafia chat for new round
  game.mafiaChat = [];
  game.justificationChat = [];

  await saveGame(game);
  return game;
}

// ====== MAFIA CHAT - Private chat for mafia during night ======
export async function sendMafiaChatMessage(code: string, playerId: string, message: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.phase !== 'night') return { error: 'الدردشة متاحة فقط في الليل' };

  const player = game.players.find(p => p.id === playerId);
  if (!player) return { error: 'اللاعب غير موجود' };
  if (player.role !== 'mafia') return { error: 'فقط المافيا يمكنها الدردشة' };
  if (!player.isAlive) return { error: 'أنت خارج اللعبة' };
  if (!message.trim()) return { error: 'الرسالة فارغة' };
  if (message.length > 500) return { error: 'الرسالة طويلة جداً' };

  const chatMsg: MafiaChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    senderId: playerId,
    senderName: player.name,
    message: message.trim(),
    timestamp: Date.now(),
    round: game.round,
  };

  game.mafiaChat.push(chatMsg);

  // Keep only last 100 messages per round to avoid Redis bloat
  if (game.mafiaChat.length > 100) {
    game.mafiaChat = game.mafiaChat.slice(-100);
  }

  await saveGame(game);
  return game;
}

// ====== PUBLIC CHAT - Chat for all players during day ======
export async function sendPublicChatMessage(code: string, playerId: string, message: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };

  // Public chat available during day phases
  const dayPhases: GamePhase[] = ['day-discussion', 'day-voting', 'vote-result', 'justification', 'day-revoting', 'final-vote-result'];
  if (!dayPhases.includes(game.phase)) return { error: 'الدردشة العامة متاحة فقط خلال النهار' };

  const player = game.players.find(p => p.id === playerId);
  if (!player) return { error: 'اللاعب غير موجود' };
  if (!player.isAlive) return { error: 'أنت خارج اللعبة' };
  if (player.isSilenced) return { error: 'أنت مسكّت ولا يمكنك الدردشة' };
  if (!message.trim()) return { error: 'الرسالة فارغة' };
  if (message.length > 500) return { error: 'الرسالة طويلة جداً' };

  const chatMsg: PublicChatMessage = {
    id: `pub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    senderId: playerId,
    senderName: player.name,
    message: message.trim(),
    timestamp: Date.now(),
    round: game.round,
  };

  game.publicChat.push(chatMsg);

  // Keep only last 200 messages to avoid Redis bloat
  if (game.publicChat.length > 200) {
    game.publicChat = game.publicChat.slice(-200);
  }

  await saveGame(game);
  return game;
}

// ====== JUSTIFICATION CHAT - Text-based defense for accused players ======
export async function sendJustificationMessage(code: string, playerId: string, message: string): Promise<GameState | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };
  if (game.phase !== 'justification') return { error: 'ليس وقت التبرير' };

  const player = game.players.find(p => p.id === playerId);
  if (!player) return { error: 'اللاعب غير موجود' };
  if (!player.isAlive) return { error: 'أنت خارج اللعبة' };

  // Only accused players can send justification messages
  if (!game.accusedPlayers.includes(playerId)) return { error: 'فقط المتهم يمكنه التبرير' };

  if (!message.trim()) return { error: 'الرسالة فارغة' };
  if (message.length > 1000) return { error: 'الرسالة طويلة جداً' };

  const chatMsg: JustificationChatMessage = {
    id: `just_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    senderId: playerId,
    senderName: player.name,
    message: message.trim(),
    timestamp: Date.now(),
    round: game.round,
  };

  game.justificationChat.push(chatMsg);
  if (game.justificationChat.length > 100) {
    game.justificationChat = game.justificationChat.slice(-100);
  }

  await saveGame(game);
  return game;
}

export async function getPlayerInvestigation(code: string, playerId: string): Promise<{ isMafia: boolean } | { error: string }> {
  const game = await getGame(code);
  if (!game) return { error: 'الغرفة غير موجودة' };

  const investigation = game.nightActions.investigations.find(
    inv => inv.investigatorId === playerId
  );
  if (!investigation) return { error: 'لا يوجد تحقيق' };

  return { isMafia: investigation.isMafia };
}

// ====== PUBLIC GAME STATE - Host sees everything ======
export async function getPublicGameState(code: string, playerId?: string): Promise<Partial<GameState> & {
  playerRole?: string;
  playerSniperUsed?: boolean;
  playerIsAlive?: boolean;
  playerIsSilenced?: boolean;
  mafiaBuddies?: string[];
  playerInvestigation?: { isMafia: boolean } | null;
  isHost?: boolean;
  hostName?: string;
} | null> {
  const game = await getGame(code);
  if (!game) return null;

  const isHost = playerId === game.hostId;

  const base: any = {
    code: game.code,
    hostId: game.hostId,
    hostName: game.hostName,
    isHost,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      isAlive: p.isAlive,
      isSilenced: p.isSilenced,
      // Host sees all roles, players only see in gameover
      role: (isHost || game.phase === 'gameover') ? p.role : undefined,
    })),
    settings: game.settings,
    phase: game.phase,
    round: game.round,
    eliminatedPlayers: game.eliminatedPlayers,
    lastNightKilled: game.lastNightKilled,
    lastNightSaved: game.lastNightSaved,
    lastNightSniped: game.lastNightSniped,
    lastNightSilenced: game.lastNightSilenced,
    lastVoteEliminated: game.lastVoteEliminated,
    winner: game.winner,
    discussionTime: game.discussionTime,
    votingTime: game.votingTime,
    votingTimerStartedAt: game.votingTimerStartedAt,
    nightActionsComplete: game.nightActionsComplete,
    sniperDied: game.sniperDied,
    isBotHost: game.isBotHost,
    // BUG FIX 1+2: Hide individual votes from players - only host sees full votes
    // Players only see: total count and their own vote
    votes: isHost
      ? (game.phase === 'day-voting' || game.phase === 'vote-result' ? game.votes : {})
      : (game.phase === 'day-voting' || game.phase === 'vote-result'
          ? (playerId && game.votes[playerId] ? { [playerId]: game.votes[playerId] } : {})
          : {}),
    revotes: isHost
      ? (game.phase === 'day-revoting' || game.phase === 'final-vote-result' ? game.revotes : {})
      : (game.phase === 'day-revoting' || game.phase === 'final-vote-result'
          ? (playerId && game.revotes[playerId] ? { [playerId]: game.revotes[playerId] } : {})
          : {}),
    // Add vote counts for display (how many voted, without showing who voted for whom)
    voteCount: (game.phase === 'day-voting' || game.phase === 'vote-result')
      ? Object.keys(game.votes).length
      : 0,
    revoteCount: (game.phase === 'day-revoting' || game.phase === 'final-vote-result')
      ? Object.keys(game.revotes).length
      : 0,
    accusedPlayers: game.accusedPlayers,
    isTie: game.isTie,
    justificationTime: game.justificationTime,
    // Mafia chat: only mafia sees during night, host can see always
    mafiaChat: (() => {
      if (isHost) return game.mafiaChat;
      if (game.phase === 'night' && playerId) {
        const p = game.players.find(pl => pl.id === playerId);
        if (p?.role === 'mafia') return game.mafiaChat;
      }
      return [];
    })(),
    // Public chat: all players see during day phases, host sees always
    publicChat: (() => {
      if (isHost) return game.publicChat;
      // Players see public chat during day phases
      const dayPhases: GamePhase[] = ['day-discussion', 'day-voting', 'vote-result', 'justification', 'day-revoting', 'final-vote-result'];
      if (dayPhases.includes(game.phase)) return game.publicChat;
      return [];
    })(),
    // Justification chat: all players see during justification phase
    justificationChat: game.phase === 'justification' ? game.justificationChat : [],
  };

  // Host-specific: show all night action details
  if (isHost && game.phase === 'night') {
    base.nightActionDetails = {
      mafiaVotes: game.nightActions.mafiaVotes,
      mafiaSilenceVotes: game.nightActions.mafiaSilenceVotes,
      doctorSaves: game.nightActions.doctorSaves,
      sniperTarget: game.nightActions.sniperTarget,
      sniperShooter: game.nightActions.sniperShooter,
      investigatorChecks: game.nightActions.investigatorChecks,
    };
  }

  if (playerId && !isHost) {
    const player = game.players.find(p => p.id === playerId);
    if (player) {
      base.playerRole = player.role;
      base.playerSniperUsed = player.sniperUsed;
      base.playerIsAlive = player.isAlive;
      base.playerIsSilenced = player.isSilenced;

      if (player.role === 'mafia') {
        base.mafiaBuddies = game.players
          .filter(p => p.role === 'mafia' && p.id !== playerId)
          .map(p => p.name);
      }

      // Doctor-specific data
      if (player.role === 'doctor') {
        base.doctorSelfSaveUsed = player.doctorSelfSaveUsed;
        base.lastDoctorSaveTarget = game.lastDoctorSaveTargets[playerId];
      }

      const investigation = game.nightActions.investigations.find(
        inv => inv.investigatorId === playerId
      );
      base.playerInvestigation = investigation ? { isMafia: investigation.isMafia } : null;
    }
  }

  return base;
}
