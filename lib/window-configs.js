"use strict";

// load node modules we want to use
const
  extend = require('deep-extend'),
  uuid = require('uuid');

const windowConfigs = {};

windowConfigs.common = {
  id: function () {
    return (this.type || "") + uuid.v4();
  },
  width: 320,
	height: 160,
  acceptFirstMouse: true
};

windowConfigs.login = Object.assign({}, windowConfigs.common, {
  type: "login",
  url: "resources/login.html"
});

windowConfigs.settings = Object.assign({}, windowConfigs.common, {
  id: "settings",
  type: "settings",
  // TODO: copy and rename app_ui.html
  url: "resources/settings.html",
  height: 480
});

windowConfigs.about = Object.assign({}, windowConfigs.common, {
  type: "about",
  url: "resources/about.html"
});

windowConfigs.auth_notification = Object.assign({}, windowConfigs.common, {
  type: "auth_notification",
  /* TODO: rename local.html to auth_notification.html */
  url: "resources/local.html"
});

windowConfigs.url_notification = Object.assign({}, windowConfigs.common, {
  type: "url_notification",
  url: ""
});

windowConfigs.main = Object.assign({}, windowConfigs.settings, {
  // Not yet implemented. Application is using settings for now.
});

module.exports = {
  get: function(opts) {
    opts = extend({}, windowConfigs[opts.type] || {}, opts);
    if ('function' === typeof opts.id) {
      opts.id = opts.id(opts);
      opts.isSingleton = () => {
        return false;
      };
    } else {
      opts.isSingleton = () => {
        return true;
      };
    }
    return opts;
  }
};
