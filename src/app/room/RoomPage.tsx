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
  role?: Role;
}

interface GameStateView {
  code: string;
  hostId: string;
  players: GamePlayer[];
  settings: { mafia: number; doctors: number; snipers: number; investigators: number };
  phase: GamePhase;
  round: number;
  eliminatedPlayers: string[];
  lastNightKilled: string[];
  lastNightSaved: string[];
  lastNightSniped?: string;
  lastVoteEliminated?: string;
  winner?: 'mafia' | 'citizens';
  discussionTime: number;
  nightActionsComplete: boolean;
  playerRole?: Role;
  playerSniperUsed?: boolean;
  playerIsAlive?: boolean;
  mafiaBuddies?: string[];
  playerInvestigation?: { isMafia: boolean } | null;
  votes?: Record<string, string>;
}

export default function RoomPage() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '';
  const playerId = searchParams.get('playerId') || '';

  const [game, setGame] = useState<GameStateView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleRevealed, setRoleRevealed] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [investigationResult, setInvestigationResult] = useState<{ isMafia: boolean } | null>(null);
  const [discussionTimer, setDiscussionTimer] = useState(0);
  const [voteTarget, setVoteTarget] = useState('');
  const [settingsForm, setSettingsForm] = useState({ mafia: 2, doctors: 1, snipers: 1, investigators: 1, discussionTime: 180 });

  const isHost = game?.hostId === playerId;

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

  // Poll for game state updates
  useEffect(() => {
    if (!code || !playerId || error) return;
    const interval = setInterval(fetchGame, 2000);
    return () => clearInterval(interval);
  }, [code, playerId, error, fetchGame]);

  // Discussion timer
  useEffect(() => {
    if (game?.phase === 'day-discussion' && game.discussionTime) {
      setDiscussionTimer(game.discussionTime);
      const timer = setInterval(() => {
        setDiscussionTimer(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [game?.phase, game?.discussionTime, game?.round]);

  // Reset states on phase change
  useEffect(() => {
    if (game?.phase === 'night') {
      setSelectedTarget('');
      setInvestigationResult(null);
    }
    if (game?.phase === 'day-voting') {
      setVoteTarget('');
    }
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
      if (data.error) {
        setError(data.error);
        return null;
      }
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

  const handleNightAction = async (type: 'kill' | 'save' | 'shoot' | 'investigate') => {
    if (!selectedTarget) return;
    const result = await apiCall(`/api/rooms/${code}/action`, { playerId, type, targetId: selectedTarget });
    if (type === 'investigate' && result?.investigation) {
      setInvestigationResult(result.investigation);
    }
    if (type !== 'investigate') {
      setSelectedTarget('');
    }
  };

  const handleVote = () => {
    if (!voteTarget) return;
    apiCall(`/api/rooms/${code}/vote`, { playerId, targetId: voteTarget });
  };

  const handleAdvance = (action: string) => apiCall(`/api/rooms/${code}/advance`, { hostId: playerId, action });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-6xl"
        >
          🔍
        </motion.div>
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
            <Button onClick={() => window.location.href = '/'} className="bg-gradient-to-l from-red-700 to-red-600">
              العودة للرئيسية
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!game) return null;

  const alivePlayers = game.players.filter(p => p.isAlive);
  const deadPlayers = game.players.filter(p => !p.isAlive);
  const myPlayer = game.players.find(p => p.id === playerId);

  // Render based on phase
  const renderPhase = () => {
    switch (game.phase) {
      case 'waiting':
        return renderWaitingPhase();
      case 'role-reveal':
        return renderRoleReveal();
      case 'night':
        return renderNightPhase();
      case 'night-result':
        return renderNightResult();
      case 'day-discussion':
        return renderDayDiscussion();
      case 'day-voting':
        return renderDayVoting();
      case 'vote-result':
        return renderVoteResult();
      case 'gameover':
        return renderGameOver();
      default:
        return <div>حالة غير معروفة</div>;
    }
  };

  const renderWaitingPhase = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Step header */}
      <div className="text-center">
        <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">الخطوة ١: انتظار اللاعبين</Badge>
        <h2 className="text-3xl font-bold mb-2">غرفة الانتظار</h2>
        <p className="text-muted-foreground">في انتظار انضمام اللاعبين...</p>
      </div>

      {/* Room code */}
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">رمز الغرفة</p>
          <div className="text-4xl font-mono tracking-[0.3em] font-bold text-red-400 animate-pulse-glow rounded-lg p-3 bg-red-950/30 inline-block">
            {code}
          </div>
          <p className="text-xs text-muted-foreground mt-3">شارك هذا الرمز مع اللاعبين</p>
        </CardContent>
      </Card>

      {/* Players list */}
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            👥 اللاعبون ({game.players.length}/12)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {game.players.map((player, i) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
              >
                <span className="text-2xl">🕵️</span>
                <span className="font-medium">{player.name}</span>
                {player.id === game.hostId && (
                  <Badge className="bg-red-700 text-xs mr-auto">هوست</Badge>
                )}
              </motion.div>
            ))}
          </div>
          {game.players.length < 8 && (
            <p className="text-center text-yellow-500/80 mt-4 text-sm">
              ⏳ يحتاج {8 - game.players.length} لاعب/لاعبين إضافيين على الأقل
            </p>
          )}
        </CardContent>
      </Card>

      {/* Host settings */}
      {isHost && (
        <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
          <CardHeader>
            <CardTitle className="text-lg">⚙️ إعدادات اللعبة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-right block text-sm">عدد المافيا 🔴</Label>
                <Input
                  type="number"
                  min={1}
                  max={Math.floor(game.players.length / 2)}
                  value={settingsForm.mafia}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, mafia: Number(e.target.value) }))}
                  className="text-center bg-input/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-right block text-sm">عدد الأطباء 💚</Label>
                <Input
                  type="number"
                  min={0}
                  max={game.players.length - 2}
                  value={settingsForm.doctors}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, doctors: Number(e.target.value) }))}
                  className="text-center bg-input/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-right block text-sm">عدد القناصين 🔵</Label>
                <Input
                  type="number"
                  min={0}
                  max={game.players.length - 2}
                  value={settingsForm.snipers}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, snipers: Number(e.target.value) }))}
                  className="text-center bg-input/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-right block text-sm">عدد المحققين 🟡</Label>
                <Input
                  type="number"
                  min={0}
                  max={game.players.length - 2}
                  value={settingsForm.investigators}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, investigators: Number(e.target.value) }))}
                  className="text-center bg-input/50"
                />
              </div>
            </div>

            <Separator className="bg-red-900/20" />

            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                المواطنون الصالحون ⚪: {Math.max(0, game.players.length - settingsForm.mafia - settingsForm.doctors - settingsForm.snipers - settingsForm.investigators)}
              </p>
              {(settingsForm.mafia + settingsForm.doctors + settingsForm.snipers + settingsForm.investigators) >= game.players.length && (
                <p className="text-red-400 text-sm">⚠️ عدد الأدوار يتجاوز عدد اللاعبين!</p>
              )}
            </div>

            <Button
              onClick={handleUpdateSettings}
              variant="outline"
              className="w-full border-red-900/40 text-red-400"
              disabled={actionLoading}
            >
              حفظ الإعدادات
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Non-host waiting message */}
      {!isHost && (
        <Card className="bg-card/70 backdrop-blur-sm border-yellow-900/20">
          <CardContent className="p-6 text-center">
            <p className="text-yellow-500/80">⏳ في انتظار الهوست لبدء اللعبة...</p>
          </CardContent>
        </Card>
      )}

      {/* Start button */}
      {isHost && game.players.length >= 8 && (
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={handleStartGame}
            disabled={actionLoading}
            size="lg"
            className="w-full h-16 text-xl font-bold bg-gradient-to-l from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 shadow-lg shadow-red-900/40 animate-pulse-glow"
          >
            🎮 بدء اللعبة
          </Button>
        </motion.div>
      )}
    </motion.div>
  );

  const renderRoleReveal = () => {
    const role = game.playerRole as Role | undefined;
    if (!role) return null;
    const roleInfo = ROLE_INFO[role];

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">الخطوة ٢: كشف الأدوار</Badge>
          <h2 className="text-3xl font-bold mb-2">دورك السري</h2>
          <p className="text-muted-foreground">اضغط لكشف دورك - لا تدع أحداً يرى!</p>
        </div>

        {!roleRevealed ? (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => setRoleRevealed(true)}
              size="lg"
              className="w-full h-24 text-2xl font-bold bg-gradient-to-l from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 animate-pulse-glow shadow-lg shadow-red-900/40"
            >
              🎭 كشف دوري
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <Card className={`role-${role} border-2 backdrop-blur-sm`}>
              <CardContent className="p-8 text-center space-y-4">
                <div className="text-7xl">{roleInfo.emoji}</div>
                <h3 className={`text-3xl font-bold ${roleInfo.color}`}>{roleInfo.name}</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">{roleInfo.description}</p>

                {role === 'mafia' && game.mafiaBuddies && game.mafiaBuddies.length > 0 && (
                  <div className="mt-4 p-4 rounded-lg bg-red-950/40 border border-red-900/30">
                    <p className="text-red-400 font-bold mb-2">زملاؤك في المافيا:</p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {game.mafiaBuddies.map((name, i) => (
                        <Badge key={i} className="bg-red-800 text-white">{name}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={async () => {
                await fetchGame();
              }}
              size="lg"
              className="w-full mt-6 bg-gradient-to-l from-red-700 to-red-600"
            >
              ✅ فهمت
            </Button>
          </motion.div>
        )}
      </motion.div>
    );
  };

  const renderNightPhase = () => {
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
        <p className="text-muted-foreground mt-2">اختر ضحيتك لهذه الليلة</p>
      </div>

      {game.mafiaBuddies && game.mafiaBuddies.length > 0 && (
        <div className="text-center">
          <p className="text-red-400/80 text-sm">زملاؤك: {game.mafiaBuddies.join('، ')}</p>
        </div>
      )}

      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {alivePlayers
              .filter(p => p.role !== 'mafia' || p.id === playerId)
              .map(player => (
                <Button
                  key={player.id}
                  variant={selectedTarget === player.id ? 'default' : 'outline'}
                  className={`h-16 text-base ${
                    selectedTarget === player.id
                      ? 'bg-red-700 hover:bg-red-600 border-red-500'
                      : 'border-red-900/30 text-foreground hover:bg-red-950/30'
                  }`}
                  onClick={() => setSelectedTarget(player.id)}
                >
                  🎯 {player.name}
                </Button>
              ))}
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={() => handleNightAction('kill')}
        disabled={!selectedTarget || actionLoading}
        className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600"
      >
        🗡️ تنفيذ القتل
      </Button>

      {isHost && (
        <Button
          onClick={() => handleAdvance('resolve-night')}
          disabled={actionLoading}
          variant="outline"
          className="w-full border-yellow-800/50 text-yellow-400"
        >
          ☀️ إنهاء الليل (هوست)
        </Button>
      )}
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
              <Button
                key={player.id}
                variant={selectedTarget === player.id ? 'default' : 'outline'}
                className={`h-16 text-base ${
                  selectedTarget === player.id
                    ? 'bg-green-700 hover:bg-green-600 border-green-500'
                    : 'border-green-900/30 text-foreground hover:bg-green-950/30'
                }`}
                onClick={() => setSelectedTarget(player.id)}
              >
                💚 {player.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={() => handleNightAction('save')}
        disabled={!selectedTarget || actionLoading}
        className="w-full h-14 text-lg bg-gradient-to-l from-green-700 to-green-600"
      >
        🛡️ إنقاذ
      </Button>

      {isHost && (
        <Button
          onClick={() => handleAdvance('resolve-night')}
          disabled={actionLoading}
          variant="outline"
          className="w-full border-yellow-800/50 text-yellow-400"
        >
          ☀️ إنهاء الليل (هوست)
        </Button>
      )}
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
          <p className="text-muted-foreground mt-2">لديك رصاصة واحدة فقط - اختر بحكمة!</p>
        )}
      </div>

      {!game.playerSniperUsed ? (
        <>
          <Card className="bg-card/70 backdrop-blur-sm border-blue-900/30">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {alivePlayers.filter(p => p.id !== playerId).map(player => (
                  <Button
                    key={player.id}
                    variant={selectedTarget === player.id ? 'default' : 'outline'}
                    className={`h-16 text-base ${
                      selectedTarget === player.id
                        ? 'bg-blue-700 hover:bg-blue-600 border-blue-500'
                        : 'border-blue-900/30 text-foreground hover:bg-blue-950/30'
                    }`}
                    onClick={() => setSelectedTarget(player.id)}
                  >
                    🎯 {player.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              onClick={() => handleNightAction('shoot')}
              disabled={!selectedTarget || actionLoading}
              className="flex-1 h-14 text-lg bg-gradient-to-l from-blue-700 to-blue-600"
            >
              🔫 إطلاق الرصاصة
            </Button>
            <Button
              onClick={() => setSelectedTarget('')}
              variant="outline"
              className="border-blue-900/30 text-blue-400"
            >
              تخطي
            </Button>
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

      {isHost && (
        <Button
          onClick={() => handleAdvance('resolve-night')}
          disabled={actionLoading}
          variant="outline"
          className="w-full border-yellow-800/50 text-yellow-400"
        >
          ☀️ إنهاء الليل (هوست)
        </Button>
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
                  <Button
                    key={player.id}
                    variant={selectedTarget === player.id ? 'default' : 'outline'}
                    className={`h-16 text-base ${
                      selectedTarget === player.id
                        ? 'bg-yellow-700 hover:bg-yellow-600 border-yellow-500'
                        : 'border-yellow-900/30 text-foreground hover:bg-yellow-950/30'
                    }`}
                    onClick={() => setSelectedTarget(player.id)}
                  >
                    🔍 {player.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={() => handleNightAction('investigate')}
            disabled={!selectedTarget || actionLoading}
            className="w-full h-14 text-lg bg-gradient-to-l from-yellow-700 to-yellow-600 text-black"
          >
            🔍 تحقق
          </Button>
        </>
      ) : (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className={`border-2 ${investigationResult.isMafia ? 'border-red-500 bg-red-950/30' : 'border-green-500 bg-green-950/30'}`}>
            <CardContent className="p-8 text-center space-y-3">
              <div className="text-6xl">{investigationResult.isMafia ? '🔴' : '💚'}</div>
              <h3 className={`text-2xl font-bold ${investigationResult.isMafia ? 'text-red-400' : 'text-green-400'}`}>
                {investigationResult.isMafia ? 'مافيا!' : 'بريء'}
              </h3>
              <p className="text-muted-foreground">
                {investigationResult.isMafia ? 'هذا الشخص من المافيا!' : 'هذا الشخص ليس من المافيا'}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {isHost && (
        <Button
          onClick={() => handleAdvance('resolve-night')}
          disabled={actionLoading}
          variant="outline"
          className="w-full border-yellow-800/50 text-yellow-400"
        >
          ☀️ إنهاء الليل (هوست)
        </Button>
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
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="text-8xl"
          >
            😴
          </motion.div>
          <p className="text-xl text-muted-foreground mt-6">انتظر حتى ينتهي الليل...</p>
        </CardContent>
      </Card>

      {isHost && (
        <Button
          onClick={() => handleAdvance('resolve-night')}
          disabled={actionLoading}
          variant="outline"
          className="w-full border-yellow-800/50 text-yellow-400"
        >
          ☀️ إنهاء الليل (هوست)
        </Button>
      )}
    </motion.div>
  );

  const renderNightResult = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">☀️ نتيجة الليل</Badge>
        <h2 className="text-3xl font-bold">ما حدث الليلة الماضية</h2>
      </div>

      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardContent className="p-6 space-y-4">
          {game.lastNightKilled.length > 0 && game.lastNightKilled.map(killedId => {
            const killedPlayer = game.players.find(p => p.id === killedId);
            return (
              <motion.div
                key={killedId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-red-950/40 border border-red-900/40 text-center"
              >
                <div className="text-4xl mb-2">💀</div>
                <p className="text-red-400 font-bold text-xl">{killedPlayer?.name}</p>
                <p className="text-muted-foreground text-sm">تم قتله هذه الليلة</p>
              </motion.div>
            );
          })}

          {game.lastNightSaved.map(savedId => {
            const savedPlayer = game.players.find(p => p.id === savedId);
            return (
              <motion.div
                key={savedId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-green-950/40 border border-green-900/40 text-center"
              >
                <div className="text-4xl mb-2">🛡️</div>
                <p className="text-green-400 font-bold text-xl">{savedPlayer?.name}</p>
                <p className="text-muted-foreground text-sm">تم إنقاذه هذه الليلة!</p>
              </motion.div>
            );
          })}

          {game.lastNightKilled.length === 0 && game.lastNightSaved.length === 0 && (
            <div className="p-4 rounded-lg bg-secondary/50 text-center">
              <div className="text-4xl mb-2">🌙</div>
              <p className="text-muted-foreground">ليلة هادئة... لم يُقتل أحد</p>
            </div>
          )}
        </CardContent>
      </Card>

      {isHost && (
        <Button
          onClick={() => handleAdvance('advance-to-day')}
          disabled={actionLoading}
          className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600"
        >
          ☀️ الانتقال للنهار
        </Button>
      )}
    </motion.div>
  );

  const renderDayDiscussion = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="border-yellow-800/40 text-yellow-400 mb-3">☀️ النهار - الجولة {game.round}</Badge>
        <h2 className="text-3xl font-bold">وقت النقاش</h2>
        <p className="text-muted-foreground mt-2">ناقشوا معاً - من المافيا؟</p>
      </div>

      {/* Timer */}
      <Card className="bg-card/70 backdrop-blur-sm border-yellow-900/20">
        <CardContent className="p-4">
          <div className="text-center">
            <p className="text-4xl font-mono font-bold text-yellow-400">
              {Math.floor(discussionTimer / 60)}:{(discussionTimer % 60).toString().padStart(2, '0')}
            </p>
            <Progress
              value={(discussionTimer / (game.discussionTime || 180)) * 100}
              className="mt-3 h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Alive players */}
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader>
          <CardTitle className="text-lg">👥 اللاعبون الباقون ({alivePlayers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {alivePlayers.map(player => (
              <div key={player.id} className="p-3 rounded-lg bg-secondary/50 text-center">
                <span>🕵️ {player.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dead players */}
      {deadPlayers.length > 0 && (
        <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
          <CardHeader>
            <CardTitle className="text-lg text-red-400">💀 اللاعبون الخارجون</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {deadPlayers.map(player => (
                <Badge key={player.id} variant="outline" className="border-red-900/30 text-red-400/60 line-through">
                  {player.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isHost && (
        <Button
          onClick={() => handleAdvance('start-voting')}
          disabled={actionLoading}
          className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600"
        >
          🗳️ بدء التصويت
        </Button>
      )}

      {!isHost && (
        <Card className="bg-card/70 backdrop-blur-sm border-yellow-900/20">
          <CardContent className="p-4 text-center">
            <p className="text-yellow-500/80 text-sm">⏳ في انتظار الهوست لبدء التصويت...</p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );

  const renderDayVoting = () => {
    const myVote = game.votes?.[playerId];
    const hasVoted = !!myVote;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">🗳️ التصويت - الجولة {game.round}</Badge>
          <h2 className="text-3xl font-bold">صوّت لإبعاد شخص</h2>
          <p className="text-muted-foreground mt-2">من تريد إبعاده؟</p>
        </div>

        {game.playerIsAlive ? (
          <>
            {!hasVoted ? (
              <>
                <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      {alivePlayers.filter(p => p.id !== playerId).map(player => (
                        <Button
                          key={player.id}
                          variant={voteTarget === player.id ? 'default' : 'outline'}
                          className={`h-16 text-base ${
                            voteTarget === player.id
                              ? 'bg-red-700 hover:bg-red-600 border-red-500'
                              : 'border-red-900/30 text-foreground hover:bg-red-950/30'
                          }`}
                          onClick={() => setVoteTarget(player.id)}
                        >
                          👆 {player.name}
                        </Button>
                      ))}
                    </div>
                    <div className="mt-4">
                      <Button
                        variant={voteTarget === 'skip' ? 'default' : 'outline'}
                        className={`w-full h-12 ${
                          voteTarget === 'skip'
                            ? 'bg-gray-700 hover:bg-gray-600'
                            : 'border-gray-700/30 text-muted-foreground'
                        }`}
                        onClick={() => setVoteTarget('skip')}
                      >
                        ⏭️ تخطي التصويت
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  onClick={handleVote}
                  disabled={!voteTarget || actionLoading}
                  className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600"
                >
                  🗳️ تأكيد التصويت
                </Button>
              </>
            ) : (
              <Card className="bg-card/70 backdrop-blur-sm border-green-900/20">
                <CardContent className="p-6 text-center">
                  <div className="text-5xl mb-3">✅</div>
                  <p className="text-green-400 font-bold">تم التصويت!</p>
                  <p className="text-muted-foreground text-sm mt-2">في انتظار بقية اللاعبين...</p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">أنت خارج اللعبة ولا يمكنك التصويت</p>
            </CardContent>
          </Card>
        )}

        {/* Vote count */}
        {game.votes && Object.keys(game.votes).length > 0 && (
          <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground text-center">
                🗳️ تم التصويت: {Object.keys(game.votes).length} / {alivePlayers.length}
              </p>
            </CardContent>
          </Card>
        )}

        {isHost && (
          <Button
            onClick={() => handleAdvance('resolve-votes')}
            disabled={actionLoading}
            variant="outline"
            className="w-full border-yellow-800/50 text-yellow-400"
          >
            📊 إنهاء التصويت وإحصاء النتائج
          </Button>
        )}
      </motion.div>
    );
  };

  const renderVoteResult = () => {
    const eliminated = game.lastVoteEliminated;
    const eliminatedPlayer = eliminated ? game.players.find(p => p.id === eliminated) : null;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="border-red-900/40 text-red-400 mb-3">📊 نتيجة التصويت</Badge>
          <h2 className="text-3xl font-bold">نتيجة التصويت</h2>
        </div>

        {eliminatedPlayer ? (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Card className="bg-card/70 backdrop-blur-sm border-red-900/50">
              <CardContent className="p-8 text-center space-y-3">
                <div className="text-6xl">💀</div>
                <h3 className="text-2xl font-bold text-red-400">{eliminatedPlayer.name}</h3>
                <p className="text-muted-foreground">تم إبعاده بالتصويت</p>
                {eliminatedPlayer.role && (
                  <div className="mt-4 p-3 rounded-lg bg-secondary/50 inline-block">
                    <span className="text-lg">{ROLE_INFO[eliminatedPlayer.role].emoji} كان {ROLE_INFO[eliminatedPlayer.role].name}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
            <CardContent className="p-8 text-center space-y-3">
              <div className="text-6xl">⚖️</div>
              <h3 className="text-2xl font-bold">تعادل!</h3>
              <p className="text-muted-foreground">لم يتم إبعاد أحد هذه الجولة</p>
            </CardContent>
          </Card>
        )}

        {isHost && (
          <Button
            onClick={() => handleAdvance('advance-to-night')}
            disabled={actionLoading}
            className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600"
          >
            🌙 الانتقال لليل
          </Button>
        )}
      </motion.div>
    );
  };

  const renderGameOver = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="text-8xl mb-4"
        >
          {game.winner === 'mafia' ? '🔴' : '🎉'}
        </motion.div>
        <h2 className="text-4xl font-bold mb-2">
          {game.winner === 'mafia' ? 'المافيا فازت!' : 'المواطنون فازوا!'}
        </h2>
        <p className="text-xl text-muted-foreground">
          {game.winner === 'mafia'
            ? 'سيطرت المافيا على المدينة...'
            : 'تم كشف جميع أفراد المافيا!'}
        </p>
      </div>

      {/* All players reveal */}
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader>
          <CardTitle className="text-lg">🎭 الأدوار الحقيقية</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {game.players.map((player, i) => {
                const role = player.role || 'citizen';
                const roleInfo = ROLE_INFO[role];
                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`p-3 rounded-lg flex items-center gap-3 ${
                      player.isAlive ? 'bg-secondary/50' : 'bg-red-950/20 opacity-60'
                    }`}
                  >
                    <span className="text-2xl">{roleInfo.emoji}</span>
                    <span className={`font-bold ${roleInfo.color}`}>{roleInfo.name}</span>
                    <span className="text-muted-foreground mr-auto">{player.name}</span>
                    {!player.isAlive && <Badge variant="outline" className="border-red-900/30 text-red-400/60 text-xs">خارج</Badge>}
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Button
        onClick={() => window.location.href = '/'}
        className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600"
      >
        🎮 لعبة جديدة
      </Button>
    </motion.div>
  );

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-b from-black via-[oklch(0.08_0.02_280)] to-black -z-10" />
      <div className="fixed inset-0 opacity-5 -z-10" style={{
        backgroundImage: `radial-gradient(circle at 30% 20%, rgba(220,38,38,0.4) 0%, transparent 50%)`,
      }} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-red-900/20">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔍</span>
            <span className="font-bold text-red-400">الجاسوس</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono text-xs border-red-900/40 text-red-400">
              {code}
            </Badge>
            {game.phase !== 'waiting' && game.phase !== 'gameover' && (
              <Badge variant="outline" className="text-xs border-yellow-800/40 text-yellow-400">
                ج{game.round}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/50 border border-red-900/30 text-red-400 text-sm text-center">
            {error}
            <button onClick={() => setError('')} className="mr-2 underline">إغلاق</button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={game.phase}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderPhase()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-red-900/20 bg-background/80 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>🕵️ {myPlayer?.name}</span>
          <span>
            {game.phase === 'waiting' && `👥 ${game.players.length}/12`}
            {game.phase !== 'waiting' && game.phase !== 'gameover' && `⚔️ أحياء: ${alivePlayers.length}`}
          </span>
        </div>
      </footer>
    </div>
  );
}
