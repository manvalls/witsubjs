import { hook, getEventTrigger } from 'jwit';
import { subscribe } from './subscribe';

const RETRY_TIMEOUT = 2e3;

function isTrue(attr){
  return attr != null && attr.toLowerCase() != 'false';
}

hook('wit-sub', function(node){
  let unsubscribe;
  let retryTimeout;

  const setup = () => {
    const url = node.getAttribute('action') || '/witsub';
    const withCredentials = isTrue(node.getAttribute('with-credentials'));
    const params = {};

    for (let i = 0; i < node.attributes.length; i++) {
      const attrib = node.attributes[i];
      params[attrib.name] = attrib.value;
    }

    unsubscribe = subscribe(params, { url, withCredentials }, ({ send, close, error }) => {
      error.subscribe(err => {
        getEventTrigger(node, 'WsError')([
          ev => {
            ev.error = err;
          },
        ], []);
      });

      close.subscribe(reason => {
        switch (node.getAttribute('reconnect')) {
          case 'always':
            retryTimeout = setTimeout(setup, RETRY_TIMEOUT);
            return;
          case 'never':
            return;
          default:
            if (reason == 'socket') {
              retryTimeout = setTimeout(setup, RETRY_TIMEOUT);
              return;
            }

            return;
        }
      });

      this.send = send;
    });
  }

  setup();

  this.destroy = () => {
    clearTimeout(retryTimeout);
    retryTimeout = null;

    if (!unsubscribe) {
      return;
    }

    unsubscribe();
    unsubscribe = null;
  };
});