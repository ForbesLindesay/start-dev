import React from 'react';
import ReactDOM from 'react-dom';
import {callmethod} from './api-client';
import App from '@graphical-scripts/app';
import DarkModeSelector from '@graphical-scripts/dark-mode-selector';

ReactDOM.render(
  <>
    <DarkModeSelector />
    <App />
  </>,
  document.getElementById('root'),
);

callmethod({type: 'frontend-loaded'}).catch((ex) => {
  console.error(ex);
});
