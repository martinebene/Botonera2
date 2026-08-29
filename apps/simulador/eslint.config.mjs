import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Permite nombres de componente de una sola palabra acordes a los componentes de la SPA
    'vue/multi-word-component-names': 'off',
  },
})
