"use strict";

const electron = require('electron');
// Get Menu and Tray from electron
const {Menu, Tray} = electron;

// Get createWindow and createMainWindow
const {createWindow} = require('./create-window.js');

// Keep a global object to reference tray menu.
let tray = null;

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
	  },
    {
      type: 'separator'
    },
    {
      role: 'quit'
    }
  ]);
  tray.setToolTip('RocketAuth Desktop');
  tray.setContextMenu(contextMenu);
}

module.exports = {
  createTray
};
