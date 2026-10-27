import type { Viewport } from 'next';

// Mörk adminmeny – färga webbläsarens/appens titelrad likadant
export const viewport: Viewport = { themeColor: '#161618' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
