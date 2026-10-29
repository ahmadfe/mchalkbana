import Anthropic from '@anthropic-ai/sdk';

/*
 * Läser svenska legitimationer (körkort, pass, nationellt id-kort, id-kort) från foton med Claude.
 * Bilderna skickas bara till Claude för läsning – de sparas aldrig hos oss.
 * Resultatet granskas alltid av admin innan något sparas.
 */

export type IdCardType = 'korkort' | 'pass' | 'nationellt_id' | 'id_kort';

export interface ScannedCard {
  firstName: string;
  lastName: string;
  /** Som det står på kortet, gärna ÅÅÅÅMMDD-XXXX; oläsliga siffror som "?" */
  personnummer: string;
  idType: IdCardType | 'okand';
  /** low = något var svårläst, admin bör titta extra */
  confidence: 'high' | 'low';
  note: string;
}

export interface ScanImage { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string }

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['firstName', 'lastName', 'personnummer', 'idType', 'confidence', 'note'],
        properties: {
          firstName: { type: 'string', description: 'Förnamn (alla förnamn som står på kortet)' },
          lastName: { type: 'string', description: 'Efternamn' },
          personnummer: { type: 'string', description: 'ÅÅÅÅMMDD-XXXX. Oläsliga siffror ersätts med ?' },
          idType: { type: 'string', enum: ['korkort', 'pass', 'nationellt_id', 'id_kort', 'okand'] },
          confidence: { type: 'string', enum: ['high', 'low'] },
          note: { type: 'string', description: 'Kort förklaring om något var svårläst eller osäkert, annars tom' },
        },
      },
    },
  },
} as const;

const SYSTEM = `Du läser svenska legitimationshandlingar från foton för registrering av elever till en riskutbildning (körkortsutbildning).
Varje foto kan innehålla flera kort. Gör en rad per kort, även om samma person verkar finnas på två kort.

Korttyper:
- korkort: svenskt körkort (fält 1 = efternamn, 2 = förnamn, 4d = personnummer).
- pass: svenskt pass (efternamn, förnamn, personnummer, maskinläsbar zon längst ner).
- nationellt_id: svenskt nationellt id-kort från Polisen (personnummer och maskinläsbar zon).
- id_kort: annat godkänt id-kort, t.ex. från Skatteverket eller SIS-märkt id-kort.
- okand: om du inte kan avgöra typen.

Regler:
- Personnumret skrivs som ÅÅÅÅMMDD-XXXX. Står det med två årssiffror, använd födelsedatumet på kortet för att få rätt sekel.
- Finns en maskinläsbar zon (rader med <<<), jämför personnumret och namnet med den. Stämmer de inte, sätt confidence low och skriv det i note.
- Gissa aldrig siffror. En siffra du inte kan läsa säkert blir "?" och confidence low.
- Kort som är avskurna, reflekterar eller är suddiga: ta med det du kan läsa, sätt confidence low och förklara kort i note.
- Ta inte med något som inte är en legitimation.`;

let client: Anthropic | null = null;

export async function readIdCards(images: ScanImage[]): Promise<{ cards: ScannedCard[] } | { error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { error: 'ANTHROPIC_API_KEY saknas på servern' };
  client ??= new Anthropic();

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Avslår modellen av säkerhetsskäl körs samma förfrågan om på en annan modell
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
      messages: [{
        role: 'user',
        content: [
          ...images.map(img => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: img.mediaType, data: img.data } })),
          { type: 'text' as const, text: `Läs alla legitimationer på ${images.length === 1 ? 'fotot' : `de ${images.length} fotona`}.` },
        ],
      }],
    });

    if (response.stop_reason === 'refusal') return { error: 'Bilden kunde inte läsas. Försök med ett annat foto.' };
    if (response.stop_reason === 'max_tokens') return { error: 'För många kort på en gång – dela upp på fler foton.' };
    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text;
    if (!text) return { error: 'Inget svar från bildläsningen' };
    const parsed = JSON.parse(text) as { cards: ScannedCard[] };
    return { cards: parsed.cards ?? [] };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { error: 'API-nyckeln för bildläsning fungerar inte' };
    if (e instanceof Anthropic.RateLimitError) return { error: 'För många förfrågningar just nu – vänta en minut och försök igen' };
    if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) return { error: 'Bildläsningen saknar kredit – fyll på i Anthropic Console (Plans & Billing)' };
    if (e instanceof Anthropic.BadRequestError) return { error: 'Bilden kunde inte skickas – prova ett annat foto' };
    if (e instanceof Anthropic.APIError) return { error: `Bildläsningen svarade med fel ${e.status}` };
    if (e instanceof SyntaxError) return { error: 'Svaret från bildläsningen gick inte att tolka' };
    throw e;
  }
}
