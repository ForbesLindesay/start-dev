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
      <div className="pt-10 pb-12 px-4 sm:px-6 lg:px-8 bg-gray-200 dark:bg-gray-900 sm:pb-16">
        <dl className="max-w-xs mx-auto rounded-lg bg-white dark:bg-gray-800 shadow-lg flex flex-col border border-gray-200 dark:border-gray-700 p-6 text-center">
          <dt className="order-2 mt-2 text-lg leading-6 font-medium text-gray-500 dark:text-gray-300">
            Server Count
          </dt>
          <dd className="order-1 text-5xl font-extrabold text-indigo-600 dark:text-indigo-300">
            {value}
          </dd>
        </dl>
      </div>
      <pre className="flex-grow px-2 sm:px-8 pt-10 pb-16 bg-gray-100 dark:bg-gray-700 text-indigo-900 dark:text-indigo-100">
        <code>{pkg}</code>
      </pre>
    </>
  );
}
