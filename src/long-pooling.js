import { logMoves, setReady, triggerError, saveRequestID, log } from './actions';

const clientId = `c${Math.round(Math.random() * 9999)}`;
const routeTo = '/moves';
let id = 0;
let requests = [];
let ready = false;

addEventListener('message', function (e) {
  const { action, payload } = e.data;
  let payload2;
  switch (action) {
    case logMoves:
    payload2 = JSON.stringify({ id: ++id, payload });
    fetch(routeTo, { method: 'POST', body: payload2 })
      .then(function () {
        postMessage({
          action: log,
          payload: `post /moves ${payload2}`
        });
      })
      .catch(handleError)
    ;
    break;
    case saveRequestID: requests.push(payload); break;
    case setReady: ready = true; break;
    case log:
    postMessage({
      action: log, payload: e.data.payload
    });
    fetch(routeTo, { method: 'POST', body: JSON.stringify(e.data.payload) + '\n' });
    break;
    default: handleError('action or payload is not valid'); break;
  }
});

addEventListener('error', (e) => {
  postMessage({ action: 'triggerError', payload: 'triggered error: ' + e.message });
});

addEventListener('close', (e) => {
  postMessage({ action: 'triggerError', payload: 'triggered error: worker closed' });
});

fetch(routeTo, { method: 'POST', body: `client ${clientId} conected\n` });

let fetchRequestID = setTimeout(callback, 2000);

function callback() {
  fetchRequestID = setTimeout(callback, 2000);
  if (ready && requests.length) {
    const body = JSON.stringify({ id: ++id, pl: requests }) + '\n';
    requests = [];
    ready = false;
    fetch(routeTo, { method: 'POST', body })
      .then(function (res) {
        if (res.status !== 200) {
          throw 'something is wrong with the request';
        }
      })
      .catch(handleErrorWithRequest.bind(this, fetchRequestID))
    ;
  }
}

function handleError(error) {
  postMessage({ action: triggerError, payload: error });
}

function handleErrorWithRequest(fetchRequestID, error) {
  clearTimeout(fetchRequestID);
  handleError.call(this, error);
}
