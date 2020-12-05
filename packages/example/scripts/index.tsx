import {useObservableState} from '@graphical-scripts/state';
import React from 'react';
import {readFile, observable} from './example.api';

export default function App() {
  const [pkg, setPkg] = React.useState(null);
  React.useEffect(() => {
    readFile('package.json').then(
      (v) => setPkg(v),
      (e) => setPkg(e.stack || e.message),
    );
  }, []);
  const {value} = useObservableState(observable);
  return (
    <>
      <div className="flex-shrink-0 pt-10 pb-12 px-4 sm:px-6 lg:px-8 bg-gray-200 dark:bg-gray-900 sm:pb-16">
        <dl className="max-w-xs mx-auto rounded-lg bg-white dark:bg-gray-800 shadow-lg flex flex-col border border-gray-200 dark:border-gray-700 p-6 text-center">
          <dt className="order-2 mt-2 text-lg leading-6 font-medium text-gray-500 dark:text-gray-300">
            Server Count
          </dt>
          <dd className="order-1 text-5xl font-extrabold text-indigo-600 dark:text-indigo-300">
            {value}
          </dd>
        </dl>
      </div>
      <div className="flex flex-shrink-0 py-4 px-6">
        <div className="flex items-center rounded-full text-gray-800 dark:text-gray-300 bg-gray-300 dark:bg-gray-800 h-12 px-4">
          <svg
            className="animate-spin h-5 w-5 text-black dark:text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <div className="ml-3">TypeScript checks in progress</div>
        </div>
      </div>
      <pre className="flex-grow px-2 sm:px-8 pt-10 pb-16 bg-gray-100 dark:bg-gray-700 text-indigo-900 dark:text-indigo-100">
        <code>{pkg}</code>
      </pre>
    </>
  );
}
