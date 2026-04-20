import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class WalkAction implements Action {
  readonly name = 'walk';

  onEnter() {}
  update(pet: Pet) {
    if (Math.random() < 0.005) {
      pet.transitionTo('idle');
    }
  }
  render(renderer: PetRenderer, pet: Pet) {
    if (renderer.renderSpriteSheet(pet.getStyle(), this.name, pet.getAnimFrameForState(this.name))) {
      return;
    }
    const frame = pet.getFrame();
    const bounce = -Math.abs(Math.sin(frame * 0.2)) * 1;
    const style = pet.getStyle();
    const color = style.colors.primary;
    renderer.drawBody(style, color, bounce);
    renderer.drawFace(style, bounce, true, 'neutral', '#111');
    renderer.drawLegs(style, color, bounce, frame);
  }
  onExit() {}
  shouldExit() { return false; }
}
