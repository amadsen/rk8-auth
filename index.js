"use strict";

const electron = require('electron');
// Get app, BrowserWindow, Menu, and Tray from electron
const {app, BrowserWindow, Menu, Tray, ipcMain} = electron;

// node path module
const
  path = require('path'),
  extend = require('deep-extend');

// Our module containing standard window configurations for our app
const windowConfigs = require('./lib/window-configs.js');

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

// Keep a global object to reference active windows. We start with none.
let win = {},
    winIdToOpts = {},
    tray = null;

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

function createMainWindow () {
  return createWindow({ type: "main" });
}

function createWindow (opts) {
  // calculate the opts
  opts = windowConfigs.get(opts);

  // Create the browser window.
  let aWindow = win[opts.id] || new BrowserWindow(
    extend({width: 320, height: 480, frame: false}, opts)
  );
  winIdToOpts[aWindow.id] = opts;

  // and load the url for the window.
  opts.url = path.resolve(__dirname, opts.url);
  aWindow.loadURL(`file://${opts.url}`);

  // Open the DevTools.
  //win.webContents.openDevTools();

  // Emitted when the window is closed.
  aWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    if('function' != typeof opts.isSingleton || !opts.isSingleton()){
      win[opts.id] = null;
      winIdToOpts[aWindow.id] = null;
    }
  });
}

function createTray(){
  tray = new Tray('icon/simple-rk8-small-template@2x.png');
  const contextMenu = Menu.buildFromTemplate([
    {
			type: 'normal',
			label: 'About',
			click: function(){
				return createWindow({type: "about"});
			}
		},
		{
			type: 'normal',
			label: 'Settings',
			click: function(){
				return createWindow({type: "settings"});
			}
	  }
  ]);
  tray.setToolTip('RocketAuth Desktop');
  tray.setContextMenu(contextMenu);
}
