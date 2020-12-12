import React from 'react';
import ReactDOM from 'react-dom';
import App from '@graphical-scripts/app';
import DarkModeSelector from '@graphical-scripts/dark-mode-selector';
import {bw, setup} from 'beamwind';

setup({
  darkMode: 'class',
  hash: false,
});
ReactDOM.render(
  <div
    className={bw('h-full', 'flex', 'flex-col', 'bg-white', 'dark:bg-gray-900')}
  >
    <DarkModeSelector />
    <App />
  </div>,
  document.getElementById('root'),
);
