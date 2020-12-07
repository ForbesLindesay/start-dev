import React, {useState, useEffect} from 'react';
import {bw} from 'beamwind';

const savedPreference = localStorage.getItem('prefers-dark-mode');
export default function DarkModeSelector() {
  const [darkMode, setDarkMode] = useState(
    savedPreference === 'true'
      ? true
      : savedPreference === 'false'
      ? false
      : window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <button
      type="button"
      className={bw`fixed flex items-stretch top-0 right-0 z-10 m-4 border-2 border-gray-600 dark:border-gray-200 rounded-full h-6 w-10 box-content focus:outline-none`}
      onClick={() =>
        setDarkMode((v) => {
          localStorage.setItem('prefers-dark-mode', JSON.stringify(!v));
          return !v;
        })
      }
    >
      <div
        className={bw`${
          darkMode ? `opacity-100` : `opacity-0`
        } transition-opacity duration-200 bg-gray-800 absolute top-0 bottom-0 right-0 left-0 rounded-full`}
      />
      <div
        className={bw`${
          !darkMode ? `opacity-100` : `opacity-0`
        } transition-opacity duration-200 bg-blue-300 absolute top-0 bottom-0 right-0 left-0 rounded-full`}
      />
      <div className={bw`flex flex-grow items-center justify-center relative`}>
        <div
          className={bw`${
            !darkMode ? `opacity-100` : `opacity-0`
          } transition-opacity duration-200 m-1 rounded-full h-3 w-3 bg-yellow-300`}
        />
      </div>
      <div className={bw`flex flex-grow items-center justify-center relative`}>
        <div
          className={bw`${
            darkMode ? `opacity-100` : `opacity-0`
          } transition-opacity duration-200 m-1 rounded-full h-3 w-3 bg-gray-200`}
        />
        <div
          className={bw`${
            darkMode ? `opacity-100` : `opacity-0`
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
          darkMode ? 'bg-gray-600' : 'bg-gray-700'
        } transform transition-transform duration-200 ${
          darkMode ? `translate-x-0` : `translate-x-4`
        }`}
      />
    </button>
  );
}
