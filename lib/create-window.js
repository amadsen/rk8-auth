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

function createMainWindow () {
  return createWindow({ type: "main" });
}

function createWindow (opts) {
  // calculate the opts
  opts = windowConfigs.get(opts);

  // Create the browser window.
  let aWindow = win[opts.id] || new BrowserWindow(
    extend({}, opts)
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
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    if('function' != typeof opts.isSingleton || !opts.isSingleton()){
      win[opts.id] = null;
      winIdToOpts[webContentsId] = null;
    }
  });

  return aWindow;
}

ipcMain.on('auth-result', (evt, result) => {
  let
    opts = winIdToOpts[evt.sender.id],
    aWindow = win[opts.id];

    /*
     TODO: call the callback that is waiting for this auth-result
    */
});

module.exports = {
  createWindow,
  createMainWindow
};
