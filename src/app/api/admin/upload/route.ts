import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: Request) {
  const auth = await getAuthUserFromRequest(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Ej behörig' }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'Ingen fil' }, { status: 400 });

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Endast JPG, PNG, WebP och GIF tillåts' }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Filen får max vara 5 MB' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const filename = `cards/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const blob = await put(filename, file, { access: 'public' });
  return NextResponse.json({ url: blob.url });
}
