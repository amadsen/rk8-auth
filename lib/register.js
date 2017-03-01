"use strict";

const fs = require('fs'),
    crypto = require('crypto'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    rc = require('rc'),
    rk8pki = require('rk8-pki')({
        pregenerateKeyPairs: 6
    }),
    uuid = require('uuid'),
    userhome = require('userhome'),
    connect = require('./connect/via-socket-io.js'),
    keytar = require ('keytar'),
    electron = require('electron'),
    {ipcMain} = electron;

const {createWindow, sendAllWindows} = require('./create-window.js');

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

  setImmediate(function(){
    // publish a generic event with the specific event as part of the event data
    singleton.emit.apply(singleton, [].concat('registrations.event', args) );
    sendAllWindows.apply(null, [].concat('registrations.event', args) );
    singleton.emit.apply(singleton, args);
    sendAllWindows.apply(null, args);
  });
}

ipcMain.on('registrations.get-config', (event, arg) => {
  if (arg && arg.callbackEventId) {
    return setImmediate(()=>{
      event.sender.send('ipcCallbackEvent', {
        callbackEventId: arg.callbackEventId,
        data: config
      });
    });
  }
  // synchronously return the config
  event.returnValue = config;
});

ipcMain.on('registrations.save', (event, arg) => {
  console.log('Save:', arg);
  return saveRegistration(arg.data, (error, result) => {
    console.log('Save result:', result, arg);
    if (arg.callbackEventId) {
      event.sender.send('ipcCallbackEvent', {
        callbackEventId: arg.callbackEventId,
        error: error,
        data: result
      });
    }
  });
  // synchronously return a promise?
  //event.returnValue = saving;
});

ipcMain.on('registrations.remove', (event, arg) => {
  console.log('Remove:', arg);
  return removeRegistration(arg.data, (error, result) => {
    console.log('Remove result:', result, arg);
    if (arg.callbackEventId) {
      event.sender.send('ipcCallbackEvent', {
        callbackEventId: arg.callbackEventId,
        error: error,
        data: result
      });
    }
  });

  // synchronously return a promise?
  //event.returnValue = deleting;
});

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

// TODO: fix this so it actually shows the message and works
// It really needs to be set up to do the U2F login
// U2F registration should happen during registration?
function notification(regSocket, encrypted) {
    var reg = registrations[regSocket.url],
        data;

    return rk8pki.decrypt(
      encrypted,
      reg.pki.privateKey,
      (err, result) => {
          if (err) {
              return;
          }

          try{
            data = JSON.parse(result);
            console.log('Notification Data: ', data);
            console.log('Notification Message: ', data.msg);
          } catch (e) {
            console.error('Failed to decrypt notification data', e);
            return;
          }

          if(/^http(s?):\/\//.test(data.url)){
            let notificationWindow = createWindow({
              type: 'url_notification',
              url: data.url
            });

            return notificationWindow;
          }

          if(!(data && data.id)){
            console.error('No acknowledgement id for notification');
            return;
          }

          // create a notification window
          // when the auth-result comes back, close it
          return createWindow({
            type: 'auth_notification',
            send: {
              'set-auth-question': data.msg
            },
            listen: {
              'auth-result': {
                type: 'once',
                close: true,
                fn: (err, result) => {
                    if (err) {
                        return;
                    }

                    rk8pki.encrypt(
                      ('string' === typeof result? result : JSON.stringify(result)),
                      reg.pki.authenticationPublicKey,
                      (err, encrypted) => {
                          if (err) {
                              return;
                          }

                          // The notification service will have sent an acknowledgement id,
                          // Send the result payload on the socket to that id.
                          connect.send(
                            {
                              url: regSocket.url,
                              type: data.id,
                              data: encrypted
                            },
                            () => { console.log('acknowledgement sent with id', data.id); }
                          );
                      }
                    )
                }
              }
            }
          });
      }
    );

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
    var fn = (!reg.pki)? rk8pki.keypair : function(cb){
      // reg.pki is set, but is it an object yet?
      if ('string' === typeof reg.pki) {
        try{
          reg.pki = JSON.parse(keytar.getPassword(appname, reg.pki));
        } catch(e) {
          return cb(e);
        }
      }
      if (!(reg.pki && reg.pki.publicKey && reg.pki.privateKey)) {
        return cb(new Error('Unable to read stored PKI information for '+regSocket.url));
      }
      cb(null, reg.pki);
    };

    // make sure we have an identity string
    reg.id = reg.id || uuid.v4();

    setImmediate( fn, function(err, keypair){
        if (err) {
          console.error("Error getting keypair for " + reg.url);
          return console.error(err);
        }

        // These are pem encoded keys...
        reg.pki = keypair;

        console.log(reg);

        emitRegistrationEvent('connection.'+reg.url+'.keypair');
        emitRegistrationEvent('connection.'+reg.url+'.updated');
    });
    // send back the identity string
    return done({
      id: reg.id
    });
  }
}

