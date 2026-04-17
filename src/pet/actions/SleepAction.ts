import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class SleepAction implements Action {
  readonly name = 'sleep';

  onEnter() {}
  update() {}
  render(renderer: PetRenderer, pet: Pet) {
    const frame = pet.getFrame();
    const offsetY = Math.sin(frame * 0.03) * 0.5;
    const style = pet.getStyle();
    const color = style.colors.sleep;
    renderer.drawBody(style, color, offsetY);
    renderer.drawFace(style, offsetY, false, 'neutral', '#111');
    renderer.drawLegs(style, color, offsetY, 0);
    // Zzz
    const zOffset = (frame % 60) / 10;
    renderer.pixel(24, 4 - zOffset, '#fff');
    renderer.pixel(26, 2 - zOffset, '#fff');
  }
  onExit() {}
  shouldExit() { return false; }
}
