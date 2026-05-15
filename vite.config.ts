import { reactRouter } from '@react-router/dev/vite'

import tailwindcss from '@tailwindcss/vite'

import { defineConfig, loadEnv } from 'vite'

import tsconfigPaths from 'vite-tsconfig-paths'



export default defineConfig(({ mode }) => {

  const env = loadEnv(mode, process.cwd(), '')

  const PORT = Number(env.SERVER_PORT) || 8080



  return {

    server: {

      host: '0.0.0.0',

      port: PORT,

      hmr: {

        clientPort: PORT,

      },

    },

    preview: {

      host: '0.0.0.0',

      port: PORT,

    },

    plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],

  }

})

