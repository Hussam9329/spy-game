import { NextRequest, NextResponse } from 'next/server';
import { startGame } from '@/lib/game-store';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { hostId } = body;

    if (!hostId) {
      return NextResponse.json({ error: 'معرّف المراقب مطلوب' }, { status: 400 });
    }

    const result = await startGame(code, hostId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      phase: result.phase,
      round: result.round,
      players: result.players.map(p => ({ id: p.id, name: p.name, role: p.role })),
    });
  } catch {
    return NextResponse.json({ error: 'خطأ في بدء اللعبة' }, { status: 500 });
  }
}
