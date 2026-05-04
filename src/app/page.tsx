'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import IOSInstallModal from '@/components/IOSInstallModal';

// PWA install prompt type
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function HomePage() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [hostName, setHostName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redisStatus, setRedisStatus] = useState<'checking' | 'ok' | 'not_configured'>('checking');
  const [isBotHost, setIsBotHost] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstall, setShowIOSInstall] = useState(false);

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

  // PWA install prompt handler
  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOSDevice && isSafari) {
      setIsIOS(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
    }
  };

  const handleCreate = async () => {
    if (!hostName.trim()) {
      setError('الرجاء إدخال اسمك كمراقب');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: hostName.trim(), isBotHost }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
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

  // ====== GAME GUIDE COMPONENT ======
  const renderGameGuide = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-red-400 mb-2">📖 دليل اللعبة</h2>
        <p className="text-muted-foreground">كل ما تحتاج معرفته عن لعبة مافيا</p>
      </div>

      {/* Game Overview */}
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader>
          <CardTitle className="text-lg text-red-400">🎯 فكرة اللعبة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>
            مافيا هي لعبة استنتاج اجتماعية تتمحور حول صراع بين فريقين: <span className="text-red-400 font-bold">المافيا</span> التي تحاول السيطرة على المدينة، و<span className="text-green-400 font-bold">المواطنون الصالحون</span> الذين يحاولون كشف المافيا وإبعادها. اللعبة تدور على شكل جولات ليلية ونهارية، حيث يستخدم كل فريق قدراته الخاصة للفوز.
          </p>
          <p>
            تحتاج اللعبة إلى <span className="font-bold text-yellow-400">8-12 لاعب</span> بالإضافة إلى مراقب يدير سير اللعبة. يتم توزيع الأدوار سرّاً في بداية اللعبة، وعلى كل لاعب أن يؤدي دوره بذكاء دون كشف هويته الحقيقية.
          </p>
        </CardContent>
      </Card>

      {/* Roles Section */}
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader>
          <CardTitle className="text-lg text-red-400">🎭 الشخصيات والأدوار</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mafia */}
          <div className="p-4 rounded-lg bg-red-950/30 border border-red-900/30 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔴</span>
              <h3 className="text-lg font-bold text-red-400">المافيا</h3>
              <Badge className="bg-red-800 text-white mr-auto">فريق الشر</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              المافيا هي العدو الخفي في المدينة. يعرف أعضاء المافيا بعضهم البعض منذ بداية اللعبة، ويتواصلون سرّاً خلال الليل لتحديد أهدافهم. مهمتهم هي القضاء على جميع المواطنين الصالحين حتى يصبح عددهم مساوياً أو أكبر من عدد الصالحين.
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-xs font-bold text-red-300">🗡️ القدرات الليلية:</p>
              <ul className="text-xs text-muted-foreground space-y-1 mr-4 list-disc">
                <li><span className="text-red-300">القتل:</span> يصوت أعضاء المافيا على ضحية واحدة لقتلها كل ليلة. إذا اختلفوا (تعادل)، لا يُقتل أحد.</li>
                <li><span className="text-purple-300">التسكيت:</span> يصوتون على شخص لتسكيته في اليوم التالي. الشخص المسكّت لا يستطيع المشاركة في النقاش لكنه يستطيع التصويت.</li>
                <li><span className="text-red-300">الدردشة السرية:</span> يتواصل أعضاء المافيا في دردشة خاصة خلال الليل لتنسيق خططهم.</li>
              </ul>
            </div>
            <div className="mt-2">
              <p className="text-xs font-bold text-red-300">📋 استراتيجية:</p>
              <p className="text-xs text-muted-foreground">يجب على المافيا التنكر كمواطنين صالحين خلال النهار والمشاركة في النقاش العام لتجنب الشبهة. يمكنهم الاتفاق على شخص بريء للتصويت ضده لتوجيه الاتهام بعيداً عنهم.</p>
            </div>
          </div>

          {/* Doctor */}
          <div className="p-4 rounded-lg bg-green-950/30 border border-green-900/30 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💚</span>
              <h3 className="text-lg font-bold text-green-400">الطبيب</h3>
              <Badge className="bg-green-800 text-white mr-auto">فريق الخير</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              الطبيب هو الحامي الأول للمدينة. كل ليلة يختار شخصاً واحداً لإنقاذه من القتل. إذا اختار الطبيب الشخص نفسه الذي استهدفته المافيا، يُنقذ ولا يُقتل. اللعبة تحتوي على طبيب واحد فقط، لذا عليه استخدام قدرته بحكمة.
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-xs font-bold text-green-300">🛡️ القدرات والقيود:</p>
              <ul className="text-xs text-muted-foreground space-y-1 mr-4 list-disc">
                <li><span className="text-green-300">الإنقاذ:</span> يختار شخصاً واحداً كل ليلة لحمايته من القتل.</li>
                <li><span className="text-green-300">الإنقاذ الذاتي:</span> يمكنه إنقاذ نفسه مرة واحدة فقط خلال اللعبة بأكملها.</li>
                <li><span className="text-yellow-300">⚠️ قيد التكرار:</span> لا يمكنه إنقاذ نفس الشخص ليلتين متتاليتين.</li>
              </ul>
            </div>
            <div className="mt-2">
              <p className="text-xs font-bold text-green-300">📋 استراتيجية:</p>
              <p className="text-xs text-muted-foreground">من الأفضل حماية اللاعبين الذين يبدون مهمين للفريق أو الذين يشتبه بأنهم أهداف محتملة للمافيا. لا تكشف عن هويتك بسهولة لأن المافيا قد تستهدفك أولاً.</p>
            </div>
          </div>

          {/* Sniper */}
          <div className="p-4 rounded-lg bg-blue-950/30 border border-blue-900/30 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔵</span>
              <h3 className="text-lg font-bold text-blue-400">القناص</h3>
              <Badge className="bg-blue-800 text-white mr-auto">فريق الخير</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              القناص يمتلك رصاصة واحدة فقط يطلقها بحكمة. إذا أصاب عضواً من المافيا، يموت المافيا وينجو القناص. لكن إذا أصاب مواطناً بريئاً، يموت الهدف ويموت القناص معه كعقاب! لذا يجب أن يكون متأكداً من هدفه قبل الإطلاق.
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-xs font-bold text-blue-300">🔫 القدرات والقيود:</p>
              <ul className="text-xs text-muted-foreground space-y-1 mr-4 list-disc">
                <li><span className="text-blue-300">الإطلاق:</span> رصاصة واحدة فقط طوال اللعبة. يمكنه التخطي إذا لم يكن متأكداً.</li>
                <li><span className="text-red-300">⚠️ العقوبة:</span> إذا أصاب بريئاً (غير مافيا)، يموت القناص معه!</li>
                <li><span className="text-green-300">✅ الإصابة الصحيحة:</span> إذا أصاب مافيا، يموت المافيا فقط ويعيش القناص.</li>
                <li><span className="text-blue-300">الحماية:</span> إذا أنقذ الطبيب هدف القناص، لا يموت أحد.</li>
              </ul>
            </div>
            <div className="mt-2">
              <p className="text-xs font-bold text-blue-300">📋 استراتيجية:</p>
              <p className="text-xs text-muted-foreground">لا تتعجل بإطلاق الرصاصة! راقب سلوك اللاعبين خلال النقاشات وجمع معلومات من المحقق إن أمكن. من الأفضل التأكد قبل المخاطرة بحياتك. يمكنك التخطي كل ليلة حتى تتأكد.</p>
            </div>
          </div>

          {/* Investigator */}
          <div className="p-4 rounded-lg bg-yellow-950/30 border border-yellow-900/30 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🟡</span>
              <h3 className="text-lg font-bold text-yellow-400">المحقق</h3>
              <Badge className="bg-yellow-800 text-black mr-auto">فريق الخير</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              المحقق هو عين المواطنين الصالحين. كل ليلة يتحقق من هوية شخص واحد ليعرف ما إذا كان من المافيا أم لا. هذه المعلومة قيمة جداً لكن المحقق يجب أن يكون حذراً في كيفية كشفها للآخرين، لأن المافيا قد تستهدفه إذا علمت بوجوده.
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-xs font-bold text-yellow-300">🔍 القدرات:</p>
              <ul className="text-xs text-muted-foreground space-y-1 mr-4 list-disc">
                <li><span className="text-yellow-300">التحقيق:</span> يختار شخصاً واحداً كل ليلة لمعرفة ما إذا كان مافيا أو بريئاً.</li>
                <li><span className="text-yellow-300">النتيجة الفورية:</span> تظهر النتيجة مباشرة بعد التحقيق (أحمر = مافيا، أخضر = بريء).</li>
              </ul>
            </div>
            <div className="mt-2">
              <p className="text-xs font-bold text-yellow-300">📋 استراتيجية:</p>
              <p className="text-xs text-muted-foreground">لا تكشف معلوماتك كلها مرة واحدة. استخدم أسلوب التلميح بدل التصريح. إذا اكتشفت مافيا، حاول توجيه النقاش نحوه دون أن تكشف أنك المحقق. يمكنك مشاركة المعلومات مع شخص تثق به تدريجياً.</p>
            </div>
          </div>

          {/* Citizen */}
          <div className="p-4 rounded-lg bg-gray-950/30 border border-gray-700/30 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚪</span>
              <h3 className="text-lg font-bold text-gray-300">المواطن الصالح</h3>
              <Badge className="bg-gray-700 text-white mr-auto">فريق الخير</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              المواطن الصالح لا يملك أي قدرات خاصة في الليل، لكنه يشكل العمود الفقري للفريق الصالح. قوته تكمن في الملاحظة والاستنتاج والمشاركة الفعّالة في النقاشات والتصويت بحكمة. بدون المواطنين، لا يمكن للفريق الصالح الفوز.
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-xs font-bold text-gray-300">📋 الدور:</p>
              <ul className="text-xs text-muted-foreground space-y-1 mr-4 list-disc">
                <li><span className="text-gray-300">الليل:</span> ينتظر حتى ينتهي الليل بسلام.</li>
                <li><span className="text-gray-300">النهار:</span> يشارك في النقاش والتصويت لإبعاد المشتبه بهم.</li>
                <li><span className="text-gray-300">القوة:</span> الاستماع الجيد وملاحظة التناقضات في كلام الآخرين.</li>
              </ul>
            </div>
            <div className="mt-2">
              <p className="text-xs font-bold text-gray-300">📋 استراتيجية:</p>
              <p className="text-xs text-muted-foreground">راقب من يدافع عن مَن، ومن يصمت عند سؤال معين. المواطن الذكي هو من يربط بين التصرفات والكلمات لا من يتبع الأغلبية بلا تفكير. لا تتردد في طرح الأسئلة والشكوك.</p>
            </div>
          </div>

          {/* Host */}
          <div className="p-4 rounded-lg bg-purple-950/30 border border-purple-900/30 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👁️</span>
              <h3 className="text-lg font-bold text-purple-400">المراقب (الهوست)</h3>
              <Badge className="bg-purple-800 text-white mr-auto">مدير اللعبة</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              المراقب ليس لاعباً بل هو من يدير سير اللعبة. يرى جميع الأدوار والإجراءات الليلية، ويتحكم في الانتقال بين المراحل. يمكنه اختيار وضع "بوت المراقب" للتقدم التلقائي بين المراحل.
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-xs font-bold text-purple-300">📋 الصلاحيات:</p>
              <ul className="text-xs text-muted-foreground space-y-1 mr-4 list-disc">
                <li>بدء اللعبة وتعديل الإعدادات (عدد كل دور، أوقات النقاش والتصويت)</li>
                <li>الانتقال بين المراحل: إنهاء الليل، بدء التصويت، بدء التبرير، إعادة التصويت</li>
                <li>مشاهدة جميع الأدوار وتفاصيل الإجراءات الليلية</li>
                <li>يمكنه تفعيل وضع "بوت المراقب" للتقدم التلقائي</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Game Phases */}
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader>
          <CardTitle className="text-lg text-red-400">🌙☀️ مراحل اللعبة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Night Phase */}
          <div className="space-y-2">
            <h3 className="font-bold text-blue-300 flex items-center gap-2">🌙 المرحلة الليلية</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              في الليل، يقوم كل صاحب دور بتنفيذ قدرته سرّاً:
            </p>
            <div className="mr-4 space-y-2 text-sm">
              <div className="flex gap-2 items-start">
                <span className="text-red-400 shrink-0">1.</span>
                <p><span className="text-red-400 font-bold">المافيا</span> تتفق على ضحية للقتل وشخص لتسكيت عبر الدردشة السرية بين أعضائها. إذا تعادلوا في التصويت، لا يُقتل ولا يُسكّت أحد.</p>
              </div>
              <div className="flex gap-2 items-start">
                <span className="text-green-400 shrink-0">2.</span>
                <p><span className="text-green-400 font-bold">الطبيب</span> يختار شخصاً لإنقاذه. إذا كان الشخص المختار هو نفسه هدف المافيا، ينجو من القتل.</p>
              </div>
              <div className="flex gap-2 items-start">
                <span className="text-blue-400 shrink-0">3.</span>
                <p><span className="text-blue-400 font-bold">القناص</span> يختار هدفاً لإطلاق رصاصته الوحيدة أو يتخطى إذا لم يكن متأكداً.</p>
              </div>
              <div className="flex gap-2 items-start">
                <span className="text-yellow-400 shrink-0">4.</span>
                <p><span className="text-yellow-400 font-bold">المحقق</span> يتحقق من شخص ليعرف إن كان مافيا أو بريئاً.</p>
              </div>
            </div>
          </div>

          <Separator className="bg-red-900/20" />

          {/* Night Result */}
          <div className="space-y-2">
            <h3 className="font-bold text-orange-300 flex items-center gap-2">☀️ نتيجة الليل</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              بعد انتهاء جميع الإجراءات الليلية، يعلن المراقب النتائج: مَن قُتل، مَن أُنقذ، ومَن سُكّت. اللاعبون المقتولون يخرجون من اللعبة ولا يعودون إليها. اللاعبون المسكّتون لا يستطيعون المشاركة في النقاش لكنهم يستطيعون التصويت.
            </p>
          </div>

          <Separator className="bg-red-900/20" />

          {/* Day Discussion */}
          <div className="space-y-2">
            <h3 className="font-bold text-yellow-300 flex items-center gap-2">☀️ النقاش النهاري</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ينتقل الناجون إلى مرحلة النقاش حيث يمكن للجميع التحدث عبر الدردشة العامة. يتم تحديد وقت النقاش من قبل المراقب (افتراضياً 3 دقائق). يحاول اللاعبون تحديد هوية المافيا من خلال النقاش والاستنتاج، بينما تحاول المافيا التنكر والتشكيك بالآخرين.
            </p>
            <div className="mt-1 mr-4 text-xs text-muted-foreground space-y-1">
              <p>• اللاعبون المسكّتون يستطيعون التصويت لكن لا يستطيعون المشاركة في الدردشة</p>
              <p>• المافيا تستخدم الدردشة العامة للتنكر كمواطنين صالحين</p>
              <p>• بعد انتهاء وقت النقاش، يبدأ التصويت</p>
            </div>
          </div>

          <Separator className="bg-red-900/20" />

          {/* Day Voting */}
          <div className="space-y-2">
            <h3 className="font-bold text-red-300 flex items-center gap-2">🗳️ التصويت</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              كل لاعب حي يصوت لشخص يريد إبعاده أو يختار التخطي. التصويت سري - لا يرى اللاعبون أصوات بعضهم. الشخص الذي يحصل على أكبر عدد من الأصوات يصبح "المتهم" ويحصل على فرصة للدفاع عن نفسه.
            </p>
            <div className="mt-1 mr-4 text-xs text-muted-foreground space-y-1">
              <p>• لا يمكنك التصويت ضد نفسك</p>
              <p>• لا يمكنك تغيير صوتك بعد تأكيده</p>
              <p>• إذا تعادل صوتان أو أكثر، يصبحون جميعاً متهمين</p>
              <p>• إذا لم يحصل أحد على أصوات، تنتقل اللعبة مباشرة لليل</p>
            </div>
          </div>

          <Separator className="bg-red-900/20" />

          {/* Justification */}
          <div className="space-y-2">
            <h3 className="font-bold text-orange-300 flex items-center gap-2">🎤 التبرير (الدفاع)</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              المتهم يحصل على وقت محدد (افتراضياً 60 ثانية) لكتابة تبريره في الدردشة. باقي اللاعبين يقرأون تبريره لكنهم لا يستطيعون الكتابة خلال هذه المرحلة. الهدف هو إقناع الآخرين ببراءته لتجنب الإبعاد.
            </p>
          </div>

          <Separator className="bg-red-900/20" />

          {/* Revote */}
          <div className="space-y-2">
            <h3 className="font-bold text-purple-300 flex items-center gap-2">🗳️ إعادة التصويت</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              بعد التبرير، يُعاد التصويت وهذه المرة يمكن لجميع اللاعبين الأحياء التصويت على أي شخص (وليس فقط المتهم). المتهم أيضاً يستطيع التصويت على أي شخص ما عدا نفسه. إذا حصل المتهم على أغلبية الأصوات، يُبعد من اللعبة. وإذا تعادل الأصوات أو تخطى الجميع، لا يُبعد أحد.
            </p>
          </div>

          <Separator className="bg-red-900/20" />

          {/* Night Again */}
          <div className="space-y-2">
            <h3 className="font-bold text-blue-300 flex items-center gap-2">🔄 تكرار الجولات</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              بعد انتهاء التصويت النهائي، تعود اللعبة لليل وتبدأ جولة جديدة. تستمر اللعبة حتى يتحقق أحد شروط الفوز.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Win Conditions */}
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader>
          <CardTitle className="text-lg text-red-400">🏆 شروط الفوز</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-900/20">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🔴</span>
              <h4 className="font-bold text-red-400">فوز المافيا</h4>
            </div>
            <p className="text-sm text-muted-foreground">عندما يصبح عدد أعضاء المافيا الأحياء مساوياً أو أكبر من عدد الصالحين الأحياء. في هذه الحالة لا يستطيع الصالحون إبعادهم بالتصويت.</p>
          </div>
          <div className="p-3 rounded-lg bg-green-950/30 border border-green-900/20">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">💚</span>
              <h4 className="font-bold text-green-400">فوز المواطنين</h4>
            </div>
            <p className="text-sm text-muted-foreground">عندما يتم إبعاد أو قتل جميع أعضاء المافيا. تُكشف جميع الأدوار عند انتهاء اللعبة.</p>
          </div>
        </CardContent>
      </Card>

      {/* Special Rules */}
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader>
          <CardTitle className="text-lg text-red-400">⚡ قواعد خاصة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex gap-2 items-start">
            <span className="text-purple-400 shrink-0">🤫</span>
            <p><span className="text-purple-400 font-bold">التسكيت:</span> الشخص المسكّت لا يستطيع المشاركة في الدردشة العامة لكنه يستطيع التصويت بشكل طبيعي. التسكيت يستمر جولة واحدة فقط.</p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-green-400 shrink-0">🛡️</span>
            <p><span className="text-green-400 font-bold">إنقاذ الطبيب المزدوج:</span> الطبيب يمكنه إنقاذ نفسه مرة واحدة فقط باللعبة، ولا يمكنه إنقاذ نفس الشخص ليلتين متتاليتين.</p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-blue-400 shrink-0">💀</span>
            <p><span className="text-blue-400 font-bold">عقوبة القناص:</span> إذا أطلق القناص النار على شخص بريء (غير مافيا)، يموت القناص معه! إذا أنقذ الطبيب هدف القناص، لا يموت أحد.</p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-red-400 shrink-0">⚔️</span>
            <p><span className="text-red-400 font-bold">تعادل المافيا:</span> إذا تعادل أعضاء المافيا في اختيار هدف القتل أو التسكيت، لا يُنفذ أي إجراء تلك الليلة.</p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-gray-400 shrink-0">🗳️</span>
            <p><span className="text-gray-400 font-bold">التصويت:</span> لا يمكنك التصويت ضد نفسك أو تغيير صوتك بعد تأكيده. التصويت سري بين اللاعبين (المراقب فقط يرى التفاصيل).</p>
          </div>
        </CardContent>
      </Card>

      {/* Game Flow Diagram */}
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader>
          <CardTitle className="text-lg text-red-400">🔄 تسلسل اللعبة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 text-sm">
            <div className="px-4 py-2 rounded-lg bg-purple-950/40 border border-purple-800/30 text-purple-300 font-bold">👁️ إنشاء غرفة + انضمام اللاعبين</div>
            <span className="text-muted-foreground">⬇️</span>
            <div className="px-4 py-2 rounded-lg bg-yellow-950/40 border border-yellow-800/30 text-yellow-300 font-bold">🎭 كشف الأدوار</div>
            <span className="text-muted-foreground">⬇️</span>
            <div className="px-4 py-2 rounded-lg bg-blue-950/40 border border-blue-800/30 text-blue-300 font-bold">🌙 الليل (إجراءات سرية)</div>
            <span className="text-muted-foreground">⬇️</span>
            <div className="px-4 py-2 rounded-lg bg-orange-950/40 border border-orange-800/30 text-orange-300 font-bold">☀️ نتيجة الليل</div>
            <span className="text-muted-foreground">⬇️</span>
            <div className="px-4 py-2 rounded-lg bg-yellow-950/40 border border-yellow-800/30 text-yellow-300 font-bold">💬 النقاش النهاري</div>
            <span className="text-muted-foreground">⬇️</span>
            <div className="px-4 py-2 rounded-lg bg-red-950/40 border border-red-800/30 text-red-300 font-bold">🗳️ التصويت</div>
            <span className="text-muted-foreground">⬇️</span>
            <div className="px-4 py-2 rounded-lg bg-orange-950/40 border border-orange-800/30 text-orange-300 font-bold">🎤 تبرير المتهم</div>
            <span className="text-muted-foreground">⬇️</span>
            <div className="px-4 py-2 rounded-lg bg-red-950/40 border border-red-800/30 text-red-300 font-bold">🗳️ إعادة التصويت</div>
            <span className="text-muted-foreground">⬇️</span>
            <div className="px-4 py-2 rounded-lg bg-green-950/40 border border-green-800/30 text-green-300 font-bold">📊 النتيجة النهائية</div>
            <span className="text-muted-foreground">⬇️</span>
            <div className="px-4 py-2 rounded-lg bg-blue-950/40 border border-blue-800/30 text-blue-300 font-bold">🌙 العودة لليل (جولة جديدة)</div>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-3">تتكرر الدورة حتى يفوز أحد الفريقين</p>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
        <CardHeader>
          <CardTitle className="text-lg text-red-400">💡 نصائح ذهبية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex gap-2 items-start">
            <span className="text-yellow-400 shrink-0">💡</span>
            <p>لا تكشف دورك بسرعة! خاصة إذا كنت محققاً أو طبيباً، لأن المافيا ستستهدفك.</p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-yellow-400 shrink-0">💡</span>
            <p>راقب مَن يدافع عن مَن. المافيا غالباً ما تدافع عن بعضها بشكل غير مباشر.</p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-yellow-400 shrink-0">💡</span>
            <p>لا تتبع الأغلبية بلا تفكير. أحياناً المافيا تقود التصويت لإبعاد شخص بريء.</p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-yellow-400 shrink-0">💡</span>
            <p>إذا كنت من المافيا، شارك في النقاش بشكل طبيعي ولا تلتزم الصمت. الصمت يثير الشبهة!</p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-yellow-400 shrink-0">💡</span>
            <p>القناص لا يجب أن يطلق رصاصته فوراً. الانتظار وجمع المعلومات أفضل من المخاطرة.</p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-yellow-400 shrink-0">💡</span>
            <p>الطبيب يجب أن يغير هدف الإنقاذ كل ليلة لتغطية أكبر عدد من اللاعبين المهمين.</p>
          </div>
        </CardContent>
      </Card>

      {/* Back button */}
      <Button onClick={() => setShowGuide(false)} className="w-full h-14 text-lg bg-gradient-to-l from-red-700 to-red-600 hover:from-red-600 hover:to-red-500">
        🔙 العودة للرئيسية
      </Button>
    </motion.div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-start sm:justify-center p-4 pt-8 sm:pt-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[oklch(0.08_0.02_280)] to-black" />
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `radial-gradient(circle at 20% 50%, rgba(220,38,38,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(220,38,38,0.15) 0%, transparent 40%)`,
      }} />

      <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col items-center gap-6 px-2">
        {/* Logo / Title */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center"
        >
          <div className="text-7xl sm:text-8xl mb-4 animate-float">🔫</div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold bg-gradient-to-l from-red-500 via-red-400 to-red-600 bg-clip-text text-transparent mb-2 leading-tight">
            مافيا
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground">
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
            <CardContent className="p-4 sm:p-5 text-center">
              <p className="text-muted-foreground leading-relaxed text-sm">
                🔴 المافيا تقتل وتسكّت كل ليلة...
                <br />
                💚 الطبيب ينقذ من يستطيع...
                <br />
                🔵 القناص يخاطر بحياته مع كل رصاصة...
                <br />
                🟡 المحقق يبحث عن الحقيقة...
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
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-yellow-950/30 border-yellow-800/50">
              <CardContent className="p-4 text-center space-y-2">
                <p className="text-yellow-400 font-bold text-sm">تحذير: قاعدة البيانات غير متصلة</p>
                <p className="text-yellow-500/70 text-xs">
                  الغرف لن تعمل بين الأجهزة المختلفة. يجب إعداد Upstash Redis في Vercel.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Action buttons / forms / guide */}
        <AnimatePresence mode="wait">
          {showGuide ? (
            renderGameGuide()
          ) : !showCreate && !showJoin ? (
            <motion.div key="buttons" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col gap-4 w-full">
              <Button onClick={() => setShowCreate(true)} size="lg" className="h-14 text-lg font-bold bg-gradient-to-l from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 shadow-lg shadow-red-900/30 transition-all duration-300 hover:scale-105">
                🎮 إنشاء غرفة
              </Button>
              <Button onClick={() => setShowJoin(true)} size="lg" variant="outline" className="h-14 text-lg font-bold border-red-900/40 text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-all duration-300 hover:scale-105">
                🚪 انضمام لغرفة
              </Button>
              <Button onClick={() => setShowGuide(true)} size="lg" variant="outline" className="h-14 text-lg font-bold border-yellow-900/40 text-yellow-400 hover:bg-yellow-950/30 hover:text-yellow-300 transition-all duration-300 hover:scale-105">
                📖 تعليمات اللعبة
              </Button>
              {/* PWA Install Button - shows on both Android and iOS */}
              {!isInstalled && (installPrompt || isIOS) && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
                  <Button 
                    onClick={isIOS ? () => setShowIOSInstall(true) : handleInstallApp} 
                    size="lg" 
                    className="h-14 text-lg font-bold w-full bg-gradient-to-l from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500 shadow-lg shadow-purple-900/30 transition-all duration-300 hover:scale-105"
                  >
                    📲 تحميل التطبيق
                  </Button>
                </motion.div>
              )}
            </motion.div>
          ) : showCreate ? (
            <motion.div key="create" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="w-full">
              <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
                <CardHeader>
                  <CardTitle className="text-center text-red-400">🎮 إنشاء غرفة جديدة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="hostName" className="text-right block">اسمك (مراقب)</Label>
                    <Input id="hostName" placeholder="أدخل اسمك كمراقب..." value={hostName} onChange={(e) => setHostName(e.target.value)} className="text-right bg-input/50 border-red-900/30 focus:border-red-500" maxLength={20} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
                  </div>
                  <div className="flex items-center gap-3 justify-center">
                    <input
                      type="checkbox"
                      id="botHost"
                      checked={isBotHost}
                      onChange={(e) => setIsBotHost(e.target.checked)}
                      className="w-4 h-4 rounded border-red-900/40 accent-red-600"
                    />
                    <Label htmlFor="botHost" className="text-sm cursor-pointer">🤖 بوت المراقب (تقدم تلقائي)</Label>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">المراقب يتحكم بسير اللعبة ويرى كل الأدوار لكنه لا يلعب</p>
                  {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                  <div className="flex gap-3">
                    <Button onClick={handleCreate} disabled={loading} className="flex-1 bg-gradient-to-l from-red-700 to-red-600 hover:from-red-600 hover:to-red-500">
                      {loading ? 'جارٍ الإنشاء...' : 'إنشاء'}
                    </Button>
                    <Button onClick={() => { setShowCreate(false); setError(''); }} variant="outline" className="border-red-900/40 text-muted-foreground">
                      رجوع
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div key="join" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="w-full">
              <Card className="bg-card/70 backdrop-blur-sm border-red-900/30">
                <CardHeader>
                  <CardTitle className="text-center text-red-400">🚪 انضمام لغرفة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="roomCode" className="text-right block">رمز الغرفة</Label>
                    <Input id="roomCode" placeholder="مثال: ABC123" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} className="text-center text-lg tracking-widest font-mono bg-input/50 border-red-900/30 focus:border-red-500" maxLength={6} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playerName" className="text-right block">اسمك</Label>
                    <Input id="playerName" placeholder="أدخل اسمك..." value={joinName} onChange={(e) => setJoinName(e.target.value)} className="text-right bg-input/50 border-red-900/30 focus:border-red-500" maxLength={20} onKeyDown={(e) => e.key === 'Enter' && handleJoin()} />
                  </div>
                  {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                  <div className="flex gap-3">
                    <Button onClick={handleJoin} disabled={loading} className="flex-1 bg-gradient-to-l from-red-700 to-red-600 hover:from-red-600 hover:to-red-500">
                      {loading ? 'جارٍ الانضمام...' : 'انضمام'}
                    </Button>
                    <Button onClick={() => { setShowJoin(false); setError(''); }} variant="outline" className="border-red-900/40 text-muted-foreground">
                      رجوع
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="text-xs text-muted-foreground/50">
          8-12 لاعب • اللعب الجماعي • مراقب يدير اللعبة
        </motion.p>

        {/* Copyright Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="text-center space-y-1 pt-4"
        >
          <Separator className="bg-red-900/20 mb-4" />
          <p className="text-sm text-muted-foreground/60 font-medium">
            صناعة اللعبة بواسطة <span className="text-red-400 font-bold">HussamVision</span> 2026
          </p>
          <p className="text-xs text-muted-foreground/30">
            جميع الحقوق محفوظة
          </p>
        </motion.div>
      </div>

      {/* iOS Install Instruction Modal */}
      <IOSInstallModal show={showIOSInstall} onClose={() => setShowIOSInstall(false)} />
    </div>
  );
}
