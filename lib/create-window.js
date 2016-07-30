"use strict";

const electron = require('electron');
// Get BrowserWindow and ipcMain from electron
const {BrowserWindow, ipcMain} = electron;

// node path module
const
  path = require('path'),
  extend = require('deep-extend');

// Our module containing standard window configurations for our app
const windowConfigs = require('./window-configs.js');

// Keep a global object to reference active windows. We start with none.
let win = {},
    winIdToOpts = {};

// namespace window message events so they don't conflict with normal events
function makeMessageEventName (id, msgType) {
  return `{id}|message|{msgType}`;
}

function createMainWindow () {
  return createWindow({ type: "main" });
}

function createWindow (opts) {
  // calculate the opts
  opts = windowConfigs.get(opts);

  let windowOpts = extend({}, opts);
  delete windowOpts.listen;

  // Create the browser window.
  let aWindow = win[opts.id] || new BrowserWindow(
    windowOpts
  );
  let webContentsId = aWindow.webContents.id;
  winIdToOpts[webContentsId] = opts;

  // and load the url for the window.
  opts.url = path.resolve(__dirname, '..', opts.url);
  aWindow.loadURL(`file://${opts.url}`);

  // Open the DevTools.
  //aWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  aWindow.on('closed', () => {
    setImmediate(() => {
      // Dereference the window object and the window's opts.
      if('function' != typeof opts.isSingleton || !opts.isSingleton()){
        win[opts.id] = null;
        winIdToOpts[webContentsId] = null;
      }
    });
  });

  if(opts.send && 'object' === typeof opts.send) {
    Object.keys(opts.send).forEach( (msgType) => {
      aWindow.webContents.send(msgType, opts.send[msgType]);
    });
  }

  if(opts.listen && 'object' === typeof opts.listen) {
    Object.keys(opts.listen).forEach( (msgType) => {
      let listenOpts = opts.listen[msgType];

      if('function' === typeof listenOpts.fn) {
        let
          msgEvent = makeMessageEventName(aWindow.id, msgType),
          type = /(on|once)/.test(listenOpts.type)? listenOpts.type : 'once';

        aWindow[type](msgEvent, (msg) => {
          // leave room to add error information like timeouts
          listenOpts.fn(null, msg);
          
          if (listenOpts.close) {
            aWindow.close();
          }
        });
      }
    });
  }

  return aWindow;
}

ipcMain.on('message', (evt, msg) => {
  setImmediate(() => {
    let
      sourceWindow = BrowserWindow.fromWebContents(evt.sender),
      msgEvent = makeMessageEventName(sourceWindow.id, msg.type);

      /*
       Re-emit the message on the source Window with the opts.id namespaced event
       name, which will call the callback that is waiting for this message.
      */
      sourceWindow.emit(msgEvent, msg);
  });
});

module.exports = {
  createWindow,
  createMainWindow
};
