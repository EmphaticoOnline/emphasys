import type { EmphasysTokens } from './tokens';

declare module '@mui/material/styles' {
  interface Theme {
    emphasys: EmphasysTokens;
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
