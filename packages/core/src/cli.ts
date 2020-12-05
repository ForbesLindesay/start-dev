#! /usr/bin/env node

import {resolve} from 'path';
import startServer from '.';

startServer(resolve(process.argv[2]), process.argv[3]).catch((ex) => {
  console.error(ex.stack);
  process.exit(1);
});
