'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import { ROLE_INFO, type GamePhase, type Role } from '@/lib/game-types';

interface GamePlayer {
  id: string;
  name: string;
  isAlive: boolean;
  isSilenced?: boolean;
  role?: Role;
}

interface NightActionDetails {
  mafiaVotes: Record<string, string>;
  mafiaSilenceVotes: Record<string, string>;
  doctorSaves: Record<string, string>;
  sniperTarget?: string;
  sniperShooter?: string;
  investigatorChecks: Record<string, string>;
}

interface GameStateView {
  code: string;
  hostId: string;
  hostName?: string;
  isHost?: boolean;
  players: GamePlayer[];
  settings: { mafia: number; doctors: number; snipers: number; investigators: number };
  phase: GamePhase;
  round: number;
  eliminatedPlayers: string[];
  lastNightKilled: string[];
  lastNightSaved: string[];
  lastNightSniped?: string;
  lastNightSilenced: string[];
  lastVoteEliminated?: string;
  winner?: 'mafia' | 'citizens';
  discussionTime: number;
  nightActionsComplete: boolean;
  sniperDied?: boolean;
  playerRole?: Role;
  playerSniperUsed?: boolean;
  playerIsAlive?: boolean;
  playerIsSilenced?: boolean;
  mafiaBuddies?: string[];
  playerInvestigation?: { isMafia: boolean } | null;
  votes?: Record<string, string>;
  nightActionDetails?: NightActionDetails;
  accusedPlayers?: string[];
  isTie?: boolean;
  revotes?: Record<string, string>;
  justificationTime?: number;
}

