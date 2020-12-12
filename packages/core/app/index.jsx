import React from 'react';
import ReactDOM from 'react-dom';
import App from '@graphical-scripts/app';
import DarkModeSelector, {
  colorScheme,
  colorSchemeOverride,
  setColorSchemeOverride,
} from '@graphical-scripts/dark-mode-selector';
import {bw, setup} from 'beamwind';
import {
  colorSchemeOverrideOnServer,
  setColorSchemeOverrideOnServer,
} from './color-scheme-preference-override.api';

function setColorScheme(mode) {
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
  localStorage.setItem('color-scheme-preference', value);
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
    className={bw('h-full', 'flex', 'flex-col', 'bg-white', 'dark:bg-gray-900')}
  >
    <DarkModeSelector defaultMode="dark" />
    <App />
  </div>,
  document.getElementById('root'),
);

// useEffect(() => {
//   if (darkMode) {
//     document.documentElement.classList.add('dark');
//   } else {
//     document.documentElement.classList.remove('dark');
//   }
// }, [darkMode]);
