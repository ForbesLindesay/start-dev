import {promises} from 'fs';
import {createStateAtom} from '@start-dev/state';

export async function readFile(filename: string) {
  return promises.readFile(filename, 'utf8');
}

const [observable, setState] = createStateAtom({value: 42});
setInterval(() => setState(({value}) => ({value: value + 1})), 4_000);
export {observable};

// TODO: add an observable API examle
