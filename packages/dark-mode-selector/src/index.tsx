import React from 'react';
import {bw} from 'beamwind';
import {createStateAtom} from '@start-dev/state';
import useObservableState from '@start-dev/state/useObservableState';

function getWindowColorScheme(): 'dark' | 'light' | null {
  return window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    : null;
}
const [colorScheme, setColorScheme] = createStateAtom(getWindowColorScheme());

const [colorSchemeOverride, setColorSchemeOverride] = createStateAtom<
  'dark' | 'light' | null
>(null);
colorSchemeOverride.subscribe((value) => {
  if (value === null) {
    setColorScheme(getWindowColorScheme());
  } else {
    setColorScheme(value);
  }
});

if (window.matchMedia) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', (event) => {
    if (colorSchemeOverride.getValue() === null) {
      setColorScheme(event.matches ? 'dark' : 'light');
    }
  });
}

export {colorScheme, colorSchemeOverride, setColorSchemeOverride};

export function useColorScheme(defaultMode: 'dark' | 'light') {
  return useObservableState(colorScheme) ?? defaultMode;
}

const DarkModeSelector = React.memo(function DarkModeSelector({
  defaultMode,
}: {
  defaultMode: 'dark' | 'light';
}) {
  const currentColorScheme = useColorScheme(defaultMode);

  return (
    <button
      type="button"
      className={bw`fixed flex items-stretch top-0 right-0 z-10 m-4 border-2 border-gray-600 dark:border-gray-200 rounded-full h-6 w-10 box-content focus:outline-none`}
      onClick={() => {
        const current = colorScheme.getValue() ?? defaultMode;
        setColorSchemeOverride(current === 'light' ? 'dark' : 'light');
      }}
    >
      <div
        className={bw`${
          currentColorScheme === 'dark' ? `opacity-100` : `opacity-0`
        } transition-opacity duration-200 bg-gray-800 absolute top-0 bottom-0 right-0 left-0 rounded-full`}
      />
      <div
        className={bw`${
          currentColorScheme === 'light' ? `opacity-100` : `opacity-0`
        } transition-opacity duration-200 bg-blue-300 absolute top-0 bottom-0 right-0 left-0 rounded-full`}
      />
      <div className={bw`flex flex-grow items-center justify-center relative`}>
        <div
          className={bw`${
            currentColorScheme === 'light' ? `opacity-100` : `opacity-0`
          } transition-opacity duration-200 m-1 rounded-full h-3 w-3 bg-yellow-300`}
        />
      </div>
      <div className={bw`flex flex-grow items-center justify-center relative`}>
        <div
          className={bw`${
            currentColorScheme === 'dark' ? `opacity-100` : `opacity-0`
          } transition-opacity duration-200 m-1 rounded-full h-3 w-3 bg-gray-200`}
        />
        <div
          className={bw`${
            currentColorScheme === 'dark' ? `opacity-100` : `opacity-0`
          } transition-opacity duration-200 absolute top-0 right-0 m-1 rounded-full h-2 w-2 bg-gray-800`}
          style={{
            height: '0.7rem',
            width: '0.7rem',
            marginTop: '0.3rem',
            marginRight: '0.1rem',
          }}
        />
      </div>
      <div
        className={bw`absolute left-0 top-0 w-4 h-4 m-1 rounded-full ${
          currentColorScheme === 'dark' ? 'bg-gray-600' : 'bg-gray-700'
        } transform transition-transform duration-200 ${
          currentColorScheme === 'dark' ? `translate-x-0` : `translate-x-4`
        }`}
      />
    </button>
  );
});
export default DarkModeSelector;
