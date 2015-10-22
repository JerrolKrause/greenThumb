var gtApp = angular.module('gtApp', [])
.controller('gtSchedule', function($scope) {
    $scope.name = 'Moms Backyard';



})
.controller('gtCalendar', function($scope) {
    $scope.name = 'My Backyard';

})
.directive('dateEntry', function() { 
  return { 
    restrict: 'E', 
    scope: { 
      info: '=' 
    }, 
    templateUrl: 'templates/date-entry.html' 
    //template: 'This is coming from the template: {{name}}'
  }; 
})