function keyExchange (regSocket, authenticationPublicKeyOpts, done) {
  // runs after a connection, when a notification server
  // requests that the client authenticate.
  var reg = registrations[regSocket.url];
  if(reg){
    if(!reg.pki){
      // re-run once we have the key pair
      return singleton.once('connection.'+reg.url+'.keypair', function () {
        keyExchange(regSocket, authenticationPublicKeyOpts, done);
      });
    }

    /* Generate a nonce */
    var nonce = crypto.pseudoRandomBytes(16).toString('hex');

    console.log('Registration: ', reg);
    console.log('Recieved Authentication Info: ', authenticationPublicKeyOpts);
    /*
    TODO: check to make sure the authenticationPublicKeyOpts.key is valid
    warn user of key change, etc. Also, let user remove pub key.
    */
    var authPubKey = reg.pki.authenticationPublicKey || authenticationPublicKeyOpts.key,
        key_exchange_string;

    // Encrypt credentials object using rk8pki and
    // the authenticationPublicKey
    try {
        /*
        TODO: figure out how to send a fake notification public key if this
        is a server we already know should have the correct one.
        */
        key_exchange_string = JSON.stringify({
            key: reg.pki.publicKey,
            nonce: nonce
        });
    } catch(e) {
        console.error('Error preparing key exchange response.', e);
        return;
    }

    rk8pki.encrypt( key_exchange_string, authPubKey, (err, key_exchange_response) => {
        if (err) {
            return console.error(err);
        }
        console.log(key_exchange_string);
        reg.pki.authenticationPublicKey = authPubKey;
        reg.pki.nonce = nonce;
        emitRegistrationEvent('connection.'+reg.url+'.updated');

        // Send encrypted notification key and nonce back to server.
        // Expect the server to prove it has the correct notification key
        // by sending an 'authenticate' message containing the nonce.
        // We don't send errors across right now - mostly
        // because the socket.io API doesn't account for them.
        return done(key_exchange_response);
    });
  }
}

function authenticate (regSocket, encrypted, done) {
  // runs after a connection, when a notification server
  // requests that the client authenticate.
  var reg = registrations[regSocket.url],
    data;
  if(!reg && reg.pki){
    // We MUST have the key pair by now!
    return done( new Error("Unexpected authenticate message.") );
  }

  return rk8pki.decrypt(
    encrypted,
    reg.pki.privateKey,
    (err, decrypted) => {
        if(err){
            return done(err);
        }

        try{
          data = JSON.parse(decrypted);
          console.log('Authenticate Data: ', data);
        } catch (e) {
          return done( new Error('Failed to decrypt authenticate message data') );
        }

        if (!(data.nonce && reg.pki.nonce === data.nonce)) {
          // We MUST have the key pair by now!
          return done( new Error("Invalid nonce supplied by authenticate message.") );
        }

        delete reg.pki.nonce;

        // Gather username and password for passing to server
        /* TODO: support gathering password hash. */
        regSocket.login( function(err, raw_credentials) {
            var credential_string;
            if (err) {
              return done(err);
            }

            console.log('Collected raw credentials', raw_credentials);

            if(!(raw_credentials.result && raw_credentials.result.user && raw_credentials.result.pass)) {
              return done( new Error('Authentication cancelled.') );
            }

            console.log('Registration: ', reg);

            // Encrypt credentials object using rk8pki and
            // the authenticationPublicKey
            try {
                credential_string = JSON.stringify({
                    user: raw_credentials.result.user,
                    pass: raw_credentials.result.pass
                });
            } catch(e) {
              return done( new Error('Error preparing credentials.') );
            }
            return rk8pki.encrypt(
                credential_string,
                reg.pki.authenticationPublicKey,
                (err, credentials) => {
                    console.log(credential_string);

                    emitRegistrationEvent('connection.'+reg.url+'.updated');

                    // Send encrypted login credentials back to server
                    // We don't send errors across right now - mostly
                    // because the socket.io API doesn't account for them.
                    return done(credentials);
                }
            );
        });
    }
  );

}
/*
 TODO: fix this so pending data and stuff like a nonce can never get persisted!!!
*/
function authenticated(regSocket, identity, done) {
    var reg = registrations[regSocket.url],
      data;
    if(!reg && reg.pki){
      // We MUST have the key pair by now!
      return done( new Error("Unexpected authenticated message.") );
    }

    emitRegistrationEvent('connection.'+reg.url+'.updated');
    setImmediate(function(){
      writeConfig(function (err) {
        if (err) {
          return console.error(err);
        }
        console.log('Saved pki info for ', reg.url);
      });
    });
}

/* ^-- end functions to bind to registration connections */

function cfgReplacer(k, v) {
    var parent = this;
    if (/^([$_]|config|connected)/.test(k)) {
        // disclude all keys that begin with $, _, config, or connected
        return undefined;
    }
    if ('pki' == k) {
      // save pki data in keytar if we have an authenticationPublicKey
      if (v.authenticationPublicKey && !v.nonce) {
        setImmediate(function(){
          keytar.addPassword(
            appname,
            parent.id,
            JSON.stringify(v)
          );
        });
        return parent.id;
      }
      return undefined;
    }
    return v;
}

function writeConfig(done) {
    // serialize the whole config - extremely (overly) simplistic save here
    fs.writeFile(savePath, JSON.stringify(config, cfgReplacer, 2), done);
    emitRegistrationEvent('registrations.updated');
}

function getConfig () {
  return config;
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
        done(null, true);
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

        return done(null, true);
    });
}

function connectToRegisteredServer(regKey, done){
    var regSocket = Object.create(registrations[regKey]);
    regSocket.notification = notification.bind(null, regSocket);
    regSocket.connect = connected.bind(null, regSocket);
    regSocket.disconnect = disconnected.bind(null, regSocket);
    regSocket.identify = identify.bind(null, regSocket);
    regSocket['key-exchange'] = keyExchange.bind(null, regSocket);
    regSocket.authenticate = authenticate.bind(null, regSocket);
    regSocket.authenticated = authenticated.bind(null, regSocket);
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
    singleton.getConfig = getConfig;
    singleton.saveRegistration = saveRegistration;
    singleton.removeRegistration = removeRegistration;
    singleton.connect = connectAllRegisteredServers;

    return singleton;
};
