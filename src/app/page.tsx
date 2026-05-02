'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';

export default function HomePage() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [hostName, setHostName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redisStatus, setRedisStatus] = useState<'checking' | 'ok' | 'not_configured'>('checking');

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setRedisStatus(data.redis === 'connected' ? 'ok' : 'not_configured');
      })
      .catch(() => {
        setRedisStatus('not_configured');
      });
  }, []);

  const handleCreate = async () => {
    if (!hostName.trim()) {
      setError('الرجاء إدخال اسمك');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: hostName.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      // Store player info in localStorage
      localStorage.setItem(`spygame_${data.code}`, JSON.stringify({
        playerId: data.hostId,
        code: data.code,
        isHost: true,
      }));
      router.push(`/room?code=${data.code}&playerId=${data.hostId}`);
    } catch {
      setError('خطأ في إنشاء الغرفة');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !joinName.trim()) {
      setError('الرجاء إدخال رمز الغرفة واسمك');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/rooms/${joinCode.trim().toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: joinName.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      localStorage.setItem(`spygame_${joinCode.trim().toUpperCase()}`, JSON.stringify({
        playerId: data.playerId,
        code: joinCode.trim().toUpperCase(),
        isHost: false,
      }));
      router.push(`/room?code=${joinCode.trim().toUpperCase()}&playerId=${data.playerId}`);
    } catch {
      setError('خطأ في الانضمام للغرفة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[oklch(0.08_0.02_280)] to-black" />
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `radial-gradient(circle at 20% 50%, rgba(220,38,38,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(220,38,38,0.15) 0%, transparent 40%)`,
      }} />

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-8">
        {/* Logo / Title */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center"
        >
          <div className="text-8xl mb-4 animate-float">🔍</div>
          <h1 className="text-6xl font-bold bg-gradient-to-l from-red-500 via-red-400 to-red-600 bg-clip-text text-transparent mb-3">
            الجاسوس
          </h1>
          <p className="text-xl text-muted-foreground">
            لعبة استنتاج اجتماعية
          </p>
        </motion.div>

        {/* Game description */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          <Card className="bg-card/50 backdrop-blur-sm border-red-900/20">
            <CardContent className="p-5 text-center">
              <p className="text-muted-foreground leading-relaxed text-sm">
                🌙 في كل ليلة، تخرج المافيا لاصطياد ضحاياها...
                <br />
                💚 يتحرك الأطباء لإنقاذ من يستطيعون...
                <br />
                🔵 يصوب القناص رصاصته الأخيرة...
                <br />
                🟡 يبحث المحقق عن الحقيقة...
                <br />
                ☀️ وفي النهار، يقرر الجميع مصير المشتبه بهم!
                <br />
                <span className="text-red-400 font-bold mt-2 block">هل ستكتشف المافيا قبل فوات الأوان؟</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Redis status warning */}
        {redisStatus === 'not_configured' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-yellow-950/30 border-yellow-800/50">
              <CardContent className="p-4 text-center space-y-2">
                <p className="text-yellow-400 font-bold text-sm">تحذير: قاعدة البيانات غير متصلة</p>
                <p className="text-yellow-500/70 text-xs">
                  الغرف لن تعمل بين الأجهزة المختلفة. يجب إعداد Upstash Redis في Vercel.
                  <br />
                  اذهب إلى Vercel Dashboard ← Storage ← Create Database ← Upstash Redis
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Action buttons / forms */}
        <AnimatePresence mode="wait">
          {!showCreate && !showJoin ? (
            <motion.div
              key="buttons"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-4 w-full"
            >
              <Button
                onClick={() => setShowCreate(true)}
                size="lg"
                className="h-14 text-lg font-bold bg-gradient-to-l from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 shadow-lg shadow-red-900/30 transition-all duration-300 hover:scale-105"
              >
                🎮 إنشاء غرفة
              </Button>
              <Button
                onClick={() => setShowJoin(true)}
                size="lg"
                variant="outline"
                className="h-14 text-lg font-bold border-red-900/40 text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-all duration-300 hover:scale-105"
              >
                🚪 انضمام لغرفة
              </Button>
            </motion.div>
          ) : showCreate ? (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              className="w-full"
            >
              <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
                <CardHeader>
                  <CardTitle className="text-center text-red-400">🎮 إنشاء غرفة جديدة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="hostName" className="text-right block">اسمك</Label>
                    <Input
                      id="hostName"
                      placeholder="أدخل اسمك..."
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      className="text-right bg-input/50 border-red-900/30 focus:border-red-500"
                      maxLength={20}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    />
                  </div>
                  {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleCreate}
                      disabled={loading}
                      className="flex-1 bg-gradient-to-l from-red-700 to-red-600 hover:from-red-600 hover:to-red-500"
                    >
                      {loading ? 'جارٍ الإنشاء...' : 'إنشاء'}
                    </Button>
                    <Button
                      onClick={() => { setShowCreate(false); setError(''); }}
                      variant="outline"
                      className="border-red-900/40 text-muted-foreground"
                    >
                      رجوع
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="w-full"
            >
              <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
                <CardHeader>
                  <CardTitle className="text-center text-red-400">🚪 انضمام لغرفة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="roomCode" className="text-right block">رمز الغرفة</Label>
                    <Input
                      id="roomCode"
                      placeholder="مثال: ABC123"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      className="text-center text-lg tracking-widest font-mono bg-input/50 border-red-900/30 focus:border-red-500"
                      maxLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playerName" className="text-right block">اسمك</Label>
                    <Input
                      id="playerName"
                      placeholder="أدخل اسمك..."
                      value={joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      className="text-right bg-input/50 border-red-900/30 focus:border-red-500"
                      maxLength={20}
                      onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    />
                  </div>
                  {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleJoin}
                      disabled={loading}
                      className="flex-1 bg-gradient-to-l from-red-700 to-red-600 hover:from-red-600 hover:to-red-500"
                    >
                      {loading ? 'جارٍ الانضمام...' : 'انضمام'}
                    </Button>
                    <Button
                      onClick={() => { setShowJoin(false); setError(''); }}
                      variant="outline"
                      className="border-red-900/40 text-muted-foreground"
                    >
                      رجوع
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-xs text-muted-foreground/50"
        >
          8-12 لاعب • اللعب الجماعي
        </motion.p>
      </div>
    </div>
  );
}
