export interface PixelRect { x: number; y: number; w: number; h: number; }
export interface PixelPoint { x: number; y: number; }

export interface StyleColors {
  primary: string;
  work: string;
  success: string;
  fail: string;
  sleep: string;
}

export interface StyleConfig {
  name: string;
  colors: StyleColors;
  body: {
    head: PixelRect;
    ears: PixelPoint[];
    bodyRect: PixelRect;
    tail: PixelPoint[];
  };
  face: {
    eyeLeft: PixelRect;
    eyeRight: PixelRect;
    mouth: {
      smile: PixelPoint[];
      neutral: PixelPoint[];
      frown: PixelPoint[];
    };
  };
  legs: {
    left: PixelPoint[];
    right: PixelPoint[];
  };
}
