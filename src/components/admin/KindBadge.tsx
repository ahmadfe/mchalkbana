import clsx from 'clsx';
import { COURSE_KIND_LABEL, courseKind } from '@/lib/courseKind';

export default function KindBadge({ type }: { type: string }) {
  const kind = courseKind(type);
  return (
    <span className={clsx(
      'inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide shrink-0',
      kind === 'risk1' && 'bg-amber-500/15 text-amber-300',
      kind === 'risk2' && 'bg-sky-500/15 text-sky-300',
      kind === 'kombo' && 'bg-violet-500/15 text-violet-300',
      kind === 'other' && 'bg-white/10 text-white/70',
    )}>
      {COURSE_KIND_LABEL[kind]}
    </span>
  );
}
