import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class FailAction implements Action {
  readonly name = 'fail';

  onEnter() {}
  update() {}
  render(renderer: PetRenderer, pet: Pet) {
    if (renderer.renderSpriteSheet(pet.getStyle(), this.name, pet.getAnimFrameForState(this.name))) {
      return;
    }
    const style = pet.getStyle();
    const color = style.colors.fail;
    renderer.drawBody(style, color, 1);
    renderer.drawFace(style, 1, false, 'frown', '#111');
    renderer.drawLegs(style, color, 1, 0);
    // sweat drop
    renderer.pixel(22, 6, '#4af');
    renderer.pixel(22, 7, '#4af');
  }
  onExit() {}
  shouldExit() { return false; }
}
