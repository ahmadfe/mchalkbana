import type { Viewport } from 'next';
import SchoolShell from '@/components/school/SchoolShell';

// Mörk meny som i admin – färga webbläsarens/appens titelrad likadant
export const viewport: Viewport = { themeColor: '#161618' };

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  return <SchoolShell>{children}</SchoolShell>;
}
