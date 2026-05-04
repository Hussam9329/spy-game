'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface IOSInstallModalProps {
  show: boolean;
  onClose: () => void;
}

export default function IOSInstallModal({ show, onClose }: IOSInstallModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="bg-card border-purple-500/30 shadow-2xl shadow-purple-900/40">
              <CardHeader className="text-center pb-2">
                <div className="text-5xl mb-2">📱</div>
                <CardTitle className="text-2xl text-purple-400">تثبيت التطبيق</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">3 خطوات بسيطة فقط!</p>
              </CardHeader>
              <CardContent className="space-y-5 pb-6">
                {/* Step 1 */}
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-purple-900/50 flex items-center justify-center shrink-0 text-purple-400 font-bold text-sm">1</div>
                  <div>
                    <p className="font-bold text-sm">اضغط على زر المشاركة</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">ابحث عن هذا الزر أسفل الشاشة:</span>
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-lg">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                          <polyline points="16 6 12 2 8 6"/>
                          <line x1="12" y1="2" x2="12" y2="15"/>
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-purple-900/50 flex items-center justify-center shrink-0 text-purple-400 font-bold text-sm">2</div>
                  <div>
                    <p className="font-bold text-sm">اختر &quot;إضافة للشاشة الرئيسية&quot;</p>
                    <p className="text-xs text-muted-foreground mt-1">مرر للأسفل حتى تجد الخيار</p>
                    <div className="flex items-center gap-2 mt-1 bg-secondary/50 p-2 rounded-lg">
                      <span className="text-lg">➕</span>
                      <span className="text-sm">إضافة للشاشة الرئيسية</span>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-purple-900/50 flex items-center justify-center shrink-0 text-purple-400 font-bold text-sm">3</div>
                  <div>
                    <p className="font-bold text-sm">اضغط &quot;إضافة&quot;</p>
                    <p className="text-xs text-muted-foreground mt-1">سيظهر التطبيق على شاشتك الرئيسية!</p>
                  </div>
                </div>

                {/* Animated arrow */}
                <div className="text-center pt-2">
                  <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-3xl"
                  >
                    ⬇️
                  </motion.div>
                  <p className="text-xs text-purple-400 mt-1">زر المشاركة أسفل الشاشة</p>
                </div>

                <Button
                  onClick={onClose}
                  className="w-full h-12 text-lg bg-gradient-to-l from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500"
                >
                  فهمت! ✅
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
