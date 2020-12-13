import {ObservableState} from '@start-dev/state';

export const colorSchemeOverrideOnServer: ObservableState<
  null | 'dark' | 'light'
>;

export function setColorSchemeOverrideOnServer(
  mode: null | 'dark' | 'light',
): Promise<void>;
