import type { Viewport } from 'next';
import { PORTAL_THEME_SCRIPT } from '@/lib/portalTheme';

// Mörk adminmeny – färga webbläsarens/appens titelrad likadant
export const viewport: Viewport = { themeColor: '#161618' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PORTAL_THEME_SCRIPT }} />
      {children}
    </>
  );
}
