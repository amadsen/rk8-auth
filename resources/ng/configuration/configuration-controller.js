/** ng/configuration/configuration-controller.js
 *  This file specifies the
 *      app-configuration
 *  module and
 *      configuration-controller
 *  controller. 
 */
var appCfg = angular.module('appConfiguration', []);

// We are actively attempting to keep all logic that is not exclusively view related
// outside of controllers and directive link functions - therefore this controller
// has very little need to interact with it's scope (currently).
appCfg.controller('ConfigurationController', ["$scope", function ($scope) {
    $scope.configurationTypes = [
        //{ type: "notification-service", title: "Notification Services"},
        { type: "notification-source", title: "Notification Sources"}
    ];
}]);