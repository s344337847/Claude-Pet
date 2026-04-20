import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class SuccessAction implements Action {
  readonly name = 'success';

  onEnter() {}
  update() {}
  render(renderer: PetRenderer, pet: Pet) {
    if (renderer.renderSpriteSheet(pet.getStyle(), this.name, pet.getAnimFrameForState(this.name))) {
      return;
    }
    const frame = pet.getFrame();
    const jump = Math.abs(Math.sin(frame * 0.3)) * 4;
    const style = pet.getStyle();
    const color = style.colors.success;
    renderer.drawBody(style, color, -jump);
    renderer.drawFace(style, -jump, true, 'smile', '#111');
    renderer.drawLegs(style, color, -jump, 0);
    // confetti particles
    const confettiColors = ['#f44', '#4f4', '#44f', '#ff4'];
    for (let i = 0; i < 8; i++) {
      const px = (frame * 3 + i * 17) % 32;
      const py = ((frame * 2 + i * 11) % 20) + 8;
      renderer.pixel(px, py, confettiColors[i % confettiColors.length]);
    }
  }
  onExit() {}
  shouldExit() { return false; }
}
