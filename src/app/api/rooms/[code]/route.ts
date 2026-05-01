import { NextRequest, NextResponse } from 'next/server';
import { getPublicGameState } from '@/lib/game-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const playerId = request.nextUrl.searchParams.get('playerId');

    const game = getPublicGameState(code, playerId || undefined);
    if (!game) {
      return NextResponse.json({ error: 'الغرفة غير موجودة' }, { status: 404 });
    }

    return NextResponse.json(game);
  } catch {
    return NextResponse.json({ error: 'خطأ في جلب بيانات الغرفة' }, { status: 500 });
  }
}
