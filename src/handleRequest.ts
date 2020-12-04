if (process.env.POPULATE_SNOWPACK_CACHE === 'true') {
  require('rimraf').sync(`${__dirname}/../snowpack-cache`);
}

export default async function handleRequest(request: any): Promise<any> {
  if (
    request.type === 'frontend-loaded' &&
    process.env.POPULATE_SNOWPACK_CACHE === 'true'
  ) {
    require('rimraf').sync(`${__dirname}/../snowpack-cache`);
    require('copy-dir').sync(
      `${__dirname}/../node_modules/.cache/snowpack/development`,
      `${__dirname}/../snowpack-cache`,
    );
    require('rimraf').sync(
      `${__dirname}/../node_modules/.cache/snowpack/development`,
    );
    process.exit(0);
  }
}
