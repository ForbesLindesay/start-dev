let csrfTokenCache;

export async function getCsrfToken() {
  try {
    csrfTokenCache = csrfTokenCache || fetch('/_csrf');
    const response = await csrfTokenCache;
    if (!response.ok) {
      throw new Error(response.statusText + ': ' + (await response.text()));
    }
    const responseText = await response.text();
    return responseText.substr('while(true);'.length);
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
