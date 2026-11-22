import type { Viewport } from 'next';
import SchoolShell from '@/components/school/SchoolShell';
import { PORTAL_THEME_SCRIPT } from '@/lib/portalTheme';

// Mörk meny som i admin – färga webbläsarens/appens titelrad likadant
export const viewport: Viewport = { themeColor: '#161618' };

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PORTAL_THEME_SCRIPT }} />
      <SchoolShell>{children}</SchoolShell>
    </>
  );
}
