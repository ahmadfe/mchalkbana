/**
 * Tar bort interna fält innan ett pass skickas till allmänheten, elever eller trafikskolor.
 * (Allt som skickas till webbläsaren kan läsas i utvecklarverktygen, även om sidan inte visar det.)
 */
export function publicSession<T extends object>(s: T): Omit<T, 'internalNotes' | 'reportToTS' | 'reportedAt' | 'resultsSentAt'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { internalNotes, reportToTS, reportedAt, resultsSentAt, ...rest } = s as T & {
    internalNotes?: unknown; reportToTS?: unknown; reportedAt?: unknown; resultsSentAt?: unknown;
  };
  return rest as Omit<T, 'internalNotes' | 'reportToTS' | 'reportedAt' | 'resultsSentAt'>;
}

/** Bokningen till eleven själv: utan ägarens privata anteckning om obetalt. */
export function ownBooking<T extends object>(b: T): Omit<T, 'payNote'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { payNote, ...rest } = b as T & { payNote?: unknown };
  return rest as Omit<T, 'payNote'>;
}
