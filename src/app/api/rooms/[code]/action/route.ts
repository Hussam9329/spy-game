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

    const result = submitNightAction(code, playerId, { type, targetId });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // If investigator, return investigation result
    if (type === 'investigate') {
      const game = result;
      const investigation = game.nightActions.investigations.find(
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
