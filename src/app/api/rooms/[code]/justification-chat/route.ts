import { NextRequest, NextResponse } from 'next/server';
import { sendJustificationMessage } from '@/lib/game-store';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { playerId, message } = body;

    if (!playerId || !message) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    const result = await sendJustificationMessage(code, playerId, message);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'خطأ في إرسال الرسالة' }, { status: 500 });
  }
}
