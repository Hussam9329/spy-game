import { NextRequest, NextResponse } from 'next/server';
import { updateSettings } from '@/lib/game-store';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { hostId, mafia, doctors, snipers, investigators, discussionTime } = body;

    if (!hostId) {
      return NextResponse.json({ error: 'معرّف المراقب مطلوب' }, { status: 400 });
    }

    const result = await updateSettings(code, hostId, {
      mafia: Number(mafia),
      doctors: Number(doctors),
      snipers: Number(snipers),
      investigators: Number(investigators),
      discussionTime: discussionTime ? Number(discussionTime) : undefined,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'خطأ في تحديث الإعدادات' }, { status: 500 });
  }
}
