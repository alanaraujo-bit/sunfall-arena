// Copia shared/ para public/shared/ — mantém uma única fonte de verdade
// enquanto o frontend (Vercel) e o backend (Fly) são implantados como
// projetos separados a partir do mesmo repositório.
import { mkdir, copyFile, readdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join } from 'path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

await mkdir(join(ROOT, 'public/shared/maps'), { recursive: true });
for (const file of ['mapdata.js', 'nadephysics.js', 'loadout.js']) {
  await copyFile(join(ROOT, 'shared', file), join(ROOT, 'public/shared', file));
  console.log(`[build] shared/${file} copiado para public/shared/`);
}
for (const file of await readdir(join(ROOT, 'shared/maps'))) {
  if (!file.endsWith('.js')) continue;
  await copyFile(join(ROOT, 'shared/maps', file), join(ROOT, 'public/shared/maps', file));
  console.log(`[build] shared/maps/${file} copiado para public/shared/maps/`);
}
