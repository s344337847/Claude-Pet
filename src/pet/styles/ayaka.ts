import type { StyleConfig } from './types';

export const ayakaStyle: StyleConfig = {
    name: 'ayaka',
    colors: { primary: '#d77757', work: '#d77757', success: '#d77757', fail: '#889999', sleep: '#d77757' },
    spriteSheet: {
        imageSrc: '/sprites/ayaka.png',  // 放入 public/sprites/ 目录
        frameSize: 128,                   // 每帧 128x128 像素
        states: {
            idle: { row: 0, frameCount: 1, frameRate: 6 },  // 第1行，1帧
            walk: { row: 1, frameCount: 4, frameRate: 6 },  // 第2行，4帧
            work: { row: 3, frameCount: 4 },                // 第4行，4帧（默认 frameRate: 6）
            sleep: { row: 2, frameCount: 1 },                // 第3行，1帧（默认 frameRate: 6）
            success: { row: 2, frameCount: 1 },                // 第3行，1帧（默认 frameRate: 6）
            fail: { row: 2, frameCount: 1 },                // 第4行，1帧（默认 frameRate: 6）
        },
    },
    body: {
        head: { x: 10, y: 6, w: 12, h: 10 },
        ears: [{ x: 10, y: 4 }, { x: 11, y: 4 }, { x: 20, y: 4 }, { x: 21, y: 4 }],
        bodyRect: { x: 11, y: 16, w: 10, h: 10 },
        tail: [{ x: 22, y: 18 }, { x: 23, y: 17 }],
    },
    face: {
        eyeLeft: { x: 12, y: 10, w: 2, h: 1 },
        eyeRight: { x: 18, y: 10, w: 2, h: 1 },
        mouth: {
            smile: [{ x: 14, y: 13 }, { x: 15, y: 13 }, { x: 16, y: 13 }, { x: 17, y: 13 }, { x: 13, y: 12 }, { x: 18, y: 12 }],
            neutral: [{ x: 14, y: 13 }, { x: 15, y: 13 }, { x: 16, y: 13 }, { x: 17, y: 13 }],
            frown: [{ x: 14, y: 12 }, { x: 15, y: 12 }, { x: 16, y: 12 }, { x: 17, y: 12 }, { x: 13, y: 13 }, { x: 18, y: 13 }],
        },
    },
    legs: {
        left: [{ x: 11, y: 26 }, { x: 12, y: 26 }],
        right: [{ x: 19, y: 26 }, { x: 20, y: 26 }],
    },
};