/** ng/configuration/configuration-container.js
 *  This file specifies the
 *      configuration-container
 *      configuration-item
 *  directives.
 */
var appCfg = angular.module('appConfiguration');

appCfg.directive('rk8ConfigurationContainer', function() {
    return {
        restrict: 'E',
        scope: {
            title: '@',
            type: '@'
        },
        controller: ["ConfigurationService", '$scope', function(ConfigurationService, $scope) {
            $scope.list = ConfigurationService.list($scope.type);
            $scope.add = function(){
                $scope.list.push( angular.copy({
                    type: $scope.type,
                    service: "direct"
                }));
            }
            $scope.removeItem = function(item){
                $scope.list.splice( $scope.list.indexOf(item), 1 );
            }
            // watch for broadcast events that indicate our configuration has updated
            $scope.$on('ConfigurationService.Update', function(){
                console.log('Configuration Service updated.');
                $scope.list = ConfigurationService.list($scope.type);
            });
        }],
        templateUrl: 'ng/configuration/configuration-container.ng.html'
    };
});


appCfg.directive('rk8ConfigurationItem', function() {
    return {
        restrict: 'E',
        controller: ["ConfigurationService", '$scope', function(ConfigurationService, $scope) {
            (function(item){
                // make an editable copy of the item
                $scope.item = angular.copy(item);
                $scope.isItemConnected = function(){
                    return ConfigurationService.isItemConnected($scope.item);
                }

                $scope.editing = !(item.url || item.name);
                $scope.cancel = function(){
                    if (!(item.name && item.url)) {
                        return $scope.removeItem(item);
                    }
                    $scope.editing = false;
                    $scope.item = angular.copy(item);
                };
                $scope.edit = function(){
                    $scope.editing = true;
                };
                $scope.remove = function(){
                    ConfigurationService.remove( item.type, item ).then(function(){
                        $scope.editing = false;
                    });
                    return $scope.removeItem(item);
                };
                $scope.save = function(){
                    var originalUrl = item.url;
                    item.name = $scope.item.name;
                    item.url = $scope.item.url;
                    ConfigurationService.save( item.type, originalUrl, item ).then(function(){
                        $scope.editing = false;
                    });
                };
            })($scope.cfg_item);
        }],
        templateUrl: 'ng/configuration/configuration-item.ng.html'
    };
});
