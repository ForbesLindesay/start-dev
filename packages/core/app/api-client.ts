import Client from '@start-dev/websocket-rpc/client';

async function getCsrfToken() {
  const response = await fetch('/_csrf', {method: 'POST'});
  if (!response.ok) {
    throw new Error(response.statusText + ': ' + (await response.text()));
  }
  const responseText = await response.text();
  // while(true);console.log(${JSON.stringify(CSRF_TOKEN)})
  return JSON.parse(
    responseText.substring(
      'while(true);console.log('.length,
      responseText.length - 1,
    ),
  );
}

const client = new Client(getCsrfToken, `ws://${location.host}`);
export default client;
