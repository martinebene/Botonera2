import withNuxt from './.nuxt/eslint.config.mjs'

// Nuxt genera la base consciente del proyecto; configuramos la compatibilidad
// de vue/html-self-closing con el formateo de Prettier para elementos void,
// igual que en Moderación y en la Pantalla del Recinto.
export default withNuxt({
  rules: {
    'vue/html-self-closing': [
      'error',
      {
        html: {
          void: 'always',
          normal: 'always',
          component: 'always',
        },
        svg: 'always',
        math: 'always',
      },
    ],
    // La SPA técnica usa nombres de componente de una sola palabra, igual que el resto
    // de los frontends del monorepo.
    'vue/multi-word-component-names': 'off',
  },
})
