import type { StyleConfig } from './types';

export const dogStyle: StyleConfig = {
  name: 'dog',
  colors: {
    primary: '#d77757',
    work: '#d77777',
    success: '#d77757',
    fail: '#889999',
    sleep: '#d77757',
  },
  body: {
    head: { x: 9, y: 6, w: 14, h: 10 },
    ears: [
      { x: 8, y: 6 }, { x: 8, y: 7 }, { x: 8, y: 8 },
      { x: 23, y: 6 }, { x: 23, y: 7 }, { x: 23, y: 8 },
    ],
    bodyRect: { x: 10, y: 16, w: 12, h: 9 },
    tail: [
      { x: 22, y: 17 },
      { x: 23, y: 16 },
      { x: 24, y: 15 },
      { x: 25, y: 14 },
    ],
  },
  face: {
    eyeLeft: { x: 11, y: 10, w: 2, h: 1 },
    eyeRight: { x: 19, y: 10, w: 2, h: 1 },
    mouth: {
      smile: [{ x: 14, y: 13 }, { x: 15, y: 13 }, { x: 16, y: 13 }, { x: 17, y: 13 }, { x: 13, y: 12 }, { x: 18, y: 12 }],
      neutral: [{ x: 14, y: 13 }, { x: 15, y: 13 }, { x: 16, y: 13 }, { x: 17, y: 13 }],
      frown: [{ x: 14, y: 12 }, { x: 15, y: 12 }, { x: 16, y: 12 }, { x: 17, y: 12 }, { x: 13, y: 13 }, { x: 18, y: 13 }],
    },
    tongue: [{ x: 15, y: 14 }, { x: 16, y: 14 }],
  },
  legs: {
    left: [{ x: 10, y: 25 }, { x: 11, y: 25 }],
    right: [{ x: 20, y: 25 }, { x: 21, y: 25 }],
  },
};
