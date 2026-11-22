/** Mörkt/ljust tema i portalerna – delas av layouterna (server) och PortalTheme (klient) */
export const PORTAL_THEME_KEY = 'uh_portal_theme';

/** Körs innan sidan ritas (inget mörkt blink när ljust är valt) */
export const PORTAL_THEME_SCRIPT = `try{if(localStorage.getItem('${PORTAL_THEME_KEY}')==='light')document.documentElement.dataset.portalTheme='light'}catch(e){}`;
