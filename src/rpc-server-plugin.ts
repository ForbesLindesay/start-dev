// import {readFileSync} from 'fs';
import {SnowpackPlugin} from 'snowpack';

const rpcProxy = `
export const y = 10;
`;
module.exports = function plugin(
  _snowpackConfig: any,
  _options: any = {},
): SnowpackPlugin {
  return {
    name: __filename,
    resolve: {
      input: [], // ['.js', '.mjs', '.jsx', '.ts', '.tsx'],
      output: ['.js'], // always export JS
    },
    async load({filePath}) {
      if (
        !['.js', '.mjs', '.jsx', '.ts', '.tsx'].some((ext) =>
          filePath.endsWith(`.api${ext}`),
        )
      ) {
        return undefined;
      }

      return {
        '.js': {
          code: rpcProxy,
        },
      };
    },
    cleanup() {
      // pool && pool.terminate();
    },
    config(this: SnowpackPlugin, config) {
      // if we set this before `config` is called, the default plugins don't get added
      this.resolve!.input = ['.js', '.mjs', '.jsx', '.ts', '.tsx'];

      // we need to be before the builtin plugins in the queue
      config.plugins.unshift(this);
    },
  };
};
