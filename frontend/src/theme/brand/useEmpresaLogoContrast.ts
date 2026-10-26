import * as React from 'react';
import { logoNeedsContrastProtection, readLogoContrastCache, writeLogoContrastCache } from './logoContrast';

export function useEmpresaLogoContrast(logo: string, sidebar: string, fallback: string): boolean {
  const [protectedLogo, setProtectedLogo] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (logo === fallback) {
      setProtectedLogo(false);
      return () => { active = false; };
    }
    const cached = readLogoContrastCache(logo, sidebar);
    if (cached !== undefined) {
      setProtectedLogo(cached);
      return () => { active = false; };
    }
    setProtectedLogo(false);
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      const value = logoNeedsContrastProtection(image, sidebar);
      writeLogoContrastCache(logo, sidebar, value);
      setProtectedLogo(value);
    };
    image.onerror = () => {
      writeLogoContrastCache(logo, sidebar, false);
      if (active) setProtectedLogo(false);
    };
    image.src = logo;
    return () => { active = false; };
  }, [fallback, logo, sidebar]);

  return protectedLogo;
}
