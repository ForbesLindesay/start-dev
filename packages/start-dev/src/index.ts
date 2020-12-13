#! /usr/bin/env node

import createDevServer from '@start-dev/core';

createDevServer({
  appDirectory: process.cwd(),
  portNumber: 3001,
});
