import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { PetState } from './types';

interface PetStateEvent {
  label: string;
  state: PetState;
}

const knownPets = new Set<string>();

async function ensurePetWindow(label: string) {
  if (knownPets.has(label)) return;
  await invoke('create_pet_window', { label });
  knownPets.add(label);
}

listen<PetStateEvent>('pet_state_change', async (event) => {
  await ensurePetWindow(event.payload.label);
});

listen<string>('destroy_pet', (event) => {
  knownPets.delete(event.payload);
});
