import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class EnterAction implements Action {
  readonly name = 'enter';
  private startTime = 0;
  private readonly DURATION_MS = 2000;

  onEnter(_pet: Pet) {
    this.startTime = performance.now();
  }

  update(pet: Pet) {
    if (performance.now() - this.startTime >= this.DURATION_MS) {
      pet.transitionTo('idle');
    }
  }

  render(renderer: PetRenderer, pet: Pet) {
    if (renderer.renderSpriteSheet(pet.getStyle(), this.name, pet.getAnimFrameForState(this.name))) {
      return;
    }
    const frame = pet.getFrame();
    const wave = Math.sin(frame * 0.3); // quick wave for excitement
    const offsetY = Math.sin(frame * 0.15) * 1.5 - 1; // little hop
    const style = pet.getStyle();
    const color = style.colors.primary;

    renderer.drawBody(style, color, offsetY);
    renderer.drawFace(style, offsetY, true, 'smile', '#111');

    // Waving leg: alternate left/right leg height
    const leg1 = wave > 0 ? 1 : 0;
    const leg2 = wave > 0 ? 0 : 0;
    for (const p of style.legs.left) {
      renderer.pixel(p.x, p.y + offsetY - leg1, color);
    }
    for (const p of style.legs.right) {
      renderer.pixel(p.x, p.y + offsetY - leg2, color);
    }
  }

  onExit(_pet: Pet) {}
  shouldExit(_pet: Pet) { return false; }
}
