import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const staticCopyTargets = [
  {
    src: 'node_modules/@ricky0123/vad-web/dist/{silero_vad_legacy.onnx,silero_vad_v5.onnx,vad.worklet.bundle.min.js}',
    dest: 'vad',
    rename: { stripBase: true as const },
  },
  {
    src: 'node_modules/onnxruntime-web/dist/{ort-wasm-simd-threaded.mjs,ort-wasm-simd-threaded.wasm}',
    dest: 'ort',
    rename: { stripBase: true as const },
  },
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: staticCopyTargets,
      watch: {
        // Enable watching in dev mode
        reloadPageOnChange: false,
      },
    }),
  ],
})
