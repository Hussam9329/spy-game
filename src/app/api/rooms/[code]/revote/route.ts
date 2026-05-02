import { NextRequest, NextResponse } from 'next/server';
import { submitRevote } from '@/lib/game-store';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { playerId, targetId } = body;

    if (!playerId || !targetId) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    const result = await submitRevote(code, playerId, targetId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'خطأ في إعادة التصويت' }, { status: 500 });
  }
}
