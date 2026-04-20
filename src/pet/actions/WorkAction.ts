import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class WorkAction implements Action {
  readonly name = 'work';

  onEnter() {}
  update() {}
  render(renderer: PetRenderer, pet: Pet) {
    if (renderer.renderSpriteSheet(pet.getStyle(), this.name, pet.getAnimFrameForState(this.name))) {
      return;
    }
    const frame = pet.getFrame();
    const typeOffset = (frame % 10) < 5 ? 0 : 1;
    const style = pet.getStyle();
    const color = style.colors.work;
    renderer.drawBody(style, color, 0);
    renderer.drawFace(style, 0, true, 'neutral', '#111');
    renderer.drawLegs(style, color, 0, 0);
    // typing hands / keyboard
    renderer.rect({ x: 8 + typeOffset, y: 22, w: 4, h: 2 }, '#334');
    renderer.rect({ x: 20 - typeOffset, y: 22, w: 4, h: 2 }, '#334');
    // thought bubble
    renderer.rect({ x: 24, y: 4, w: 6, h: 4 }, '#fff');
    renderer.pixel(25, 3, '#fff');
    renderer.pixel(26, 2, '#fff');
    // code symbol inside bubble
    renderer.rect({ x: 26, y: 5, w: 2, h: 2 }, '#0f0');
  }
  onExit() {}
  shouldExit() { return false; }
}
