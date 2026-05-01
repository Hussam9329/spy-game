import { NextRequest, NextResponse } from 'next/server';
import { resolveNight, advanceToDay } from '@/lib/game-store';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { hostId, action } = body;

    if (!hostId) {
      return NextResponse.json({ error: 'معرّف الهوست مطلوب' }, { status: 400 });
    }

    if (action === 'resolve-night') {
      const result = resolveNight(code, hostId);
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        phase: result.phase,
        lastNightKilled: result.lastNightKilled,
        lastNightSaved: result.lastNightSaved,
        winner: result.winner,
      });
    }

    if (action === 'advance-to-day') {
      const result = advanceToDay(code, hostId);
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        phase: result.phase,
      });
    }

    if (action === 'start-voting') {
      const { startVoting } = await import('@/lib/game-store');
      const result = startVoting(code, hostId);
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        phase: result.phase,
      });
    }

    if (action === 'resolve-votes') {
      const { resolveVotes } = await import('@/lib/game-store');
      const result = resolveVotes(code, hostId);
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        phase: result.phase,
        lastVoteEliminated: result.lastVoteEliminated,
        winner: result.winner,
      });
    }

    if (action === 'advance-to-night') {
      const { advanceToNight } = await import('@/lib/game-store');
      const result = advanceToNight(code, hostId);
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        phase: result.phase,
        round: result.round,
      });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'خطأ في تنفيذ الإجراء' }, { status: 500 });
  }
}
