"use strict";

const fs = require("fs"),
    EventEmitter = require("events").EventEmitter,
    util = require("util"),
    rc = require("rc"),
    rk8pki = require('rk8-pki'),
    uuid = require('uuid'),
    userhome = require("userhome"),
    connect = require("./connect/via-socket-io.js");

const {createWindow} = require('./create-window.js');

var appname = "rocketauth",
    singleton,
    registrations,
    savePath,
    config = rc(appname, {});

registrations = config.registrations = config.registrations || {};
savePath = config.config || userhome("."+appname+"rc");

function Registrations(){
  EventEmitter.call(this);
}
util.inherits(Registrations, EventEmitter);

function emitRegistrationEvent() {
  var args = [].slice.call(arguments);
  if(singleton && 'function' === typeof singleton.emit ){
    setImmediate(function(){
      // publish a generic event with the specific event as part of the event data
      singleton.emit.apply(singleton, [].concat('registrations.event', args) );
      singleton.emit.apply(singleton, args);
    });
  }
}

/* v-- functions to bind to registration connections */
function connected(regSocket) {
    // runs when a registration sucessfully connects
    var reg = registrations[regSocket.url];
    if(reg){
        reg.connectedSince = new Date();

        emitRegistrationEvent('connection.'+reg.url+'.updated');
    }
};

function disconnected(regSocket) {
    // runs whenever a registration disconnects
    var reg = registrations[regSocket.url];
    if(reg){
        delete reg.connectedSince;
        emitRegistrationEvent('connection.'+reg.url+'.updated');
    }
};

function notification(regSocket, msg, done) {
    // create a notification window
    // when the auth-result comes back, close it
    return createWindow({
      type: 'auth_notification',
      send: {
        'set-auth-question': msg
      },
      listen: {
        'auth-result': {
          type: 'once',
          close: true,
          fn: done
        }
      }
    });
};

function login(regSocket, done) {
    // create a login window
    // when the auth-result comes back, close it
    return createWindow({
      type: 'login',
      listen: {
        'auth-result': {
          type: 'once',
          close: true,
          fn: done
        }
      }
    });
};

/*
 functions for authenticating the notification connections
*/
function identify (regSocket, opts, done) {
  // runs after a connection, when a notification server
  // first requests the client identity.
  var reg = registrations[regSocket.url];
  if(reg){
    var fn = (reg.pki)? function(cb){ cb(null, reg.pki); } : rk8pki.keypair;

    fn( function(err, keypair){
      if (err) {
        console.error("Error getting keypair for " + reg.url);
        return console.error(err);
      }

      // TODO: figure out how we should securely persist the keypair
      // These are pem encoded keys...
      reg.pki = keypair;

      // make sure we have an identity string
      reg.id = reg.id || uuid.v4();

      emitRegistrationEvent('connection.'+reg.url+'.updated');

      // send back the identity string
      return done({
        id: reg.id
      });
    });
  }
}

function authenticate (regSocket, authenticationPublicKeyOpts, done) {
  // runs after a connection, when a notification server
  // requests that the client authenticate.
  var reg = registrations[regSocket.url];
  if(reg){
    // Gather username and password for passing to server
    /* TODO: support gathering password hash. */
    regSocket.login( function(err, raw_credentials) {

      if (err) {
        return done(err);
      }
      // Encrypt credentials object using rk8pki and
      // the authenticationPublicKey
      var credentials = rk8pki.encrypt( JSON.stringify({
        user: raw_credentials.user,
        pass: raw_credentials.pass,
        key: reg.pki.publicKey
      }), authenticationPublicKeyOpts.key );
      var credentials = "";

      emitRegistrationEvent('connection.'+reg.url+'.updated');

      // Send encrypted login credentials back to server
      return done(null, credentials);
    });
  }
}

/* ^-- end functions to bind to registration connections */

function cfgReplacer(k, v) {
    if (/^([$_]|config|connected)/.test(k)) {
        // disclude all keys that begin with $, _, config, or connected
        return undefined;
    }
    return v;
}

function writeConfig(done) {
    // serialize the whole config - extremely (overly) simplistic save here
    fs.writeFile(savePath, JSON.stringify(config, cfgReplacer, 2), done);
    emitRegistrationEvent('registrations.updated');
}

function removeRegistration(options, done){
    connect.close({
        url: options.url
    }, function (err) {
        // regardless of whether there is a connection to close, we'll
        // delete the registration and save it.
        delete registrations[options.url];

        emitRegistrationEvent('registration.removed');
        if (options.write !== false) {
            return writeConfig(done);
        }

        // throw away any error about connections not existing to delete
        done();
    });
}

function saveRegistration(reg, done){
    var existing = !!registrations[ reg.url ];
    done = ('function' === typeof done? done : function noop(){});
    if (!(reg.name && reg.url && reg.type)) {
        return done( new Error("Registration must have a name and a url!") );
    }
    reg.name = reg.name || reg.url;
    registrations[ reg.url ] = reg;

    emitRegistrationEvent('registration.saved');

    // always write the config after editing it
    return writeConfig(function(err){
        if (err) {
            return done(err);
        }

        setImmediate( function(){
            connectToRegisteredServer(reg.url);
        });

        return done();
    });
}

function connectToRegisteredServer(regKey, done){
    var regSocket = Object.create(registrations[regKey]);
    regSocket.notification = notification.bind(null, regSocket);
    regSocket.connect = connected.bind(null, regSocket);
    regSocket.disconnect = disconnected.bind(null, regSocket);
    regSocket.identify = identify.bind(null, regSocket);
    regSocket.authenticate = authenticate.bind(null, regSocket);
    regSocket.login = login.bind(null, regSocket);

    done = ('function' === typeof done? done : function noop(){});
    connect.open(regSocket, done);
}


module.exports = function(options){
    function connectAllRegisteredServers(){
        Object.keys(registrations).forEach( function(regKey){
            return connectToRegisteredServer(regKey, function(err){
                if (err) {
                  console.error("Unable to connect to ", regKey);
                  return console.error(err);
                }
                console.log('Registered '+regKey);
            });
        });
    };

    if (singleton) {
        return singleton;
    }

    singleton = new Registrations();
    singleton.getConfig = function(){
           return config;
    };
    singleton.saveRegistration = saveRegistration;
    singleton.removeRegistration = removeRegistration;
    singleton.connect = connectAllRegisteredServers;

    return singleton;
};
