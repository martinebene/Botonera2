/**
 * Entorno Vitest que conserva las primitivas Node del monorepo y compila SFC
 * en modo cliente. El DOM pedagógico compartido se instala desde setupFiles.
 */

import { builtinEnvironments, type Environment } from 'vitest/runtime'

const entornoDomCliente: Environment = {
  ...builtinEnvironments.node,
  name: 'botonera-dom-cliente',
  viteEnvironment: 'client',
}

export default entornoDomCliente
