import type { StyleConfig } from './types';

export const defaultStyle: StyleConfig = {
  name: 'default-cat',
  initialFacing: 1,
  colors: {
    primary: '#d77757',
    work: '#d77757',
    success: '#d77757',
    fail: '#889999',
    sleep: '#d77757',
  },
  body: {
    head: { x: 10, y: 6, w: 12, h: 10 },
    ears: [{ x: 21, y: 4 }, { x: 20, y: 4 }, { x: 11, y: 4 }, { x: 10, y: 4 }],
    bodyRect: { x: 11, y: 16, w: 10, h: 10 },
    tail: [{ x: 9, y: 18 }, { x: 8, y: 17 }],
  },
  face: {
    eyeLeft: { x: 12, y: 10, w: 2, h: 1 },
    eyeRight: { x: 18, y: 10, w: 2, h: 1 },
    mouth: {
      smile: [{ x: 17, y: 13 }, { x: 16, y: 13 }, { x: 15, y: 13 }, { x: 14, y: 13 }, { x: 18, y: 12 }, { x: 13, y: 12 }],
      neutral: [{ x: 17, y: 13 }, { x: 16, y: 13 }, { x: 15, y: 13 }, { x: 14, y: 13 }],
      frown: [{ x: 17, y: 12 }, { x: 16, y: 12 }, { x: 15, y: 12 }, { x: 14, y: 12 }, { x: 18, y: 13 }, { x: 13, y: 13 }],
    },
  },
  legs: {
    left: [{ x: 11, y: 26 }, { x: 12, y: 26 }],
    right: [{ x: 19, y: 26 }, { x: 20, y: 26 }],
  },
};
