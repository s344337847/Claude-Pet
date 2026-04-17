import { getCurrentWindow } from '@tauri-apps/api/window';

const label = getCurrentWindow().label;

if (label === 'main') {
  import('./runtime');
} else {
  import('./pet/index');
}
