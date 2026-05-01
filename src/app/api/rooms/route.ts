import { NextRequest, NextResponse } from 'next/server';
import { createRoom } from '@/lib/game-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hostName } = body;

    if (!hostName || typeof hostName !== 'string' || hostName.trim().length === 0) {
      return NextResponse.json({ error: 'اسم الهوست مطلوب' }, { status: 400 });
    }

    const game = await createRoom(hostName.trim());

    return NextResponse.json({
      code: game.code,
      hostId: game.hostId,
      players: game.players.map(p => ({ id: p.id, name: p.name })),
    });
  } catch {
    return NextResponse.json({ error: 'خطأ في إنشاء الغرفة' }, { status: 500 });
  }
}
