"use strict";

var io = require("socket.io-client"),
    startsWithConnect = /^connect/,
    sockets = {};

module.exports = {
    open: function connect(opts, done){
        var socket,
            socketOpts = {
                multiplex: false
            },
            timeout,
            firstConnect = function(err){
                firstConnect = null;
                if (err) {
                    socket = null;
                    return done(err);
                }
                return done();
            };

        if (opts.timeout > 0) {
            socketOpts.timeout = (opts.timeout > 750? opts.timeout : 750);
        }

        socket = io(opts.url, socketOpts);
        sockets[ opts.url ] = socket;

        Object.keys(opts).forEach(function(key){
            if (!startsWithConnect.test( key ) && 'function' === typeof opts[key]) {
                socket.on(key, opts[key]);
            }
        });

        socket.on('connect_error', function(err){
            if ('function' === typeof firstConnect) {
                firstConnect(err);
            }
        });

        socket.on('connect_timeout', function(){
            if ('function' === typeof firstConnect) {
                firstConnect( new Error("Failed to connect to " + opts.url + " in " + opts.timeout +"ms") );
            }
        });

        socket.on('connect', function(){
            if ('function' === typeof firstConnect) {
                firstConnect();
            }
            opts.connect.apply([].slice.call(arguments));
        });
        //socket.on('notification', opts.notification);
        //socket.on('disconnect', opts.disconnect);
    },
    close: function close (opts, done) {
        setImmediate( function () {
            var socket = sockets[ opts.url ];
            if (!socket) {
                return done( new Error("Connection not found for " + opts.url) );
            }

            socket.close();
            socket = null;
            delete sockets[ opts.url ];

            return done();
        });

    },
    send: function send (opts, done) {
      setImmediate( function () {
          var socket = sockets[ opts.url ];
          if (!socket) {
              return done( new Error("Connection not found for " + opts.url) );
          }
          socket.emit(opts.type, opts.data, opts.ack);
          return done();
      });
    }
};
