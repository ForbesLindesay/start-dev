import React from 'react';
import {readFile} from './example.api';

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
