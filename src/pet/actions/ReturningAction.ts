import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class ReturningAction implements Action {
  readonly name = 'returning';

  onEnter() {}
  update() {}
  render(renderer: PetRenderer, pet: Pet) {
    const frame = pet.getFrame();
    const bounce = Math.abs(Math.sin(frame * 0.2)) * 1.5;
    const style = pet.getStyle();
    const color = style.colors.success;
    renderer.drawBody(style, color, bounce);
    renderer.drawFace(style, bounce, true, 'smile', '#111');
    renderer.drawLegs(style, color, bounce, frame);
  }
  onExit() {}
  shouldExit() { return false; }
}
