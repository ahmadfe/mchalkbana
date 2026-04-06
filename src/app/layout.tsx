import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Uppsala Halkbana – Riskutbildning',
  description: 'Boka Risk 1 och Risk 2-utbildning för bil och motorcykel i Uppsala.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
