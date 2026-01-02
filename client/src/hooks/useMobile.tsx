import * as React from "react";

/**
 * Detects if the user is accessing from a mobile device (phone or tablet)
 * based on the User-Agent string, not screen size.
 * 
 * This ensures proper mobile UX even if the user is on desktop Chrome DevTools
 * with mobile emulation, or if a tablet user has a large screen.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    // Detect on initial render
    return detectMobileDevice();
  });

  React.useEffect(() => {
    // Re-check on mount (for SSR compatibility)
    setIsMobile(detectMobileDevice());
  }, []);

  return isMobile;
}

/**
 * Detects mobile devices by parsing the User-Agent string.
 * Returns true for phones and tablets (iOS, Android, Windows Phone, etc.)
 * Returns false for desktop computers (Windows, Mac, Linux)
 */
function detectMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false; // SSR fallback
  }

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';

  // Mobile devices patterns
  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
    /Mobile/i,
    /Tablet/i
  ];

  // Check if any mobile pattern matches
  const isMobileDevice = mobilePatterns.some(pattern => pattern.test(userAgent));

  // Additional check using modern API if available
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Combine both checks: User-Agent indicates mobile AND has touch capability
  // This prevents false positives from desktop Chrome DevTools emulation
  return isMobileDevice && hasTouchScreen;
}
