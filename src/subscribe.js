import { event, apply } from 'jwit';
import getAbsoluteUrl from './getAbsoluteUrl';

const sockets = {};
const INACTIVITY_TIMEOUT = 10e3;

function toQuery(params){
  const attrs = [];

  for(let key in params) if(params.hasOwnProperty(key)) {
    const values = params[key] instanceof Array ? params[key] : [params[key]];

    for(let i = 0;i < values.length;i++) {
      const value = values[i];
      attrs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    }
  }

  return attrs.join('&');
}

function queueOrSend(socket, msg){
  if (socket.ws.readyState === 1) {
    socket.ws.send(msg);
  } else {
    socket.queue.push(msg);
  }
}

function empty(obj) {
  for(let i in obj) if(obj.hasOwnProperty(i)) {
    return false;
  }

  return true;
}

function checkSocket(socket, url){
  if (empty(socket.close)) {
    clearTimeout(socket.timeout);
    socket.timeout = setTimeout(() => {
      if (empty(socket.close)) {
        delete sockets[url];
        socket.ws.close();
      }
    }, INACTIVITY_TIMEOUT);
  }
}

export function subscribe(params, options, handler){
  if (typeof options == 'function') {
    handler = options;
    options = {};
  }

  const url = getAbsoluteUrl(options.url || '/witsub');

  if (!sockets[url]) {
    const socket = sockets[url] = {
      error: event(),
      queue: [],
      timeout: null,
      close: {},
      ws: new WebSocket(url),
      nextId: 0,
    };

    socket.ws.onmessage = e => {
      try{
        const arr = e.data.split('\n');
        const id = arr[0];

        if (!socket.close[id]) {
          return;
        }

        if (arr.length == 1) {
          const close = socket.close[id];
          delete socket.close[id];
          checkSocket(socket, url);
          close.trigger('server');
          return;
        }

        const delta = JSON.parse(arr[1]);
        apply(delta)(function(err){
          if(err){
            socket.error.trigger(err);
          }
        });
      }catch(err){
        socket.error.trigger(err);
      }
    };

    socket.ws.onerror = e => {
      socket.error.trigger(e);
    };

    socket.ws.onopen = () => {
      let msg;
      while(msg = socket.queue.shift()){
        socket.ws.send(msg);
      }
    };

    socket.ws.onclose = () => {
      clearTimeout(socket.timeout);
      delete sockets[url];
      
      for(let key in socket.close) if(socket.close.hasOwnProperty(key)) {
        const close = socket.close[key];
        delete socket.close[key];
        close.trigger('socket');
      }
    };
  }

  const socket = sockets[url];
  clearTimeout(socket.timeout);
  const id = socket.nextId.toString(36);
  socket.nextId++;

  const close = event();
  socket.close[id] = close;

  function send(msg){
    if (socket.close[id] != close) {
      return;
    }

    queueOrSend(socket, [
      id,
      toQuery(msg),
    ].join('\n'));
  }

  function unsubscribe(){
    if (socket.close[id] != close) {
      return;
    }

    delete socket.close[id];
    queueOrSend(socket, id);
    checkSocket(socket, url);
  }

  queueOrSend(socket, [
    id,
    toQuery(params),
    options.withCredentials ? document.cookie : '',
  ].join('\n'));

  if (typeof handler == 'function') {
    const error = event();

    const errUnsubscribe = socket.error.subscribe((err) => {
      error.trigger(err);
    });

    const closeUnsubscribe = close.subscribe(() => {
      errUnsubscribe();
      closeUnsubscribe();
    });

    handler({ send, unsubscribe, close, error });
  }

  return unsubscribe;
}