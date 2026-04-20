import { invoke } from '@tauri-apps/api/core';
import { applyI18n, t } from './i18n';

interface PetInstance {
  label: string;
  session_id: string | null;
  cwd: string | null;
  style_name: string;
}

const listEl = document.getElementById('pet-list') as HTMLDivElement;
const refreshBtn = document.getElementById('btn-refresh') as HTMLButtonElement;
const createLabelInput = document.getElementById('create-label') as HTMLInputElement;
const createStyleSelect = document.getElementById('create-style') as HTMLSelectElement;
const createBtn = document.getElementById('btn-create') as HTMLButtonElement;

async function loadPets() {
  const pets = await invoke<PetInstance[]>('list_pets');
  render(pets);
}

async function loadStyles() {
  const styles = await invoke<string[]>('list_styles');
  // 保留第一个 "随机" 选项
  while (createStyleSelect.options.length > 1) {
    createStyleSelect.remove(1);
  }
  for (const style of styles) {
    const option = document.createElement('option');
    option.value = style;
    option.textContent = t(`style-${style}`) || style;
    createStyleSelect.appendChild(option);
  }
}

function render(pets: PetInstance[]) {
  listEl.innerHTML = '';

  if (pets.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.dataset.i18n = 'no-pets';
    empty.textContent = t('no-pets');
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
    sessionSpan.textContent = p.session_id || t('no-session');

    const cwdSpan = document.createElement('span');
    cwdSpan.className = 'pet-cwd';
    cwdSpan.textContent = p.cwd || t('no-directory');

    info.appendChild(styleSpan);
    info.appendChild(labelSpan);
    info.appendChild(sessionSpan);
    info.appendChild(cwdSpan);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = t('delete');
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

createBtn.addEventListener('click', async () => {
  const label = createLabelInput.value.trim();
  if (!label) return;
  await invoke('create_pet_window', { label });
  createLabelInput.value = '';
  await loadPets();
});

// Load on open
applyI18n();
document.title = t('pet-manager-title');
loadStyles();
loadPets();
