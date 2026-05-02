import { NextRequest, NextResponse } from 'next/server';
import { resolveNight, advanceToDay, startVoting, resolveVotes, advanceToNight, advanceFromRoleReveal } from '@/lib/game-store';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { hostId, action } = body;

    if (!hostId) {
      return NextResponse.json({ error: 'معرّف المراقب مطلوب' }, { status: 400 });
    }

    if (action === 'start-night') {
      const result = await advanceFromRoleReveal(code, hostId);
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ phase: result.phase, round: result.round });
    }

    if (action === 'resolve-night') {
      const result = await resolveNight(code, hostId);
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({
        phase: result.phase,
        lastNightKilled: result.lastNightKilled,
        lastNightSaved: result.lastNightSaved,
        lastNightSilenced: result.lastNightSilenced,
        sniperDied: result.sniperDied,
        winner: result.winner,
      });
    }

    if (action === 'advance-to-day') {
      const result = await advanceToDay(code, hostId);
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ phase: result.phase });
    }

    if (action === 'start-voting') {
      const result = await startVoting(code, hostId);
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ phase: result.phase });
    }

    if (action === 'resolve-votes') {
      const result = await resolveVotes(code, hostId);
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({
        phase: result.phase,
        lastVoteEliminated: result.lastVoteEliminated,
        winner: result.winner,
      });
    }

    if (action === 'advance-to-night') {
      const result = await advanceToNight(code, hostId);
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ phase: result.phase, round: result.round });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'خطأ في تنفيذ الإجراء' }, { status: 500 });
  }
}
