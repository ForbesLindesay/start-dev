import path from 'path';
import {Plugin} from 'rollup';

export function rollupPluginDependencyReference(
  entry: string,
  resolveDep: (name: string, entrypoint: string | null) => string,
): Plugin {
  const resolveDepInner = (identifier: string) => {
    if (identifier.startsWith('@')) {
      const [scope, name, ...entrypoint] = identifier.split('/');
      return resolveDep(`${scope}/${name}`, entrypoint.join('/') || null);
    } else {
      const [name, ...entrypoint] = identifier.split('/');
      return resolveDep(name, entrypoint.join('/') || null);
    }
  };
  return {
    name: 'dependency-referece',
    resolveId(idStr) {
      const id = (idStr.startsWith('\u0000') ? idStr.substr(1) : idStr).replace(
        /\\/g,
        '/',
      );
      if (
        id === entry ||
        id.includes(`node_modules/${entry}/`) ||
        id.endsWith(`node_modules/${entry}`)
      )
        return undefined;
      if (id.startsWith('.')) return undefined;
      if (id.includes('_commonjsHelpers')) return undefined;
      if (id.includes('node_modules')) {
        return {
          id: `http://localhost:3001${resolveDepInner(
            id.split('node_modules/').pop()!.split('?')[0],
          )}`,
          external: true,
        };
      }
      if (path.isAbsolute(idStr)) return undefined;
      return {
        id: `http://localhost:3001${resolveDepInner(id.split('?')[0])}`,
        external: true,
      };
    },
  };
}
