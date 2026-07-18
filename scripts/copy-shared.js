// Copia shared/mapdata.js para public/shared/mapdata.js — mantém uma única
// fonte de verdade enquanto o frontend (Vercel) e o backend (Railway) são
// implantados como projetos separados a partir do mesmo repositório.
import { mkdir, copyFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

await mkdir(join(ROOT, 'public/shared'), { recursive: true });
for (const file of ['mapdata.js', 'nadephysics.js']) {
  await copyFile(join(ROOT, 'shared', file), join(ROOT, 'public/shared', file));
  console.log(`[build] shared/${file} copiado para public/shared/`);
}
