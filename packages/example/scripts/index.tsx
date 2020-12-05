import React from 'react';
import {readFile, observable} from './example.api';

console.log('value = ', observable.getValue());
observable.subscribe((value) => {
  console.log('value = ', value);
});
export default function App() {
  const [pkg, setPkg] = React.useState(null);
  React.useEffect(() => {
    readFile('package.json').then(
      (v) => setPkg(v),
      (e) => setPkg(e.stack || e.message),
    );
  }, []);
  return (
    <pre>
      <code>{pkg}</code>
    </pre>
  );
}
