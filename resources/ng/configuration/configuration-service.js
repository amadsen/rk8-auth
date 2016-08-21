/** ng/configuration/configuration-service.js
 *  This file specifies the RocketAuth Desktop
 *      ConfigurationService
 *  service.
 *
 *  Particularly, this file is the link between the configuration 'angular app' and the
 *  rc-file based configs for the larger application
 */
var appCfg = angular.module('appConfiguration');
/*
TODO: replace communication through the register module with passing messages
through ipcRenderer!!!
*/
var electron = require('electron'),
    {ipcRenderer} = electron;

function ipcCallback(eventId, data, done) {
  var callbackEventId = [].concat(
    eventId,
    process.hrtime(),
    Math.random()
  ).join('|');
  ipcRenderer.once(callbackEventId, (event, arg) => {
    console.log('Callback Event:', callbackEventId, arguments);
    done(arg.error, arg.data);
  });
  setImmediate(()=>{
    ipcRenderer.send(eventId, {data, callbackEventId});
  });
}

appCfg.factory('ConfigurationService', ['$q', '$rootScope', function($q, $rootScope) {
    var savedConfig,
        activeConfig;

    // rebroadcast registration events on the angular $rootScope
    ipcRenderer.on('registrations.event', function(event, cfg){
      console.log('Registrations Event:', arguments);
      prepareActiveConfig(cfg);
      $rootScope.$apply();
    });


    // transform the config from the format register.js uses / saves
    // to the form we use here.
    function prepareActiveConfig(cfg) {
        savedConfig = cfg || ipcRenderer.sendSync('registrations.get-config');
        activeConfig = {};
        (Object.keys(savedConfig.registrations) || []).forEach( function (key){
            var item = savedConfig.registrations[key];

            activeConfig[item.type] = activeConfig[item.type] || {};
            activeConfig[item.type].list = activeConfig[item.type].list || [];
            activeConfig[item.type].list.push(item);
        });

        publishCfgUpdate();
    }

    function isItemConnected ( item ) {
      return (undefined !== (((savedConfig || {}).registrations || {})[ item.url ] || {}).connectedSince);
    }

    function configuration (cfgType) {
        return activeConfig[cfgType] || {};
    }

    function list (cfgType) {
        return configuration(cfgType).list || [];
    }

    function save (cfgType, originalUrl, item){

        var deferred = $q.defer(),
            aList = list(cfgType),
            i = aList.indexOf(item),
            fn = internal_save;

        function internal_save(err){
            if (err) {
                // reject promise with the error
                return deferred.reject(err);
            }

            ipcCallback('registrations.save', item, function(err){
                if (err) {
                    // reject promise with the error
                    return deferred.reject(err);
                }

                deferred.resolve(true);
            });
        }

        if (i > -1) {
            if (originalUrl !== item.url) {
                fn = function() {
                    ipcCallback('registrations.remove', {
                        write: false,
                        url: originalUrl
                    }, internal_save);
                };
            }
            fn();
        }

        return deferred.promise.then( function(){
            prepareActiveConfig();
            return list(cfgType);
        });
    }

    function remove (cfgType, item) {
        var deferred = $q.defer(),
            aList = list(cfgType),
            i = aList.indexOf(item);

        if (i > -1) {
            ipcCallback('registrations.remove', item, function(err){
                if (err) {
                    // reject promise with the error
                    return deferred.reject(err);
                }

                deferred.resolve(true);
            });
        }

        return deferred.promise.then( function(){
            prepareActiveConfig();
            return list(cfgType);
        });
    }

    function publishCfgUpdate() {
        console.log("Broadcasting ConfigurationService.Update");
        $rootScope.$broadcast('ConfigurationService.Update');
    }

    prepareActiveConfig();
    return {
        cfg: configuration,
        isItemConnected: isItemConnected,
        list: list,
        save: save,
        remove: remove
   };
 }]
);
