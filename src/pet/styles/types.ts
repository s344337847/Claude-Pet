export interface PixelRect { x: number; y: number; w: number; h: number; }
export interface PixelPoint { x: number; y: number; }

export interface StyleColors {
  primary: string;
  work: string;
  success: string;
  fail: string;
  sleep: string;
}

export interface SpriteSheetStateConfig {
  /** 0-based row index in the sprite sheet */
  row: number;
  /** Number of frames in this state/row */
  frameCount: number;
  /** Render-frames per animation frame (default: 6, ~10 FPS at 60 FPS target) */
  frameRate?: number;
}

export interface SpriteSheetConfig {
  /** Path or URL to the sprite sheet image */
  imageSrc: string;
  /** Width and height of each frame in pixels (frames are square) */
  frameSize: number;
  /** State-to-row mapping. Keys should match PetState values */
  states: Partial<Record<string, SpriteSheetStateConfig>>;
}

export interface StyleConfig {
  name: string;
  colors: StyleColors;
  /** Optional sprite sheet for frame-based animation. When provided, sprite sheet takes precedence over procedural drawing */
  spriteSheet?: SpriteSheetConfig;
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
    tongue?: PixelPoint[];
  };
  legs: {
    left: PixelPoint[];
    right: PixelPoint[];
  };
}
