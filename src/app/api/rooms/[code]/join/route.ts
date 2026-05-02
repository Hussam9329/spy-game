import { NextRequest, NextResponse } from 'next/server';
import { joinRoom } from '@/lib/game-store';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { playerName } = body;

    if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
      return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
    }

    const result = await joinRoom(code, playerName.trim());
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const player = result.players.find(p => p.name === playerName.trim());

    return NextResponse.json({
      playerId: player?.id,
      code: result.code,
      players: result.players.map(p => ({ id: p.id, name: p.name })),
    });
  } catch {
    return NextResponse.json({ error: 'خطأ في الانضمام للغرفة' }, { status: 500 });
  }
}
