import React from 'react';
import ReactDOM from 'react-dom';
import DarkModeSelector, {
  colorScheme,
  colorSchemeOverride,
  setColorSchemeOverride,
} from '@start-dev/dark-mode-selector';
import {bw, setup} from 'beamwind';
import {
  colorSchemeOverrideOnServer,
  setColorSchemeOverrideOnServer,
} from './color-scheme-preference-override.api';

export default function main(App: React.ExoticComponent<{}>) {
  function setColorScheme(mode: 'dark' | 'light' | null) {
    if (mode === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }
  setColorScheme(colorScheme.getValue());
  colorScheme.subscribe(setColorScheme);

  colorSchemeOverride.subscribe((value) => {
    if (value === null) {
      localStorage.removeItem('color-scheme-preference');
    } else {
      localStorage.setItem('color-scheme-preference', value);
    }
    setColorSchemeOverrideOnServer(value);
  });
  colorSchemeOverrideOnServer.subscribe((value) => {
    setColorSchemeOverride(value);
  });

  const colorSchemePrefrence = localStorage.getItem('color-scheme-preference');
  if (colorSchemePrefrence === 'dark' || colorSchemePrefrence === 'light') {
    setColorSchemeOverride(colorSchemePrefrence);
  }

  setup({
    darkMode: 'class',
    hash: false,
  });
  ReactDOM.render(
    <div
      className={bw(
        'h-full',
        'flex',
        'flex-col',
        'bg-white',
        'dark:bg-gray-900',
      )}
    >
      <DarkModeSelector defaultMode="dark" />
      <App />
    </div>,
    document.getElementById('root'),
  );
}

// useEffect(() => {
//   if (darkMode) {
//     document.documentElement.classList.add('dark');
//   } else {
//     document.documentElement.classList.remove('dark');
//   }
// }, [darkMode]);
