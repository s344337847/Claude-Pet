export * from './types';
export { defaultStyle } from './default';
export { dogStyle } from './dog';
export { ayakaStyle } from './ayaka';

import { defaultStyle } from './default';
import { dogStyle } from './dog';
import { ayakaStyle } from './ayaka';
import { ganyuStyle } from './ganyu';

export const STYLES = [defaultStyle, dogStyle, ayakaStyle, ganyuStyle];
