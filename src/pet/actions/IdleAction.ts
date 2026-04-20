import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class IdleAction implements Action {
  readonly name = 'idle';
  private idleTimer = 0;

  onEnter() {
    this.idleTimer = 0;
  }

  update(pet: Pet) {
    this.idleTimer++;
    if (this.idleTimer > 180) {
      pet.transitionTo('walk');
    }
  }

  render(renderer: PetRenderer, pet: Pet) {
    if (renderer.renderSpriteSheet(pet.getStyle(), this.name, pet.getAnimFrameForState(this.name))) {
      return;
    }
    const frame = pet.getFrame();
    const blink = Math.random() < 0.02;
    const offsetY = Math.sin(frame * 0.05) * 0.5;
    const style = pet.getStyle();
    const color = style.colors.primary;
    renderer.drawBody(style, color, offsetY);
    renderer.drawFace(style, offsetY, !blink, 'neutral', '#111');
    renderer.drawLegs(style, color, offsetY, 0);
  }

  onExit() {}
  shouldExit() { return false; }
}
