export type ColorScale = {
  900: string;
  800: string;
  100: string;
  50: string;
};

export type BrandDefinition = {
  id: string;
  name: string;
  primitives: {
    brand: ColorScale;
    chrome: {
      base: string;
      raised: string;
      deep: string;
    };
    neutralWarm: {
      background: string;
      foreground: string;
      border: string;
      selected: string;
    };
    neutralCool: {
      background: string;
      foreground: string;
      border: string;
      selected: string;
    };
    accent: string;
    categorical: readonly string[];
  };
  typography: {
    body: string;
    nav: string;
    figure: string;
    mono: string;
  };
  assets: {
    logoFull: string;
    logoMark: string;
    favicon: string;
  };
  meta: {
    themeColor: string;
    manifestName: string;
    shortName: string;
  };
};
