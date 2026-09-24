import { defineConfig } from 'vite';

export default defineConfig({
  // Pre-bundle three and every addon together, so the dev server never serves two copies of
  // three (it happens when an addon is first imported after the server has started).
  optimizeDeps: {
    include: [
      'three',
      'three/addons/loaders/GLTFLoader.js',
      'three/addons/libs/meshopt_decoder.module.js',
      'three/addons/environments/RoomEnvironment.js',
      'three/addons/libs/stats.module.js',
    ],
  },
});
