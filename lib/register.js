"use strict";

var fs = require("fs"),
    EventEmitter = require("events").EventEmitter,
    util = require("util"),
    rc = require("rc"),
    //rk8pki = require('rk8-pki'),
    uuid = require('uuid'),
    userhome = require("userhome"),
    connect = require("./connect/via-socket-io.js");

var appname = "rocketauth",
    singleton,
    connected,
    notification,
    disconnected,
    login,
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

/*
 functions for authenticating the notification connections
*/
function identify (opts, done) {
  // runs after a connection, when a notification server
  // first requests the client identity.
  var reg = registrations[this.url];
  if(reg){
    // var fn = (reg.pki)? function(cb){ cb(null, reg.pki); } : rk8pki.keypair;
    var fn = function(cb){ cb(null, reg.pki); };
    fn( function(err, keypair){
      if (err) {
        return console.error(err);
      }

      // TODO: figure out how we should securely persist the keypair
      // These are pem encoded keys...
      reg.pki = keypair;

      // make sure we have an identity string
      reg.id = reg.id || uuid.v4();

      emitRegistrationEvent('connection.'+this.url+'.updated');

      // send back the identity string
      return done({
        id: reg.id
      });
    });
  }
}

function authenticate (authenticationPublicKeyOpts, done) {
  // runs after a connection, when a notification server
  // requests that the client authenticate.
  var reg = registrations[this.url];
  if(reg){
    // Gather username and password for passing to server
    /* TODO: support gathering password hash. */
    reg.login( function(raw_credentials){

      // Encrypt credentials object using rk8pki and
      // the authenticationPublicKey
      // var credentials = rk8pki.encrypt( JSON.stringify({
      //   user: raw_credentials.user,
      //   pass: raw_credentials.pass,
      //   key: reg.pki.publicKey
      // }), authenticationPublicKeyOpts.key );
      var credentials = "";

      emitRegistrationEvent('connection.'+this.url+'.updated');

      // Send encrypted login credentials back to server
      return done(null, credentials);
    });
  }
}


function connectToRegisteredServer(regKey, done){
    var reg = Object.create(registrations[regKey]);
    reg.notification = notification.bind(reg);
    reg.connect = connected.bind(reg);
    reg.disconnect = disconnected.bind(reg);
    reg.identify = identify.bind(reg);
    reg.authenticate = authenticate.bind(reg);
    reg.login = login.bind(reg);

    done = ('function' === typeof done? done : function noop(){});
    connect.open(reg, done);
}


module.exports = function(options){
    function connectAllRegisteredServers(){
        Object.keys(registrations).forEach( function(regKey){
            return connectToRegisteredServer(regKey, function(err){
                if (err) {
                    return console.error(err);
                }
                console.log('Registered '+regKey);
            });
        });
    };

    if (singleton) {
        return singleton;
    }

    connected = function connected() {
        // runs when a registration sucessfully connects
        var reg = registrations[this.url];
        if(reg){
            reg.connectedSince = new Date();

            emitRegistrationEvent('connection.'+this.url+'.updated');
        }
    };

    disconnected = function disconnected() {
        // runs whenever a registration disconnects
        var reg = registrations[this.url];
        if(reg){
            delete reg.connectedSince;
            emitRegistrationEvent('connection.'+this.url+'.updated');
        }
    };

    notification = function notification(msg, done) {
        return options.authorize(this, msg, done);
    };

    login = function login(done) {
        return options.login(this, done);
    };

    singleton = new Registrations();
    singleton.getConfig = function(){
           return config;
    };
    singleton.saveRegistration = saveRegistration;
    singleton.removeRegistration = removeRegistration;
    singleton.connect = connectAllRegisteredServers;

    return singleton;
};
