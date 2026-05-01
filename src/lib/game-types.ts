export type Role = 'mafia' | 'doctor' | 'sniper' | 'investigator' | 'citizen';

export type GamePhase = 'waiting' | 'role-reveal' | 'night' | 'night-result' | 'day-discussion' | 'day-voting' | 'vote-result' | 'gameover';

export interface Player {
  id: string;
  name: string;
  role?: Role;
  isAlive: boolean;
  sniperUsed: boolean;
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
  kills: string[];        // target player IDs chosen by mafia
  saves: string[];        // player IDs chosen by doctors to save
  sniperTarget?: string;  // target player ID chosen by sniper
  sniperShooter?: string; // which sniper shot
  investigations: InvestigationResult[];
  mafiaVotes: Record<string, string>;  // mafiaId -> targetId
  doctorSaves: Record<string, string>; // doctorId -> savedId
  investigatorChecks: Record<string, string>; // investigatorId -> checkedId
}

export interface GameState {
  code: string;
  hostId: string;
  players: Player[];
  settings: GameSettings;
  phase: GamePhase;
  round: number;
  nightActions: NightActions;
  votes: Record<string, string>; // voterId -> targetId (or 'skip')
  eliminatedPlayers: string[];
  lastNightKilled: string[];     // player IDs killed last night (after saves)
  lastNightSaved: string[];      // player IDs saved last night
  lastNightSniped?: string;      // player ID sniped last night
  lastVoteEliminated?: string;   // player ID eliminated by vote
  winner?: 'mafia' | 'citizens';
  discussionTime: number;        // seconds for discussion
  nightActionsComplete: boolean; // whether all night actions are done
}

export const ROLE_INFO: Record<Role, { name: string; emoji: string; color: string; description: string }> = {
  mafia: {
    name: 'المافيا',
    emoji: '🔴',
    color: 'text-red-500',
    description: 'أنت من المافيا! اختر ضحيتك كل ليلة. حاول البقاء مخفياً خلال النقاش',
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
    description: 'أنت القناص! لديك رصاصة واحدة فقط. اختر هدفك بحكمة',
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
