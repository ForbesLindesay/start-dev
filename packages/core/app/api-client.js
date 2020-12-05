let csrfTokenCache;

export async function getCsrfToken() {
  try {
    csrfTokenCache =
      csrfTokenCache ||
      fetch('/_csrf').then(async (response) => {
        if (!response.ok) {
          throw new Error(response.statusText + ': ' + (await response.text()));
        }
        const responseText = await response.text();
        return responseText.substr('while(true);'.length);
      });
    return await csrfTokenCache;
  } catch (ex) {
    csrfTokenCache = undefined;
    throw ex;
  }
}

export async function callmethod(request) {
  const response = await fetch('/_api', {
    method: 'post',
    headers: {
      'x-csrf-token': await getCsrfToken(),
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

export function asyncMethod(moduleID, methodName) {
  return async (...args) => {
    return await callmethod({
      type: 'method-call',
      moduleID,
      methodName,
      args,
    });
  };
}

export function observableState(
  moduleID,
  exportName,
  initialValue,
  initialEtag,
) {
  const subscribers = new Set();
  let value = initialValue;
  let etag = initialEtag;
  function poll() {
    callmethod({
      type: 'long-poll',
      moduleID,
      exportName,
      timeout: 30_000,
      etag,
    })
      .then((result) => {
        if (result.etag !== etag) {
          etag = result.etag;
          value = result.value;
          for (const fn of subscribers) {
            fn(value);
          }
        }
      })
      .then(
        () => {
          poll();
        },
        (err) => {
          console.error(err);
          console.error('Retrying in ~5 seconds');
          setTimeout(() => poll(), 4500 + Math.floor(Math.random() * 1000));
        },
      );
  }
  poll();
  return {
    getValue: () => value,
    subscribe: (fn) => {
      subscribers.add(fn);
    },
  };
}
