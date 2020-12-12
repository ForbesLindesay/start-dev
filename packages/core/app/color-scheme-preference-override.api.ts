import {createStateAtom} from '@graphical-scripts/state';

const [colorSchemeOverrideOnServer, setPreferenceOverride] = createStateAtom<
  null | 'dark' | 'light'
>(null);

export {colorSchemeOverrideOnServer};
export async function setColorSchemeOverrideOnServer(
  mode: null | 'dark' | 'light',
) {
  if (mode === colorSchemeOverrideOnServer.getValue()) {
    return;
  }
  setPreferenceOverride(mode);
}
