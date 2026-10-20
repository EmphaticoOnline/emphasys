import type { BrandStyles } from './brand/styles';
import type { EmphasysTokens } from './tokens';

declare module '@mui/material/styles' {
  interface Theme {
    emphasys: EmphasysTokens;
    /** Marca con la que se construyó el tema; se lee con `useBrand()`. */
    brand: BrandStyles;
  }
  interface ThemeOptions {
    emphasys?: EmphasysTokens;
  }
  interface TypographyVariants {
    figure: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    figure?: React.CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    figure: true;
  }
}

export {};
