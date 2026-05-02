export type Role = 'mafia' | 'doctor' | 'sniper' | 'investigator' | 'citizen';

export type GamePhase = 'waiting' | 'role-reveal' | 'night' | 'night-result' | 'day-discussion' | 'day-voting' | 'vote-result' | 'justification' | 'day-revoting' | 'final-vote-result' | 'gameover';

export interface Player {
  id: string;
  name: string;
  role?: Role;
  isAlive: boolean;
  sniperUsed: boolean;
  isSilenced?: boolean; // Silenced by mafia - can't vote during day
}

export interface GameSettings {
  mafia: number;
  doctors: number;
  snipers: number;
  investigators: number;
}

export interface InvestigationResult {
  playerId: string;
  investigatorId: string;
  isMafia: boolean;
}

export interface NightActions {
  kills: string[];
  saves: string[];
  sniperTarget?: string;
  sniperShooter?: string;
  investigations: InvestigationResult[];
  mafiaVotes: Record<string, string>;        // mafiaId -> targetId (for kill)
  mafiaSilenceVotes: Record<string, string>; // mafiaId -> targetId (for silence)
  doctorSaves: Record<string, string>;
  investigatorChecks: Record<string, string>;
}

export interface MafiaChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
  round: number;
}

export interface PublicChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
  round: number;
}

export interface GameState {
  code: string;
  hostId: string;
  hostName: string;             // Host name (host is not a player)
  players: Player[];
  settings: GameSettings;
  phase: GamePhase;
  round: number;
  nightActions: NightActions;
  votes: Record<string, string>; // voterId -> targetId (or 'skip')
  eliminatedPlayers: string[];
  lastNightKilled: string[];
  lastNightSaved: string[];
  lastNightSniped?: string;
  lastNightSilenced: string[];   // Players silenced last night
  lastVoteEliminated?: string;
  winner?: 'mafia' | 'citizens';
  discussionTime: number;
  nightActionsComplete: boolean;
  sniperDied?: boolean;           // True if sniper died from shooting a citizen
  accusedPlayers: string[];       // Players who got most votes and need to justify
  isTie: boolean;                 // Whether there's a tie in the vote
  revotes: Record<string, string>; // voterId -> targetId (or 'skip') for revote
  justificationTime: number;      // Time in seconds for justification (default 60)
  mafiaChat: MafiaChatMessage[];  // Mafia-only chat messages
  publicChat: PublicChatMessage[];  // Public chat for all players during day
}

export const ROLE_INFO: Record<Role, { name: string; emoji: string; color: string; description: string }> = {
  mafia: {
    name: 'المافيا',
    emoji: '🔴',
    color: 'text-red-500',
    description: 'أنت من المافيا! اختر ضحية للقتل وشخصاً لتسكيت كل ليلة. حاول البقاء مخفياً خلال النقاش',
  },
  doctor: {
    name: 'الطبيب',
    emoji: '💚',
    color: 'text-green-500',
    description: 'أنت الطبيب! اختر شخصاً لإنقاذه كل ليلة. يمكنك إنقاذ نفسك',
  },
  sniper: {
    name: 'القناص',
    emoji: '🔵',
    color: 'text-blue-500',
    description: 'أنت القناص! لديك رصاصة واحدة فقط. إذا أصبت مواطناً بريئاً ستموت معه! اختر هدفك بحكمة',
  },
  investigator: {
    name: 'المحقق',
    emoji: '🟡',
    color: 'text-yellow-500',
    description: 'أنت المحقق! كل ليلة يمكنك التحقق من هوية شخص واحد',
  },
  citizen: {
    name: 'المواطن الصالح',
    emoji: '⚪',
    color: 'text-gray-300',
    description: 'أنت مواطن صالح! ساعد في اكتشاف المافيا والتصويت لإبعادهم',
  },
};

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function generatePlayerId(): string {
  return 'p_' + Math.random().toString(36).substring(2, 10);
}

export function distributeRoles(players: Player[], settings: GameSettings): Player[] {
  const roles: Role[] = [];

  for (let i = 0; i < settings.mafia; i++) roles.push('mafia');
  for (let i = 0; i < settings.doctors; i++) roles.push('doctor');
  for (let i = 0; i < settings.snipers; i++) roles.push('sniper');
  for (let i = 0; i < settings.investigators; i++) roles.push('investigator');

  while (roles.length < players.length) {
    roles.push('citizen');
  }

  // Shuffle roles
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  return players.map((player, index) => ({
    ...player,
    role: roles[index],
    isAlive: true,
    sniperUsed: false,
    isSilenced: false,
  }));
}

export function checkWinCondition(game: GameState): 'mafia' | 'citizens' | null {
  const alivePlayers = game.players.filter(p => p.isAlive);
  const aliveMafia = alivePlayers.filter(p => p.role === 'mafia');
  const aliveGood = alivePlayers.filter(p => p.role !== 'mafia');

  if (aliveMafia.length === 0) return 'citizens';
  if (aliveMafia.length >= aliveGood.length) return 'mafia';
  return null;
}
