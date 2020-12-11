import {init, parse} from 'es-module-lexer';

export default async function rewriteImports(
  {name, source}: {name: string; source: string},
  resolve: (path: string) => Promise<string>,
) {
  await init;
  const [imports /* , exportNames */] = await parse(source, name);
  if (!imports.length) return source;

  // "s" is shorthand for "start"
  // "e" is shorthand for "end"
  const parts = await Promise.all(
    imports.map(
      async ({s, e}, i) =>
        `${i === 0 ? source.substring(0, s) : ''}${await resolve(
          source.substring(s, e),
        )}${
          i < imports.length - 1
            ? source.substring(e, imports[i + 1].s)
            : source.substring(e)
        }`,
    ),
  );

  return parts.join('');
}
