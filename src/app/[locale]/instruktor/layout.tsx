import { PORTAL_THEME_SCRIPT } from '@/lib/portalTheme';

// Ljust/mörkt tema sätts innan sidan ritas (se PortalTheme)
export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PORTAL_THEME_SCRIPT }} />
      {children}
    </>
  );
}
