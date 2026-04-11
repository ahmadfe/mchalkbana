import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Uppsalahalkbana',
    template: '%s | Uppsalahalkbana',
  },
  description: 'Boka Risk 1 och Risk 2-utbildning för bil och motorcykel i Uppsala.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
