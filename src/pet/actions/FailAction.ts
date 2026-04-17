import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class FailAction implements Action {
  readonly name = 'fail';

  onEnter() {}
  update() {}
  render(renderer: PetRenderer, pet: Pet) {
    const style = pet.getStyle();
    const color = style.colors.fail;
    renderer.drawBody(style, color, 2);
    renderer.drawFace(style, 2, false, 'frown', '#111');
    renderer.drawLegs(style, color, 2, 0);
    // sweat drop
    renderer.pixel(22, 6, '#4af');
    renderer.pixel(22, 7, '#4af');
  }
  onExit() {}
  shouldExit() { return false; }
}
