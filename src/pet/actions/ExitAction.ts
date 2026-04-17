import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class ExitAction implements Action {
  readonly name = 'exit';
  private timer = 0;
  private readonly DURATION = 45;

  onEnter(pet: Pet) {
    this.timer = 0;
  }

  update(pet: Pet) {
    this.timer++;
    // No auto-transition; backend destroys window after delay
  }

  render(renderer: PetRenderer, pet: Pet) {
    const progress = Math.min(this.timer / this.DURATION, 1);
    const offsetY = progress * 3; // slowly sink down
    const blink = Math.random() < 0.03;
    const style = pet.getStyle();
    const color = style.colors.primary;

    renderer.drawBody(style, color, offsetY);
    renderer.drawFace(style, offsetY, !blink, 'neutral', '#111');
    renderer.drawLegs(style, color, offsetY, 0);
  }

  onExit(pet: Pet) {}
  shouldExit(pet: Pet) { return false; }
}
