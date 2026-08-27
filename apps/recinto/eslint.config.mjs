import withNuxt from './.nuxt/eslint.config.mjs'

// Nuxt genera la base consciente del proyecto; configuramos la compatibilidad
// de vue/html-self-closing con el formateo de Prettier para elementos void.
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
  },
})
