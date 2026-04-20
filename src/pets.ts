import { invoke } from '@tauri-apps/api/core';

interface PetInstance {
  label: string;
  session_id: string | null;
  cwd: string | null;
  style_name: string;
}

const listEl = document.getElementById('pet-list') as HTMLDivElement;
const refreshBtn = document.getElementById('btn-refresh') as HTMLButtonElement;

async function loadPets() {
  const pets = await invoke<PetInstance[]>('list_pets');
  render(pets);
}

function render(pets: PetInstance[]) {
  listEl.innerHTML = '';

  if (pets.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No pets running.';
    listEl.appendChild(empty);
    return;
  }

  for (const p of pets) {
    const row = document.createElement('div');
    row.className = 'pet-row';

    const info = document.createElement('div');
    info.className = 'pet-info';

    const styleSpan = document.createElement('span');
    styleSpan.className = 'pet-style';
    styleSpan.textContent = p.style_name;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'pet-label';
    labelSpan.textContent = p.label;

    const sessionSpan = document.createElement('span');
    sessionSpan.className = 'pet-session';
    sessionSpan.textContent = p.session_id || 'No session';

    const cwdSpan = document.createElement('span');
    cwdSpan.className = 'pet-cwd';
    cwdSpan.textContent = p.cwd || 'No directory';

    info.appendChild(styleSpan);
    info.appendChild(labelSpan);
    info.appendChild(sessionSpan);
    info.appendChild(cwdSpan);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      await invoke('destroy_pet', { label: p.label });
      await loadPets();
    });

    row.appendChild(info);
    row.appendChild(deleteBtn);
    listEl.appendChild(row);
  }
}

refreshBtn.addEventListener('click', loadPets);

// Load on open
loadPets();
