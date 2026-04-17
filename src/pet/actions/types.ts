import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export interface Action {
  readonly name: string;
  onEnter(pet: Pet): void;
  update(pet: Pet): void;
  render(renderer: PetRenderer, pet: Pet): void;
  onExit(pet: Pet): void;
  shouldExit(pet: Pet): boolean;
}