export default function RoomPage() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '';
  const playerId = searchParams.get('playerId') || '';

  const [game, setGame] = useState<GameStateView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleRevealed, setRoleRevealed] = useState(false);
  const [killTarget, setKillTarget] = useState('');
  const [silenceTarget, setSilenceTarget] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [investigationResult, setInvestigationResult] = useState<{ isMafia: boolean } | null>(null);
  const [discussionTimer, setDiscussionTimer] = useState(0);
  const [voteTarget, setVoteTarget] = useState('');
  const [settingsForm, setSettingsForm] = useState({ mafia: 2, doctors: 1, snipers: 1, investigators: 1, discussionTime: 180 });
  const [justificationTimer, setJustificationTimer] = useState(0);
  const [revoteTarget, setRevoteTarget] = useState('');
  const [currentJustifier, setCurrentJustifier] = useState(0);

  const isHost = game?.isHost === true;

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}?playerId=${playerId}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setGame(data);
      setError('');
    } catch {
      setError('خطأ في جلب بيانات اللعبة');
    } finally {
      setLoading(false);
    }
  }, [code, playerId]);

  useEffect(() => {
    if (!code || !playerId) {
      setError('رمز الغرفة أو معرّف اللاعب غير موجود');
      setLoading(false);
      return;
    }
    fetchGame();
  }, [code, playerId, fetchGame]);

  useEffect(() => {
    if (!code || !playerId || error) return;
    const interval = setInterval(fetchGame, 2000);
    return () => clearInterval(interval);
  }, [code, playerId, error, fetchGame]);

  useEffect(() => {
    if (game?.phase === 'day-discussion' && game.discussionTime) {
      setDiscussionTimer(game.discussionTime);
      const timer = setInterval(() => {
        setDiscussionTimer(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [game?.phase, game?.discussionTime, game?.round]);

  useEffect(() => {
    if (game?.phase === 'justification' && game.justificationTime) {
      setJustificationTimer(game.justificationTime);
      const timer = setInterval(() => {
        setJustificationTimer(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [game?.phase, game?.justificationTime]);

  useEffect(() => {
    if (game?.phase === 'night') {
      setKillTarget('');
      setSilenceTarget('');
      setInvestigationResult(null);
    }
    if (game?.phase === 'day-voting') setVoteTarget('');
    if (game?.phase === 'day-revoting') setRevoteTarget('');
    if (game?.phase === 'justification') { setCurrentJustifier(0); setJustificationTimer(0); }
  }, [game?.phase, game?.round]);

  const apiCall = async (url: string, body: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return null; }
      await fetchGame();
      return data;
    } catch {
      setError('خطأ في الاتصال');
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartGame = () => apiCall(`/api/rooms/${code}/start`, { hostId: playerId });
  const handleUpdateSettings = () => apiCall(`/api/rooms/${code}/settings`, { hostId: playerId, ...settingsForm });

  const handleNightAction = async (type: 'kill' | 'save' | 'shoot' | 'investigate' | 'silence', target?: string) => {
    const tid = target || (type === 'kill' ? killTarget : type === 'silence' ? silenceTarget : killTarget);
    if (!tid) return;
    const result = await apiCall(`/api/rooms/${code}/action`, { playerId, type, targetId: tid });
    if (type === 'investigate' && result?.investigation) {
      setInvestigationResult(result.investigation);
    }
    if (type === 'kill') setKillTarget('');
    if (type === 'silence') setSilenceTarget('');
  };

  const handleVote = () => {
    if (!voteTarget) return;
    apiCall(`/api/rooms/${code}/vote`, { playerId, targetId: voteTarget });
  };

  const handleRevote = () => {
    if (!revoteTarget) return;
    apiCall(`/api/rooms/${code}/revote`, { playerId, targetId: revoteTarget });
  };

  const handleAdvance = (action: string) => apiCall(`/api/rooms/${code}/advance`, { hostId: playerId, action });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="text-6xl">🔫</motion.div>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="bg-card/70 backdrop-blur-sm border-red-900/30 max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="text-6xl">⚠️</div>
            <h2 className="text-2xl font-bold text-red-400">خطأ</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => window.location.href = '/'} className="bg-gradient-to-l from-red-700 to-red-600">العودة للرئيسية</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!game) return null;

  const alivePlayers = game.players.filter(p => p.isAlive);
  const deadPlayers = game.players.filter(p => !p.isAlive);
  const silencedPlayers = game.players.filter(p => p.isSilenced && p.isAlive);
  const myPlayer = game.players.find(p => p.id === playerId);

  // ====== HOST MODERATOR VIEW ======
  const renderHostView = () => {
    switch (game.phase) {
      case 'waiting': return renderHostWaiting();
      case 'role-reveal': return renderHostRoleReveal();
      case 'night': return renderHostNight();
      case 'night-result': return renderHostNightResult();
      case 'day-discussion': return renderHostDayDiscussion();
      case 'day-voting': return renderHostDayVoting();
      case 'vote-result': return renderHostVoteResult();
      case 'justification': return renderHostJustification();
      case 'day-revoting': return renderHostDayRevoting();
      case 'final-vote-result': return renderHostFinalVoteResult();
      case 'gameover': return renderGameOver();
      default: return <div>حالة غير معروفة</div>;
    }
  };

  // ====== PLAYER VIEW ======
  const renderPlayerView = () => {
    switch (game.phase) {
      case 'waiting': return renderPlayerWaiting();
      case 'role-reveal': return renderPlayerRoleReveal();
      case 'night': return renderPlayerNight();
      case 'night-result': return renderPlayerNightResult();
      case 'day-discussion': return renderPlayerDayDiscussion();
      case 'day-voting': return renderPlayerDayVoting();
      case 'vote-result': return renderPlayerVoteResult();
      case 'justification': return renderPlayerJustification();
      case 'day-revoting': return renderPlayerDayRevoting();
      case 'final-vote-result': return renderPlayerFinalVoteResult();
      case 'gameover': return renderGameOver();
      default: return <div>حالة غير معروفة</div>;
    }
  };

  // ====== SHARED HEADER ======
  const renderHeader = () => (
    <div className="text-center mb-4">
      <Badge variant="outline" className="border-red-900/40 text-red-400 mb-2">
        {isHost ? '👁️ المراقب' : `🎮 ${myPlayer?.name || 'لاعب'}`}
      </Badge>
      {game.round > 0 && <span className="text-muted-foreground text-sm ml-2">الجولة {game.round}</span>}
    </div>
  );

  // ====== ALL ROLES PANEL (Host always sees) ======
  const renderAllRolesPanel = () => (
    <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
      <CardHeader>
        <CardTitle className="text-lg">👁️ لوحة المراقب - الأدوار السرية</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {game.players.map(player => {
            const roleInfo = player.role ? ROLE_INFO[player.role] : null;
            return (
              <div key={player.id} className={`flex items-center gap-3 p-2 rounded-lg ${!player.isAlive ? 'bg-red-950/30 opacity-60' : 'bg-secondary/50'}`}>
                <span className="text-lg">{roleInfo?.emoji || '❓'}</span>
                <span className="font-medium">{player.name}</span>
                <span className={`text-sm ${roleInfo?.color || 'text-gray-400'}`}>{roleInfo?.name || 'غير محدد'}</span>
                {!player.isAlive && <Badge variant="outline" className="border-red-800 text-red-400 text-xs mr-auto">💀 ميت</Badge>}
                {player.isSilenced && player.isAlive && <Badge variant="outline" className="border-purple-800 text-purple-400 text-xs mr-auto">🤫 مسكّت</Badge>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  // ===================== HOST VIEWS =====================

  const renderHostWaiting = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">غرفة الانتظار</h2>
        <p className="text-muted-foreground">أنت المراقب - انتظر انضمام اللاعبين ثم ابدأ اللعبة</p>
      </div>

      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">رمز الغرفة</p>
          <div className="text-4xl font-mono tracking-[0.3em] font-bold text-red-400 animate-pulse-glow rounded-lg p-3 bg-red-950/30 inline-block">{code}</div>
          <p className="text-xs text-muted-foreground mt-3">شارك هذا الرمز مع اللاعبين</p>
        </CardContent>
      </Card>

      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2">👥 اللاعبون ({game.players.length}/12)</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {game.players.map((player, i) => (
              <motion.div key={player.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <span className="text-2xl">🕵️</span>
                <span className="font-medium">{player.name}</span>
              </motion.div>
            ))}
          </div>
          {game.players.length < 8 && (
            <p className="text-center text-yellow-500/80 mt-4 text-sm">⏳ يحتاج {8 - game.players.length} لاعب/لاعبين إضافيين على الأقل</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader><CardTitle className="text-lg">⚙️ إعدادات اللعبة</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-right block text-sm">عدد المافيا 🔴</Label>
              <Input type="number" min={1} max={Math.floor(game.players.length / 2)} value={settingsForm.mafia} onChange={(e) => setSettingsForm(prev => ({ ...prev, mafia: Number(e.target.value) }))} className="text-center bg-input/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-right block text-sm">عدد الأطباء 💚</Label>
              <Input type="number" min={0} max={game.players.length - 2} value={settingsForm.doctors} onChange={(e) => setSettingsForm(prev => ({ ...prev, doctors: Number(e.target.value) }))} className="text-center bg-input/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-right block text-sm">عدد القناصين 🔵</Label>
              <Input type="number" min={0} max={game.players.length - 2} value={settingsForm.snipers} onChange={(e) => setSettingsForm(prev => ({ ...prev, snipers: Number(e.target.value) }))} className="text-center bg-input/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-right block text-sm">عدد المحققين 🟡</Label>
              <Input type="number" min={0} max={game.players.length - 2} value={settingsForm.investigators} onChange={(e) => setSettingsForm(prev => ({ ...prev, investigators: Number(e.target.value) }))} className="text-center bg-input/50" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">المواطنون الصالحون ⚪: {Math.max(0, game.players.length - settingsForm.mafia - settingsForm.doctors - settingsForm.snipers - settingsForm.investigators)}</p>
            {(settingsForm.mafia + settingsForm.doctors + settingsForm.snipers + settingsForm.investigators) >= game.players.length && (
              <p className="text-red-400 text-sm">⚠️ عدد الأدوار يتجاوز عدد اللاعبين!</p>
            )}
          </div>
          <Button onClick={handleUpdateSettings} variant="outline" className="w-full border-red-900/40 text-red-400" disabled={actionLoading}>حفظ الإعدادات</Button>
        </CardContent>
      </Card>

      {game.players.length >= 8 && (
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button onClick={handleStartGame} disabled={actionLoading} size="lg" className="w-full h-16 text-xl font-bold bg-gradient-to-l from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 shadow-lg shadow-red-900/40 animate-pulse-glow">
            🎮 بدء اللعبة
          </Button>
        </motion.div>
      )}
    </motion.div>
  );

  const renderHostRoleReveal = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">كشف الأدوار</h2>
        <p className="text-muted-foreground">أنت ترى كل الأدوار - انتظر حتى يكشف اللاعبون أدوارهم</p>
      </div>
      {renderAllRolesPanel()}
      <Button onClick={() => handleAdvance('start-night')} disabled={actionLoading} className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600">
        🌙 الانتقال لليل
      </Button>
    </motion.div>
  );

  const renderHostNight = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">🌙 الليل - الجولة {game.round}</Badge>
        <h2 className="text-3xl font-bold text-red-400">لوحة المراقب - الليل</h2>
        <p className="text-muted-foreground mt-2">راقب إجراءات الليل</p>
      </div>

      {renderAllRolesPanel()}

      {/* Night action details */}
      {game.nightActionDetails && (
        <Card className="bg-card/70 backdrop-blur-sm border-yellow-900/20">
          <CardHeader><CardTitle className="text-lg">📋 إجراءات الليل</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="p-2 rounded bg-red-950/30">
              <p className="text-red-400 text-sm font-bold">🔴 تصويت القتل:</p>
              {Object.entries(game.nightActionDetails.mafiaVotes).map(([mafiaId, targetId]) => {
                const mafia = game.players.find(p => p.id === mafiaId);
                const target = game.players.find(p => p.id === targetId);
                return <p key={mafiaId} className="text-xs text-muted-foreground">{mafia?.name} → {target?.name}</p>;
              })}
              {Object.keys(game.nightActionDetails.mafiaVotes).length === 0 && <p className="text-xs text-muted-foreground">لم يصوت بعد...</p>}
            </div>
            <div className="p-2 rounded bg-purple-950/30">
              <p className="text-purple-400 text-sm font-bold">🤫 تصويت التسكيت:</p>
              {Object.entries(game.nightActionDetails.mafiaSilenceVotes).map(([mafiaId, targetId]) => {
                const mafia = game.players.find(p => p.id === mafiaId);
                const target = game.players.find(p => p.id === targetId);
                return <p key={mafiaId} className="text-xs text-muted-foreground">{mafia?.name} → {target?.name}</p>;
              })}
              {Object.keys(game.nightActionDetails.mafiaSilenceVotes).length === 0 && <p className="text-xs text-muted-foreground">لم يصوت بعد...</p>}
            </div>
            <div className="p-2 rounded bg-green-950/30">
              <p className="text-green-400 text-sm font-bold">💚 إنقاذ الطبيب:</p>
              {Object.entries(game.nightActionDetails.doctorSaves).map(([docId, targetId]) => {
                const doc = game.players.find(p => p.id === docId);
                const target = game.players.find(p => p.id === targetId);
                return <p key={docId} className="text-xs text-muted-foreground">{doc?.name} → {target?.name}</p>;
              })}
              {Object.keys(game.nightActionDetails.doctorSaves).length === 0 && <p className="text-xs text-muted-foreground">لم يختار بعد...</p>}
            </div>
            {game.nightActionDetails.sniperTarget && (
              <div className="p-2 rounded bg-blue-950/30">
                <p className="text-blue-400 text-sm font-bold">🔵 طلقة القناص:</p>
                <p className="text-xs text-muted-foreground">{game.players.find(p => p.id === game.nightActionDetails!.sniperShooter)?.name} → {game.players.find(p => p.id === game.nightActionDetails!.sniperTarget)?.name}</p>
              </div>
            )}
            <div className="p-2 rounded bg-yellow-950/30">
              <p className="text-yellow-400 text-sm font-bold">🟡 تحقيق المحقق:</p>
              {Object.entries(game.nightActionDetails.investigatorChecks).map(([invId, targetId]) => {
                const inv = game.players.find(p => p.id === invId);
                const target = game.players.find(p => p.id === targetId);
                return <p key={invId} className="text-xs text-muted-foreground">{inv?.name} → {target?.name}</p>;
              })}
              {Object.keys(game.nightActionDetails.investigatorChecks).length === 0 && <p className="text-xs text-muted-foreground">لم يختار بعد...</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {game.nightActionsComplete && (
        <p className="text-center text-green-400 text-sm">✅ جميع الإجراءات الليلية مكتملة!</p>
      )}

      <Button onClick={() => handleAdvance('resolve-night')} disabled={actionLoading} className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600">
        ☀️ إنهاء الليل وإعلان النتائج
      </Button>
    </motion.div>
  );

  const renderHostNightResult = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">☀️ نتيجة الليل</Badge>
        <h2 className="text-3xl font-bold">ما حدث الليلة الماضية</h2>
      </div>

      {renderAllRolesPanel()}

      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardContent className="p-6 space-y-4">
          {game.lastNightKilled.map(killedId => {
            const p = game.players.find(pl => pl.id === killedId);
            return (
              <div key={killedId} className="p-4 rounded-lg bg-red-950/40 border border-red-900/40 text-center">
                <div className="text-4xl mb-2">💀</div>
                <p className="text-red-400 font-bold text-xl">{p?.name}</p>
                {p?.role && <p className="text-sm text-muted-foreground">{ROLE_INFO[p.role].emoji} {ROLE_INFO[p.role].name}</p>}
                <p className="text-muted-foreground text-sm">تم قتله هذه الليلة</p>
              </div>
            );
          })}
          {game.lastNightSaved.map(savedId => {
            const p = game.players.find(pl => pl.id === savedId);
            return (
              <div key={savedId} className="p-4 rounded-lg bg-green-950/40 border border-green-900/40 text-center">
                <div className="text-4xl mb-2">🛡️</div>
                <p className="text-green-400 font-bold text-xl">{p?.name}</p>
                <p className="text-muted-foreground text-sm">تم إنقاذه هذه الليلة!</p>
              </div>
            );
          })}
          {game.lastNightSilenced.map(silencedId => {
            const p = game.players.find(pl => pl.id === silencedId);
            return (
              <div key={silencedId} className="p-4 rounded-lg bg-purple-950/40 border border-purple-900/40 text-center">
                <div className="text-4xl mb-2">🤫</div>
                <p className="text-purple-400 font-bold text-xl">{p?.name}</p>
                <p className="text-muted-foreground text-sm">تم تسكيته - لن يستطيع التصويت</p>
              </div>
            );
          })}
          {game.sniperDied && (
            <div className="p-4 rounded-lg bg-blue-950/40 border border-blue-900/40 text-center">
              <div className="text-4xl mb-2">🔵💀</div>
              <p className="text-blue-400 font-bold">القناص مات مع هدفه!</p>
              <p className="text-muted-foreground text-sm">أصاب مواطناً بريئاً فدفع حياته ثمناً</p>
            </div>
          )}
          {game.lastNightKilled.length === 0 && game.lastNightSaved.length === 0 && game.lastNightSilenced.length === 0 && (
            <div className="p-4 rounded-lg bg-secondary/50 text-center">
              <div className="text-4xl mb-2">🌙</div>
              <p className="text-muted-foreground">ليلة هادئة...</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={() => handleAdvance('advance-to-day')} disabled={actionLoading} className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600">
        ☀️ الانتقال للنهار
      </Button>
    </motion.div>
  );

  const renderHostDayDiscussion = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="border-yellow-800/40 text-yellow-400 mb-3">☀️ النهار - الجولة {game.round}</Badge>
        <h2 className="text-3xl font-bold">وقت النقاش</h2>
      </div>
      {renderAllRolesPanel()}
      {silencedPlayers.length > 0 && (
        <Card className="bg-purple-950/30 border-purple-900/30">
          <CardContent className="p-4 text-center">
            <p className="text-purple-400 font-bold mb-2">🤫 اللاعبون المسكّتون:</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {silencedPlayers.map(p => <Badge key={p.id} className="bg-purple-800">{p.name}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="bg-card/70 backdrop-blur-sm border-yellow-900/20">
        <CardContent className="p-4">
          <p className="text-4xl font-mono font-bold text-yellow-400 text-center">
            {Math.floor(discussionTimer / 60)}:{(discussionTimer % 60).toString().padStart(2, '0')}
          </p>
          <Progress value={(discussionTimer / (game.discussionTime || 180)) * 100} className="mt-3 h-2" />
        </CardContent>
      </Card>
      <Button onClick={() => handleAdvance('start-voting')} disabled={actionLoading} className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600">
        🗳️ بدء التصويت
      </Button>
    </motion.div>
  );

  const renderHostDayVoting = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">🗳️ التصويت - الجولة {game.round}</Badge>
        <h2 className="text-3xl font-bold">مراقبة التصويت</h2>
      </div>
      {renderAllRolesPanel()}
      {game.votes && Object.keys(game.votes).length > 0 && (
        <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm text-muted-foreground text-center mb-2">🗳️ الأصوات:</p>
            {Object.entries(game.votes).map(([voterId, targetId]) => {
              const voter = game.players.find(p => p.id === voterId);
              const target = targetId === 'skip' ? null : game.players.find(p => p.id === targetId);
              return <p key={voterId} className="text-xs">{voter?.name} → {target?.name || 'تخطي'}</p>;
            })}
          </CardContent>
        </Card>
      )}
      <p className="text-center text-muted-foreground">تم التصويت: {game.votes ? Object.keys(game.votes).length : 0} / {alivePlayers.length}</p>
      <Button onClick={() => handleAdvance('resolve-votes')} disabled={actionLoading} variant="outline" className="w-full border-yellow-800/50 text-yellow-400">
        📊 إنهاء التصويت وإحصاء النتائج
      </Button>
    </motion.div>
  );

  const renderHostVoteResult = () => {
    const accused = (game as any).accusedPlayers || [];
    const isTie = (game as any).isTie || false;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">📊 نتيجة التصويت</Badge>
          <h2 className="text-3xl font-bold">إحصاء الأصوات</h2>
        </div>
        {renderAllRolesPanel()}
        {game.votes && Object.keys(game.votes).length > 0 && (
          <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm text-muted-foreground text-center mb-2">🗳️ الأصوات:</p>
              {Object.entries(game.votes).map(([voterId, targetId]) => {
                const voter = game.players.find(p => p.id === voterId);
                const target = targetId === 'skip' ? null : game.players.find(p => p.id === targetId);
                return <p key={voterId} className="text-xs">{voter?.name} → {target?.name || 'تخطي'}</p>;
              })}
            </CardContent>
          </Card>
        )}
        {accused.length > 0 ? (
          <Card className="bg-card/70 backdrop-blur-sm border-orange-900/30">
            <CardContent className="p-6 text-center space-y-3">
              <div className="text-4xl">⚠️</div>
              <h3 className="text-xl font-bold text-orange-400">
                {isTie ? 'تعادل! المتهمون:' : 'المتهم بأغلبية الأصوات:'}
              </h3>
              <div className="flex gap-2 justify-center flex-wrap">
                {accused.map((id: string) => {
                  const p = game.players.find(pl => pl.id === id);
                  return <Badge key={id} className="bg-orange-800 text-white text-lg px-3 py-1">{p?.name}</Badge>;
                })}
              </div>
              <p className="text-muted-foreground text-sm">
                {isTie ? 'كل متهم سيحصل على دقيقة للتبرير' : 'سيحصل على دقيقة للتبرير قبل إعادة التصويت'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/70 backdrop-blur-sm border-secondary/30">
            <CardContent className="p-6 text-center">
              <div className="text-4xl">🗳️</div>
              <p className="text-muted-foreground">لا أحد حصل على أصوات كافية</p>
            </CardContent>
          </Card>
        )}
        {accused.length > 0 ? (
          <Button onClick={() => handleAdvance('start-justification')} disabled={actionLoading} className="w-full h-14 text-lg bg-gradient-to-l from-orange-700 to-orange-600">
            🎤 بدء التبرير
          </Button>
        ) : (
          <Button onClick={() => handleAdvance('advance-to-night')} disabled={actionLoading} className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600">
            🌙 الانتقال لليل
          </Button>
        )}
      </motion.div>
    );
  };

  const renderHostJustification = () => {
    const accused = (game as any).accusedPlayers || [];
    const isTie = (game as any).isTie || false;
    const currentAccused = accused[currentJustifier] || accused[0];
    const currentPlayer = game.players.find(p => p.id === currentAccused);
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="border-orange-800/40 text-orange-400 mb-3">🎤 وقت التبرير</Badge>
          <h2 className="text-3xl font-bold text-orange-400">الدفاع عن النفس</h2>
        </div>
        {isTie && accused.length > 1 && (
          <div className="flex gap-2 justify-center">
            {accused.map((id: string, idx: number) => {
              const p = game.players.find(pl => pl.id === id);
              return (
                <Button key={id} variant={currentJustifier === idx ? 'default' : 'outline'} className={currentJustifier === idx ? 'bg-orange-700' : 'border-orange-900/30 text-orange-400'} onClick={() => setCurrentJustifier(idx)}>
                  {p?.name}
                </Button>
              );
            })}
          </div>
        )}
        {currentPlayer && (
          <Card className="bg-card/70 backdrop-blur-sm border-orange-900/30">
            <CardContent className="p-8 text-center space-y-4">
              <div className="text-6xl">🎤</div>
              <h3 className="text-2xl font-bold text-orange-400">{currentPlayer.name}</h3>
              <p className="text-muted-foreground">يبرر نفسه الآن...</p>
              <p className="text-5xl font-mono font-bold text-yellow-400">
                {Math.floor(justificationTimer / 60)}:{(justificationTimer % 60).toString().padStart(2, '0')}
              </p>
              <Progress value={(justificationTimer / (game.justificationTime || 60)) * 100} className="mt-3 h-2" />
            </CardContent>
          </Card>
        )}
        <Button onClick={() => handleAdvance('start-revote')} disabled={actionLoading} className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600">
          🗳️ بدء إعادة التصويت
        </Button>
      </motion.div>
    );
  };

  const renderHostDayRevoting = () => {
    const accused = (game as any).accusedPlayers || [];
    const revotes = (game as any).revotes || {};
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">🗳️ إعادة التصويت - الجولة {game.round}</Badge>
          <h2 className="text-3xl font-bold">التصويت على المتهمين فقط</h2>
        </div>
        {renderAllRolesPanel()}
        <Card className="bg-card/70 backdrop-blur-sm border-orange-900/30">
          <CardContent className="p-4 text-center">
            <p className="text-orange-400 font-bold mb-2">المتهمون:</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {accused.map((id: string) => {
                const p = game.players.find(pl => pl.id === id);
                return <Badge key={id} className="bg-orange-800 text-white">{p?.name}</Badge>;
              })}
            </div>
          </CardContent>
        </Card>
        {Object.keys(revotes).length > 0 && (
          <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm text-muted-foreground text-center mb-2">🗳️ أصوات إعادة التصويت:</p>
              {Object.entries(revotes).map(([voterId, targetId]) => {
                const voter = game.players.find(p => p.id === voterId);
                const target = targetId === 'skip' ? null : game.players.find(p => p.id === targetId);
                return <p key={voterId} className="text-xs">{voter?.name} → {target?.name || 'تخطي'}</p>;
              })}
            </CardContent>
          </Card>
        )}
        <p className="text-center text-muted-foreground">تم التصويت: {Object.keys(revotes).length} / {alivePlayers.length}</p>
        <Button onClick={() => handleAdvance('resolve-final-votes')} disabled={actionLoading} variant="outline" className="w-full border-yellow-800/50 text-yellow-400">
          📊 إنهاء التصويت وإحصاء النتائج النهائية
        </Button>
      </motion.div>
    );
  };

  const renderHostFinalVoteResult = () => {
    const eliminated = game.lastVoteEliminated;
    const eliminatedPlayer = eliminated ? game.players.find(p => p.id === eliminated) : null;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">📊 النتيجة النهائية</Badge>
          <h2 className="text-3xl font-bold">نتيجة التصويت النهائي</h2>
        </div>
        {renderAllRolesPanel()}
        <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
          <CardContent className="p-6 space-y-4">
            {eliminatedPlayer ? (
              <div className="p-4 rounded-lg bg-red-950/40 border border-red-900/40 text-center">
                <div className="text-4xl mb-2">💀</div>
                <p className="text-red-400 font-bold text-xl">{eliminatedPlayer.name}</p>
                {eliminatedPlayer.role && <p className="text-sm text-muted-foreground">{ROLE_INFO[eliminatedPlayer.role].emoji} {ROLE_INFO[eliminatedPlayer.role].name}</p>}
                <p className="text-muted-foreground text-sm">تم إبعاده بالتصويت</p>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <div className="text-4xl mb-2">🗳️</div>
                <p className="text-muted-foreground">لا أحد حُذف - تعادل أو تخطي</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Button onClick={() => handleAdvance('advance-to-night')} disabled={actionLoading} className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600">
          🌙 الانتقال لليل
        </Button>
      </motion.div>
    );
  };

  // ===================== PLAYER VIEWS =====================

  const renderPlayerWaiting = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">غرفة الانتظار</h2>
        <p className="text-muted-foreground">في انتظار بدء اللعبة...</p>
      </div>
      <Card className="bg-card/70 backdrop-blur-sm border-yellow-900/20">
        <CardContent className="p-6 text-center">
          <p className="text-yellow-500/80">⏳ في انتظار المراقب لبدء اللعبة...</p>
        </CardContent>
      </Card>
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2">👥 اللاعبون ({game.players.length}/12)</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {game.players.map((player, i) => (
              <motion.div key={player.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <span className="text-2xl">🕵️</span>
                <span className="font-medium">{player.name}</span>
              </motion.div>
            ))}
          </div>
          {game.players.length < 8 && <p className="text-center text-yellow-500/80 mt-4 text-sm">⏳ يحتاج {8 - game.players.length} لاعب/لاعبين إضافيين</p>}
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderPlayerRoleReveal = () => {
    const role = game.playerRole as Role | undefined;
    if (!role) return null;
    const roleInfo = ROLE_INFO[role];
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2">دورك السري</h2>
          <p className="text-muted-foreground">اضغط لكشف دورك - لا تدع أحداً يرى!</p>
        </div>
        {!roleRevealed ? (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button onClick={() => setRoleRevealed(true)} size="lg" className="w-full h-24 text-2xl font-bold bg-gradient-to-l from-red-700 to-red-600 animate-pulse-glow shadow-lg shadow-red-900/40">🎭 كشف دوري</Button>
          </motion.div>
        ) : (
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
            <Card className={`role-${role} border-2 backdrop-blur-sm`}>
              <CardContent className="p-8 text-center space-y-4">
                <div className="text-7xl">{roleInfo.emoji}</div>
                <h3 className={`text-3xl font-bold ${roleInfo.color}`}>{roleInfo.name}</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">{roleInfo.description}</p>
                {role === 'mafia' && game.mafiaBuddies && game.mafiaBuddies.length > 0 && (
                  <div className="mt-4 p-4 rounded-lg bg-red-950/40 border border-red-900/30">
                    <p className="text-red-400 font-bold mb-2">زملاؤك في المافيا:</p>
                    <div className="flex gap-2 justify-center flex-wrap">{game.mafiaBuddies.map((name, i) => <Badge key={i} className="bg-red-800 text-white">{name}</Badge>)}</div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Button onClick={async () => { await fetchGame(); }} size="lg" className="w-full mt-6 bg-gradient-to-l from-red-700 to-red-600">✅ فهمت</Button>
          </motion.div>
        )}
      </motion.div>
    );
  };

  const renderPlayerNight = () => {
    const role = game.playerRole as Role | undefined;
    if (!role || !game.playerIsAlive) return renderCitizenNight();
    switch (role) {
      case 'mafia': return renderMafiaNight();
      case 'doctor': return renderDoctorNight();
      case 'sniper': return renderSniperNight();
      case 'investigator': return renderInvestigatorNight();
      default: return renderCitizenNight();
    }
  };

  const renderMafiaNight = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">🌙 الليل - الجولة {game.round}</Badge>
        <h2 className="text-3xl font-bold text-red-400">🔴 وقت المافيا</h2>
        <p className="text-muted-foreground mt-2">اختر ضحية للقتل وشخصاً آخر لتسكيت</p>
      </div>
      {game.mafiaBuddies && game.mafiaBuddies.length > 0 && (
        <p className="text-red-400/80 text-sm text-center">زملاؤك: {game.mafiaBuddies.join('، ')}</p>
      )}

      {/* Kill target */}
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader><CardTitle className="text-lg text-red-400">🗡️ اختر ضحية القتل</CardTitle></CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {alivePlayers.filter(p => p.role !== 'mafia' || p.id === playerId).map(player => (
              <Button key={player.id} variant={killTarget === player.id ? 'default' : 'outline'} className={`h-14 text-sm ${killTarget === player.id ? 'bg-red-700 hover:bg-red-600 border-red-500' : 'border-red-900/30 text-foreground hover:bg-red-950/30'}`} onClick={() => setKillTarget(player.id)}>
                🎯 {player.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Button onClick={() => handleNightAction('kill')} disabled={!killTarget || actionLoading} className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600">🗡️ تأكيد القتل</Button>

      <Separator className="bg-red-900/20" />

      {/* Silence target */}
      <Card className="bg-card/70 backdrop-blur-sm border-purple-900/30">
        <CardHeader><CardTitle className="text-lg text-purple-400">🤫 اختر شخصاً لتسكيت</CardTitle></CardHeader>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-3">الشخص المسكّت لن يستطيع التصويت غداً</p>
          <div className="grid grid-cols-2 gap-3">
            {alivePlayers.filter(p => p.id !== playerId).map(player => (
              <Button key={player.id} variant={silenceTarget === player.id ? 'default' : 'outline'} className={`h-14 text-sm ${silenceTarget === player.id ? 'bg-purple-700 hover:bg-purple-600 border-purple-500' : 'border-purple-900/30 text-foreground hover:bg-purple-950/30'}`} onClick={() => setSilenceTarget(player.id)}>
                🤫 {player.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Button onClick={() => handleNightAction('silence')} disabled={!silenceTarget || actionLoading} className="w-full h-14 text-lg bg-gradient-to-l from-purple-700 to-purple-600">🤫 تأكيد التسكيت</Button>
    </motion.div>
  );

  const renderDoctorNight = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="border-green-900/40 text-green-400 mb-3">🌙 الليل - الجولة {game.round}</Badge>
        <h2 className="text-3xl font-bold text-green-400">💚 وقت الطبيب</h2>
        <p className="text-muted-foreground mt-2">اختر شخصاً لإنقاذه هذه الليلة</p>
      </div>
      <Card className="bg-card/70 backdrop-blur-sm border-green-900/30">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {alivePlayers.map(player => (
              <Button key={player.id} variant={killTarget === player.id ? 'default' : 'outline'} className={`h-16 text-base ${killTarget === player.id ? 'bg-green-700 hover:bg-green-600 border-green-500' : 'border-green-900/30 text-foreground hover:bg-green-950/30'}`} onClick={() => setKillTarget(player.id)}>
                💚 {player.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Button onClick={() => handleNightAction('save')} disabled={!killTarget || actionLoading} className="w-full h-14 text-lg bg-gradient-to-l from-green-700 to-green-600">🛡️ إنقاذ</Button>
    </motion.div>
  );

  const renderSniperNight = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="border-blue-900/40 text-blue-400 mb-3">🌙 الليل - الجولة {game.round}</Badge>
        <h2 className="text-3xl font-bold text-blue-400">🔵 وقت القناص</h2>
        {game.playerSniperUsed ? (
          <p className="text-muted-foreground mt-2">لقد استخدمت رصاصتك بالفعل ⚠️</p>
        ) : (
          <p className="text-muted-foreground mt-2">رصاصة واحدة - إذا أصبت بريئاً ستموت معه!</p>
        )}
      </div>
      {!game.playerSniperUsed ? (
        <>
          <Card className="bg-card/70 backdrop-blur-sm border-blue-900/30">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {alivePlayers.filter(p => p.id !== playerId).map(player => (
                  <Button key={player.id} variant={killTarget === player.id ? 'default' : 'outline'} className={`h-16 text-base ${killTarget === player.id ? 'bg-blue-700 hover:bg-blue-600 border-blue-500' : 'border-blue-900/30 text-foreground hover:bg-blue-950/30'}`} onClick={() => setKillTarget(player.id)}>
                    🎯 {player.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-3">
            <Button onClick={() => handleNightAction('shoot')} disabled={!killTarget || actionLoading} className="flex-1 h-14 text-lg bg-gradient-to-l from-blue-700 to-blue-600">🔫 إطلاق الرصاصة</Button>
            <Button onClick={() => setKillTarget('')} variant="outline" className="border-blue-900/30 text-blue-400">تخطي</Button>
          </div>
        </>
      ) : (
        <Card className="bg-card/70 backdrop-blur-sm border-blue-900/30">
          <CardContent className="p-8 text-center">
            <div className="text-5xl mb-3">🔕</div>
            <p className="text-muted-foreground">انتظر حتى ينتهي الليل...</p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );

  const renderInvestigatorNight = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="border-yellow-900/40 text-yellow-400 mb-3">🌙 الليل - الجولة {game.round}</Badge>
        <h2 className="text-3xl font-bold text-yellow-400">🟡 وقت المحقق</h2>
        <p className="text-muted-foreground mt-2">اختر شخصاً للتحقق من هويته</p>
      </div>
      {!investigationResult ? (
        <>
          <Card className="bg-card/70 backdrop-blur-sm border-yellow-900/30">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {alivePlayers.filter(p => p.id !== playerId).map(player => (
                  <Button key={player.id} variant={killTarget === player.id ? 'default' : 'outline'} className={`h-16 text-base ${killTarget === player.id ? 'bg-yellow-700 hover:bg-yellow-600 border-yellow-500' : 'border-yellow-900/30 text-foreground hover:bg-yellow-950/30'}`} onClick={() => setKillTarget(player.id)}>
                    🔍 {player.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
          <Button onClick={() => handleNightAction('investigate')} disabled={!killTarget || actionLoading} className="w-full h-14 text-lg bg-gradient-to-l from-yellow-700 to-yellow-600 text-black">🔍 تحقق</Button>
        </>
      ) : (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className={`border-2 ${investigationResult.isMafia ? 'border-red-500 bg-red-950/30' : 'border-green-500 bg-green-950/30'}`}>
            <CardContent className="p-8 text-center space-y-3">
              <div className="text-6xl">{investigationResult.isMafia ? '🔴' : '💚'}</div>
              <h3 className={`text-2xl font-bold ${investigationResult.isMafia ? 'text-red-400' : 'text-green-400'}`}>{investigationResult.isMafia ? 'مافيا!' : 'بريء'}</h3>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );

  const renderCitizenNight = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">🌙 الليل - الجولة {game.round}</Badge>
        <h2 className="text-3xl font-bold">الليل قد حل...</h2>
        <p className="text-muted-foreground mt-2">الكـل يغمـض عينيـه 🌑</p>
      </div>
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardContent className="p-12 text-center">
          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 3, repeat: Infinity }} className="text-8xl">😴</motion.div>
          <p className="text-xl text-muted-foreground mt-6">انتظر حتى ينتهي الليل...</p>
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderPlayerNightResult = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">☀️ نتيجة الليل</Badge>
        <h2 className="text-3xl font-bold">ما حدث الليلة الماضية</h2>
      </div>
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardContent className="p-6 space-y-4">
          {game.lastNightKilled.map(killedId => {
            const p = game.players.find(pl => pl.id === killedId);
            return (
              <div key={killedId} className="p-4 rounded-lg bg-red-950/40 border border-red-900/40 text-center">
                <div className="text-4xl mb-2">💀</div>
                <p className="text-red-400 font-bold text-xl">{p?.name}</p>
                <p className="text-muted-foreground text-sm">تم قتله هذه الليلة</p>
              </div>
            );
          })}
          {game.lastNightSaved.map(savedId => {
            const p = game.players.find(pl => pl.id === savedId);
            return (
              <div key={savedId} className="p-4 rounded-lg bg-green-950/40 border border-green-900/40 text-center">
                <div className="text-4xl mb-2">🛡️</div>
                <p className="text-green-400 font-bold text-xl">{p?.name}</p>
                <p className="text-muted-foreground text-sm">تم إنقاذه!</p>
              </div>
            );
          })}
          {game.lastNightSilenced.length > 0 && game.lastNightSilenced.includes(playerId) && (
            <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-900/40 text-center">
              <div className="text-4xl mb-2">🤫</div>
              <p className="text-purple-400 font-bold text-xl">أنت مسكّت!</p>
              <p className="text-muted-foreground text-sm">لن تستطيع التصويت هذه الجولة</p>
            </div>
          )}
          {game.lastNightSilenced.length > 0 && !game.lastNightSilenced.includes(playerId) && (
            <div className="p-4 rounded-lg bg-purple-950/30 border border-purple-900/30 text-center">
              <div className="text-4xl mb-2">🤫</div>
              <p className="text-purple-400 font-bold">تم تسكيت {game.lastNightSilenced.length} لاعب</p>
            </div>
          )}
          {game.sniperDied && (
            <div className="p-4 rounded-lg bg-blue-950/40 border border-blue-900/40 text-center">
              <div className="text-4xl mb-2">🔵💀</div>
              <p className="text-blue-400 font-bold">القناص مات مع هدفه!</p>
            </div>
          )}
          {game.lastNightKilled.length === 0 && game.lastNightSaved.length === 0 && game.lastNightSilenced.length === 0 && (
            <div className="p-4 rounded-lg bg-secondary/50 text-center">
              <div className="text-4xl mb-2">🌙</div>
              <p className="text-muted-foreground">ليلة هادئة...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderPlayerDayDiscussion = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="border-yellow-800/40 text-yellow-400 mb-3">☀️ النهار - الجولة {game.round}</Badge>
        <h2 className="text-3xl font-bold">وقت النقاش</h2>
      </div>
      {game.playerIsSilenced && (
        <Card className="bg-purple-950/40 border-purple-900/40">
          <CardContent className="p-6 text-center">
            <div className="text-5xl mb-2">🤫</div>
            <p className="text-purple-400 font-bold text-xl">أنت مسكّت!</p>
            <p className="text-muted-foreground">لن تستطيع التصويت هذه الجولة</p>
          </CardContent>
        </Card>
      )}
      <Card className="bg-card/70 backdrop-blur-sm border-yellow-900/20">
        <CardContent className="p-4">
          <p className="text-4xl font-mono font-bold text-yellow-400 text-center">
            {Math.floor(discussionTimer / 60)}:{(discussionTimer % 60).toString().padStart(2, '0')}
          </p>
          <Progress value={(discussionTimer / (game.discussionTime || 180)) * 100} className="mt-3 h-2" />
        </CardContent>
      </Card>
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader><CardTitle className="text-lg">👥 اللاعبون الباقون ({alivePlayers.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {alivePlayers.map(player => (
              <div key={player.id} className={`p-3 rounded-lg bg-secondary/50 text-center ${player.isSilenced ? 'border border-purple-800' : ''}`}>
                <span>{player.isSilenced ? '🤫' : '🕵️'} {player.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {deadPlayers.length > 0 && (
        <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
          <CardHeader><CardTitle className="text-lg text-red-400">💀 اللاعبون الخارجون</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {deadPlayers.map(player => <Badge key={player.id} variant="outline" className="border-red-900/30 text-red-400/60 line-through">{player.name}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="bg-card/70 backdrop-blur-sm border-yellow-900/20">
        <CardContent className="p-4 text-center">
          <p className="text-yellow-500/80 text-sm">⏳ في انتظار المراقب لبدء التصويت...</p>
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderPlayerDayVoting = () => {
    const myVote = game.votes?.[playerId];
    const hasVoted = !!myVote;
    const isSilenced = game.playerIsSilenced;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">🗳️ التصويت - الجولة {game.round}</Badge>
          <h2 className="text-3xl font-bold">صوّت لإبعاد شخص</h2>
        </div>

        {isSilenced ? (
          <Card className="bg-purple-950/40 border-purple-900/40">
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-3">🤫</div>
              <p className="text-purple-400 font-bold text-xl">أنت مسكّت!</p>
              <p className="text-muted-foreground">لا يمكنك التصويت هذه الجولة</p>
            </CardContent>
          </Card>
        ) : game.playerIsAlive ? (
          !hasVoted ? (
            <>
              <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {alivePlayers.filter(p => p.id !== playerId).map(player => (
                      <Button key={player.id} variant={voteTarget === player.id ? 'default' : 'outline'} className={`h-16 text-base ${voteTarget === player.id ? 'bg-red-700 hover:bg-red-600 border-red-500' : 'border-red-900/30 text-foreground hover:bg-red-950/30'}`} onClick={() => setVoteTarget(player.id)}>
                        👆 {player.name}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Button variant={voteTarget === 'skip' ? 'default' : 'outline'} className={`w-full h-12 ${voteTarget === 'skip' ? 'bg-gray-700 hover:bg-gray-600' : 'border-gray-700/30 text-muted-foreground'}`} onClick={() => setVoteTarget('skip')}>⏭️ تخطي التصويت</Button>
                  </div>
                </CardContent>
              </Card>
              <Button onClick={handleVote} disabled={!voteTarget || actionLoading} className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600">🗳️ تأكيد التصويت</Button>
            </>
          ) : (
            <Card className="bg-card/70 backdrop-blur-sm border-green-900/20">
              <CardContent className="p-6 text-center">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-green-400 font-bold">تم التصويت!</p>
                <p className="text-muted-foreground text-sm mt-2">في انتظار بقية اللاعبين...</p>
              </CardContent>
            </Card>
          )
        ) : (
          <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
            <CardContent className="p-6 text-center"><p className="text-muted-foreground">أنت خارج اللعبة ولا يمكنك التصويت</p></CardContent>
          </Card>
        )}

        {game.votes && Object.keys(game.votes).length > 0 && (
          <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground text-center">🗳️ تم التصويت: {Object.keys(game.votes).length} / {alivePlayers.filter(p => !p.isSilenced).length}</p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    );
  };

  const renderPlayerVoteResult = () => {
    const accused = (game as any).accusedPlayers || [];
    const isTie = (game as any).isTie || false;
    const isAccused = accused.includes(playerId);
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">📊 نتيجة التصويت</Badge>
          <h2 className="text-3xl font-bold">إحصاء الأصوات</h2>
        </div>
        {isAccused && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Card className="border-2 border-orange-500 bg-orange-950/30">
              <CardContent className="p-8 text-center space-y-3">
                <div className="text-6xl">⚠️</div>
                <h3 className="text-2xl font-bold text-orange-400">أنت متهم!</h3>
                <p className="text-muted-foreground">حان وقت تبريرك - جهّز دفاعك</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
        {accused.length > 0 && !isAccused && (
          <Card className="bg-card/70 backdrop-blur-sm border-orange-900/30">
            <CardContent className="p-6 text-center space-y-3">
              <div className="text-4xl">⚠️</div>
              <h3 className="text-xl font-bold text-orange-400">
                {isTie ? 'المتهمون بأغلبية الأصوات:' : 'المتهم بأغلبية الأصوات:'}
              </h3>
              <div className="flex gap-2 justify-center flex-wrap">
                {accused.map((id: string) => {
                  const p = game.players.find(pl => pl.id === id);
                  return <Badge key={id} className="bg-orange-800 text-white">{p?.name}</Badge>;
                })}
              </div>
              <p className="text-muted-foreground text-sm">سيحصلون على وقت للتبرير ثم يُعاد التصويت</p>
            </CardContent>
          </Card>
        )}
        {accused.length === 0 && (
          <Card className="bg-card/70 backdrop-blur-sm border-secondary/30">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">لا أحد حصل على أصوات كافية</p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    );
  };

  const renderPlayerJustification = () => {
    const accused = (game as any).accusedPlayers || [];
    const isAccused = accused.includes(playerId);
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="border-orange-800/40 text-orange-400 mb-3">🎤 وقت التبرير</Badge>
          <h2 className="text-3xl font-bold text-orange-400">الدفاع عن النفس</h2>
        </div>
        {isAccused ? (
          <Card className="border-2 border-orange-500 bg-orange-950/30">
            <CardContent className="p-8 text-center space-y-4">
              <div className="text-6xl">🎤</div>
              <h3 className="text-2xl font-bold text-orange-400">أنت متهم! برّر نفسك!</h3>
              <p className="text-muted-foreground">الوقت المتبقي لتبريرك:</p>
              <p className="text-5xl font-mono font-bold text-yellow-400">
                {Math.floor(justificationTimer / 60)}:{(justificationTimer % 60).toString().padStart(2, '0')}
              </p>
              <Progress value={(justificationTimer / (game.justificationTime || 60)) * 100} className="mt-3 h-2" />
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/70 backdrop-blur-sm border-orange-900/30">
            <CardContent className="p-12 text-center">
              <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 3, repeat: Infinity }} className="text-8xl">🎤</motion.div>
              <p className="text-xl text-muted-foreground mt-6">المتهمون يبررون أنفسهم...</p>
              <p className="text-muted-foreground text-sm mt-2">استمع جيداً قبل إعادة التصويت</p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    );
  };

  const renderPlayerDayRevoting = () => {
    const accused = (game as any).accusedPlayers || [];
    const revotes = (game as any).revotes || {};
    const myRevote = revotes[playerId];
    const hasRevoted = !!myRevote;
    if (!game.playerIsAlive) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="text-center">
            <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">🗳️ إعادة التصويت</Badge>
            <h2 className="text-3xl font-bold">إعادة التصويت على المتهمين</h2>
          </div>
          <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
            <CardContent className="p-8 text-center">
              <div className="text-5xl mb-3">💀</div>
              <p className="text-muted-foreground">أنت خارج اللعبة - تراقب فقط</p>
            </CardContent>
          </Card>
        </motion.div>
      );
    }
    if (game.playerIsSilenced) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="text-center">
            <Badge variant="outline" className="border-purple-800/40 text-purple-400 mb-3">🗳️ إعادة التصويت</Badge>
            <h2 className="text-3xl font-bold">إعادة التصويت على المتهمين</h2>
          </div>
          <Card className="border-2 border-purple-500 bg-purple-950/30">
            <CardContent className="p-8 text-center space-y-3">
              <div className="text-6xl">🤫</div>
              <h3 className="text-2xl font-bold text-purple-400">أنت مسكّت!</h3>
              <p className="text-muted-foreground">لا يمكنك التصويت هذه الجولة</p>
            </CardContent>
          </Card>
        </motion.div>
      );
    }
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">🗳️ إعادة التصويت - الجولة {game.round}</Badge>
          <h2 className="text-3xl font-bold">صوّت على المتهمين فقط</h2>
        </div>
        {!hasRevoted ? (
          <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 gap-3">
                {accused.map((id: string) => {
                  const p = game.players.find(pl => pl.id === id);
                  return (
                    <Button key={id} variant={revoteTarget === id ? 'default' : 'outline'} className={`h-14 text-base ${revoteTarget === id ? 'bg-red-700 hover:bg-red-600 border-red-500' : 'border-red-900/30 text-foreground hover:bg-red-950/30'}`} onClick={() => setRevoteTarget(id)}>
                      🎯 {p?.name}
                    </Button>
                  );
                })}
                <Button variant={revoteTarget === 'skip' ? 'default' : 'outline'} className={`h-14 text-base ${revoteTarget === 'skip' ? 'bg-gray-700 hover:bg-gray-600' : 'border-gray-900/30 text-foreground hover:bg-gray-950/30'}`} onClick={() => setRevoteTarget('skip')}>
                  ⏭️ تخطي
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/70 backdrop-blur-sm border-green-900/30">
            <CardContent className="p-8 text-center space-y-3">
              <div className="text-6xl">✅</div>
              <h3 className="text-2xl font-bold text-green-400">تم التصويت!</h3>
              <p className="text-muted-foreground">في انتظار باقي اللاعبين...</p>
            </CardContent>
          </Card>
        )}
        {!hasRevoted && revoteTarget && (
          <Button onClick={handleRevote} disabled={actionLoading} className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600">
            🗳️ تأكيد التصويت
          </Button>
        )}
      </motion.div>
    );
  };

  const renderPlayerFinalVoteResult = () => {
    const eliminated = game.lastVoteEliminated;
    const eliminatedPlayer = eliminated ? game.players.find(p => p.id === eliminated) : null;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">📊 النتيجة النهائية</Badge>
          <h2 className="text-3xl font-bold">نتيجة التصويت النهائي</h2>
        </div>
        <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
          <CardContent className="p-6 space-y-4">
            {eliminatedPlayer ? (
              <div className="p-4 rounded-lg bg-red-950/40 border border-red-900/40 text-center">
                <div className="text-4xl mb-2">💀</div>
                <p className="text-red-400 font-bold text-xl">{eliminatedPlayer.name}</p>
                {game.phase === 'gameover' && eliminatedPlayer.role && <p className="text-sm text-muted-foreground">{ROLE_INFO[eliminatedPlayer.role].emoji} {ROLE_INFO[eliminatedPlayer.role].name}</p>}
                <p className="text-muted-foreground text-sm">تم إبعاده بالتصويت</p>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-secondary/50 text-center">
                <div className="text-4xl mb-2">🗳️</div>
                <p className="text-muted-foreground">لا أحد حُذف</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  // ====== GAME OVER (shared) ======
  const renderGameOver = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-2">🏁 انتهت اللعبة!</h2>
      </div>
      <Card className={`border-2 ${game.winner === 'mafia' ? 'border-red-500 bg-red-950/30' : 'border-green-500 bg-green-950/30'}`}>
        <CardContent className="p-8 text-center space-y-4">
          <div className="text-8xl">{game.winner === 'mafia' ? '🔴' : '💚'}</div>
          <h3 className={`text-3xl font-bold ${game.winner === 'mafia' ? 'text-red-400' : 'text-green-400'}`}>
            {game.winner === 'mafia' ? 'المافيا فازت!' : 'المواطنون فازوا!'}
          </h3>
        </CardContent>
      </Card>
      {/* Show all roles */}
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader><CardTitle className="text-lg">🎭 جميع الأدوار</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {game.players.map(player => {
              const roleInfo = player.role ? ROLE_INFO[player.role] : null;
              return (
                <div key={player.id} className={`flex items-center gap-3 p-2 rounded-lg ${!player.isAlive ? 'bg-red-950/30 opacity-60' : 'bg-secondary/50'}`}>
                  <span className="text-lg">{roleInfo?.emoji || '❓'}</span>
                  <span className="font-medium">{player.name}</span>
                  <span className={`text-sm ${roleInfo?.color || 'text-gray-400'}`}>{roleInfo?.name || '?'}</span>
                  {!player.isAlive && <span className="text-xs text-red-400 mr-auto">💀</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Button onClick={() => window.location.href = '/'} className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600">🏠 العودة للرئيسية</Button>
    </motion.div>
  );

  return (
    <div className="min-h-screen p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[oklch(0.08_0.02_280)] to-black" />
      <div className="relative z-10 w-full max-w-2xl mx-auto">
        {renderHeader()}
        {isHost ? renderHostView() : renderPlayerView()}
      </div>
    </div>
  );
}
