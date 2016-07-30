"use strict";

const electron = require('electron');
// Get app from electron
const {app} = electron;

// node modules
const
  path = require('path'),
  extend = require('deep-extend');

// Get createMainWindow and createTray
const {createMainWindow} = require('./lib/create-window.js');
const {createTray} = require('./lib/create-tray.js');
const register = require('./lib/register.js');


/*
TODO: make sure we don't npm link rk8-pki.js!!! (use a git dependency at first)
 because electron will need to rebuild the native dependencies (node-forge).
*/

process.on('uncaughtException', function (err) {
   console.error(err);
   console.error(err.stack);
   setTimeout(function(){
     process.exit(err.code || 1);
   }, 500);
});

// start up RocketAuth when the user logs in (at least by default).
app.setLoginItemSettings({openAtLogin: true});

// TODO: remember http://electron.atom.io/docs/api/app/#appdockbouncetype-macos
// when we get notifications. Also, badge numbers.

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createTray);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    //app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (Object.keys(win).length < 1) {
    createMainWindow();
  }
});

// Try to initialize the registered connections
register().connect();
