export interface City {
  name: string;
  slug: string;
  distance: number; // km from Alunda
  driveMinutes: number;
  county: string;
  directions: string;
}

export const CITIES: City[] = [
  { name: 'Uppsala', slug: 'uppsala', distance: 40, driveMinutes: 35, county: 'Uppsala län', directions: 'Ta E4 norrut mot Gävle, ta av mot Alunda/Österbybruk vid Tierp-avfarten och följ skyltarna till Norrlövsta.' },
  { name: 'Stockholm', slug: 'stockholm', distance: 90, driveMinutes: 75, county: 'Stockholms län', directions: 'Ta E4 norrut mot Uppsala, fortsätt förbi Uppsala och ta av mot Alunda/Österbybruk. Följ väg 282 till Norrlövsta.' },
  { name: 'Västerås', slug: 'vasteras', distance: 85, driveMinutes: 70, county: 'Västmanlands län', directions: 'Ta E18 österut mot Uppsala, ta av mot Uppsala och fortsätt på E4 norrut. Ta sedan av mot Alunda och följ skyltarna.' },
  { name: 'Enköping', slug: 'enkoping', distance: 65, driveMinutes: 55, county: 'Uppsala län', directions: 'Ta E18 österut mot Uppsala, fortsätt på E4 norrut förbi Uppsala och ta av mot Alunda/Österbybruk.' },
  { name: 'Sigtuna', slug: 'sigtuna', distance: 75, driveMinutes: 60, county: 'Stockholms län', directions: 'Ta E4 norrut mot Uppsala, passera Uppsala och ta av mot Alunda vid väg 282. Följ skyltarna till Norrlövsta.' },
  { name: 'Märsta', slug: 'marsta', distance: 72, driveMinutes: 58, county: 'Stockholms län', directions: 'Ta E4 norrut, passera Arlanda och Uppsala, ta sedan av mot Alunda via väg 282.' },
  { name: 'Norrtälje', slug: 'norrtalje', distance: 95, driveMinutes: 80, county: 'Stockholms län', directions: 'Ta väg 76 västerut mot Uppsala, anslut till E4 norrut och ta av mot Alunda/Österbybruk.' },
  { name: 'Tierp', slug: 'tierp', distance: 30, driveMinutes: 25, county: 'Uppsala län', directions: 'Ta väg 292 österut från Tierp direkt mot Alunda. Följ skyltarna till Norrlövsta 147.' },
  { name: 'Knivsta', slug: 'knivsta', distance: 55, driveMinutes: 45, county: 'Uppsala län', directions: 'Ta E4 norrut mot Uppsala, fortsätt förbi Uppsala och ta av mot Alunda via väg 282.' },
  { name: 'Bålsta', slug: 'balsta', distance: 80, driveMinutes: 65, county: 'Uppsala län', directions: 'Ta E18 österut och anslut till E4 norrut vid Uppsala. Ta sedan av mot Alunda/Österbybruk.' },
  { name: 'Sala', slug: 'sala', distance: 75, driveMinutes: 65, county: 'Västmanlands län', directions: 'Ta väg 72 österut mot Uppsala, anslut till E4 norrut och ta av mot Alunda via väg 282.' },
  { name: 'Östhammar', slug: 'osthammar', distance: 35, driveMinutes: 30, county: 'Uppsala län', directions: 'Ta väg 76 västerut mot Uppsala och ta av mot Alunda. Norrlövsta ligger längs väg 282.' },
  { name: 'Älvkarleby', slug: 'alvkarleby', distance: 55, driveMinutes: 45, county: 'Uppsala län', directions: 'Ta E4 söderut mot Uppsala och ta av mot Alunda/Tierp. Följ skyltarna till Norrlövsta.' },
  { name: 'Gävle', slug: 'gavle', distance: 95, driveMinutes: 80, county: 'Gävleborgs län', directions: 'Ta E4 söderut mot Uppsala, ta av mot Tierp/Alunda och följ väg 292 mot Norrlövsta.' },
  { name: 'Arlanda', slug: 'arlanda', distance: 68, driveMinutes: 55, county: 'Stockholms län', directions: 'Ta E4 norrut, passera Uppsala och ta av mot Alunda via väg 282. Perfekt för dem som flyger in.' },
  { name: 'Upplands Väsby', slug: 'upplands-vasby', distance: 78, driveMinutes: 62, county: 'Stockholms län', directions: 'Ta E4 norrut mot Uppsala, passera Uppsala och fortsätt mot Alunda via väg 282.' },
  { name: 'Täby', slug: 'taby', distance: 85, driveMinutes: 70, county: 'Stockholms län', directions: 'Ta väg 265 mot E4, sedan norrut mot Uppsala. Ta av mot Alunda/Österbybruk och följ skyltarna.' },
  { name: 'Sollentuna', slug: 'sollentuna', distance: 82, driveMinutes: 68, county: 'Stockholms län', directions: 'Ta E4 norrut mot Uppsala, fortsätt förbi Uppsala och ta av mot Alunda via väg 282.' },
  { name: 'Håbo', slug: 'habo', distance: 72, driveMinutes: 60, county: 'Uppsala län', directions: 'Ta E18 österut och anslut till E4 norrut mot Uppsala. Ta sedan av mot Alunda.' },
  { name: 'Heby', slug: 'heby', distance: 60, driveMinutes: 50, county: 'Uppsala län', directions: 'Ta väg 56 österut mot Uppsala och anslut till E4 norrut. Ta av mot Alunda/Österbybruk.' },
];

export function getCityBySlug(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}
