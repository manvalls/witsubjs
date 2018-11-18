import { hook, apply, getEventTrigger } from 'jwit';
import getAbsoluteUrl from './getAbsoluteUrl';

const sockets = {};
const INACTIVITY_TIMEOUT = 10e3;

function isTrue(attr){
  return attr != null && attr.toLowerCase() != 'false';
}

function send(socket, msg){
  if (socket.ws.readyState === 1) {
    socket.ws.send(msg);
  } else {
    socket.queue.push(msg);
  }
}

if (typeof WebSocket != 'undefined') {
  hook('wit-sub', function(node){
    const url = getAbsoluteUrl(node.getAttribute('action') || '/witsub');

    if (!sockets[url]) {
      const socket = sockets[url] = {nodes: [], queue: [], timeout: null, activeIds: {}};
      socket.ws = new WebSocket(url);
      socket.nextId = 0;

      const throwErr = err => {
        for(let i = 0;i < socket.nodes.length;i++){
          getEventTrigger(socket.nodes[i], 'Error')([
            ev => {
              ev.error = err;
            },
          ], []);
        }
      };

      socket.ws.onmessage = e => {
        try{
          const arr = e.data.split('\n');
          const id = arr[0];
          const delta = JSON.parse(arr[1]);

          if (!socket.activeIds[id]) {
            return;
          }

          apply(delta)(function(err){
            if(err){
              throwErr(err);
            }
          });
        }catch(err){
          throwErr(err);
        }
      };

      socket.ws.onerror = e => {
        throwErr(e);
      };

      socket.ws.onopen = () => {
        let msg;
        while(msg = socket.queue.shift()){
          socket.ws.send(msg);
        }
      };
    }

    const socket = sockets[url];
    socket.nodes.push(node);
    clearTimeout(socket.timeout);
    const id = socket.nextId.toString(36);
    socket.activeIds[id] = true;
    socket.nextId++;

    const attrs = [];
    for (let i = 0; i < node.attributes.length; i++) {
      const attrib = node.attributes[i];
      attrs.push(encodeURIComponent(attrib.name) + '=' + encodeURIComponent(attrib.value));
    }

    send(socket, [
      id,
      attrs.join('&'),
      isTrue(node.getAttribute('with-credentials')) ? document.cookie : '',
    ].join('\n'));

    this.destroy = function(){
      delete socket.activeIds[id];
      const i = socket.nodes.indexOf(node);
      if (i == -1) {
        return;
      }

      socket.nodes.splice(i, 1);
      send(socket, id);
      
      if (!socket.nodes.length) {
        clearTimeout(socket.timeout);
        socket.timeout = setTimeout(() => {
          if (!socket.nodes.length) {
            socket.ws.close();
            delete sockets[url];
          }
        }, INACTIVITY_TIMEOUT);
      }
    };
  });
}