import {promises} from 'fs';

export async function readFile(filename: string) {
  return promises.readFile(filename, 'utf8');
}

// TODO: add an observable API examle
