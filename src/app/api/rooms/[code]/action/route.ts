import { NextRequest, NextResponse } from 'next/server';
import { submitNightAction } from '@/lib/game-store';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { playerId, type, targetId } = body;

    if (!playerId || !type || !targetId) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    if (!['kill', 'save', 'shoot', 'investigate', 'silence'].includes(type)) {
      return NextResponse.json({ error: 'نوع إجراء غير صالح' }, { status: 400 });
    }

    const result = await submitNightAction(code, playerId, { type, targetId });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (type === 'investigate') {
      const investigation = result.nightActions.investigations.find(
        inv => inv.investigatorId === playerId
      );
      return NextResponse.json({
        success: true,
        investigation: investigation ? { isMafia: investigation.isMafia } : null,
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'خطأ في تنفيذ الإجراء' }, { status: 500 });
  }
}
