import { NextRequest, NextResponse } from 'next/server';
import { createRoom } from '@/lib/game-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hostName, isBotHost } = body;

    if (!hostName || typeof hostName !== 'string' || hostName.trim().length === 0) {
      return NextResponse.json({ error: 'اسم المراقب مطلوب' }, { status: 400 });
    }

    const game = await createRoom(hostName.trim(), { isBotHost: !!isBotHost });

    return NextResponse.json({
      code: game.code,
      hostId: game.hostId,
      hostName: game.hostName,
      players: game.players.map(p => ({ id: p.id, name: p.name })),
    });
  } catch {
    return NextResponse.json({ error: 'خطأ في إنشاء الغرفة' }, { status: 500 });
  }
}
