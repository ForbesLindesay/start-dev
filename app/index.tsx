import React from 'react';
import ReactDOM from 'react-dom';
import {readFile} from './example.api';

ReactDOM.render(<App />, document.getElementById('root'));

const CSRF_TOKEN = fetch('/_csrf')
  .then(async (r) => {
    if (!r.ok) throw new Error(r.statusText);
    return r.text();
  })
  .then((r) => r.substr('while(true);'.length));

async function callBackend(request: any): Promise<any> {
  const response = await fetch('/_api', {
    method: 'post',
    headers: {
      'x-csrf-token': await CSRF_TOKEN,
      'content-type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    if (response.headers.get('content-type') === 'application/json') {
      const err = await response.json();
      throw new Error(err.stack ? `${err.stack.join('\n')}\n\n` : err.message);
    } else {
      throw new Error(`${response.statusText}: ${await response.text()}`);
    }
  } else {
    return response.json();
  }
}

callBackend({type: 'frontend-loaded'}).catch((ex) => {
  console.error(ex);
});
function App() {
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
