/* global moment, angular */
/* jshint unused: true */

/* FEATURE IDEAS
 * - round to nearest saturday
 */

window.greenThumb = (function () {
    'use strict';

    //Master object
    var greenThumb = {
        app : angular.module('gtApp', [])                                     //Angular app
    };

    /**
     * Ajaxes in the model content and makes available to angular
     */
    greenThumb.app.factory("gtGetData", function ($http, $rootScope) {

        var params = {
            rowWidth    : 18,                                                   //The width between multiple rows
            tasksNext   : 30,                                                   //Show upcoming tasks within this many days
            tasksPrev   : 30                                                    //Show upcoming tasks within this many days
        };

        var data = {
            today       : moment(),                                             //Today's date
            garden      : {},
            tasks       : {today: {}, prev: {}, next: {}},
            produce     : window.gtProduce,
            update      : function (date) {
                            data.today = date;
                            model.build(data.garden);
                        }
        };
        
         //Override todays date for testing
        data.today = moment().set({year: 2015, month: 2, date: 1, hours: 0});
        
        //Fetch JSON object of garden to use
        $http({
            method: 'GET',
            url: 'js/model.js'
        }).then(function ($response) {
            model.build($response.data[0]);
        });
                
        var model = {
            
            /**
             * Build the data model for the schedule to pass to angular
             * @param {type} obj - An object containing the garden info
             * @returns {undefined}
             */
            build: function (obj) {
                data.garden = angular.copy(obj);

                //Reset tasks
                data.tasks = {today: {}, prev: {}, next: {}};

                //Loop through each growing area in the model
                angular.forEach(data.garden.areas, function (value1, key1) {
                    //Loop through the produce within each area
                    angular.forEach(value1.produce, function (value2, key2) {

                        //If this produce item has a parent, load the child properties first
                        if (data.produce[value2.id].hasOwnProperty('parent')) {
                            value2 = angular.extend(value2, data.produce[data.produce[value2.id].parent]);
                        }
                        
                        //Now load the rest of the properties
                        value2 = angular.extend(value2, data.produce[value2.id]);
                        //Add a slug and ID for track by 
                        value2.slug = value2.id;
                        value2.id = key2;

                        //Check if the dates have already been generated, only generate on first pass
                        if (typeof data.garden.areas[key1].produce[key2].dates.seedlings === 'undefined') {
                            //Update the model with the seedling, harvest start and harvest complete dates
                            //Object needs to be duplicate since we are reusing data from the input object
                            model.updateDates(data.garden.areas[key1].produce[key2]);
                            //data.garden.areas[key1].produce[key2] = angular.copy(model.updateDates(value2));
                        }
                        
                        //Loop through all the dates within each produce item
                        angular.forEach(data.garden.areas[key1].produce[key2].dates, function (value3, key3) {
                            //Add the tasks to the view
                            model.addTasks(value2,value3, key3);
                        });
                        
                    });
                });
                //Now that the task and garden list has been rebuilt, broadcast the update to the controllers
                $rootScope.$broadcast('dataPassed');
            }, //end greenThumb.buildSchedule

            
            /**
             * Adds the seedling, harvest start and harvest complete dates to the object. These dates are based off the plant date.
             * @param {type} obj - A produce object
             * @returns {undefined} - The same produce object with the new dates added
             */
            //updateDates: function (obj) {
            updateDates: function (produce) {

                //Turn plant date into moment object
                var plant = moment().set({month: produce.dates.plant.month, date: produce.dates.plant.day});

                //Now we need to add dates for the other planting chores, IE starting seedlings etc.
                //These are all based off the plant date and pull data from produce.js
                produce.dates = {
                    plant: plant,
                    seedlings: plant.clone().subtract(produce.seedling, 'weeks'), //.day(6)
                    harvest_start: plant.clone().add(produce.maturity, 'days'),
                    harvest_finish: plant.clone().add((produce.harvest * 7) + produce.maturity, 'days')
                };

                //Create parameters needed by the DOM elements
                produce.dom = {
                    wSeedlings: Math.round(produce.seedling * 7 * 100 / 365 * 10) / 10,
                    wGrowing: Math.round(produce.maturity * 100 / 365 * 10) / 10,
                    wHarvesting: Math.round(produce.harvest * 7 * 100 / 365 * 10) / 10,
                    position: Math.round((((produce.dates.seedlings.format("M") - 1) * 8.333) + ((produce.dates.seedlings.format("D") / produce.dates.seedlings.daysInMonth()) * 8.333)) * 10) / 10
                };

                return produce;
            }, //end addDates


            /**
             * Create the tasks list
             * @param {type} produce
             * @param {type} value3
             * @param {type} key3
             * @returns {undefined}
             */
            addTasks: function (produce, value3, key3) {
                /**/
                //Now loop through all the dates within this produce item

                //If Today
                if (value3.isSame(data.today, 'day') === true) {
                    //Check if an object has been created for this date, if not create one
                    if (!$.isPlainObject(data.tasks.today[value3.format("YYYYMMDD")])) {
                        data.tasks.today[value3.format("YYYYMMDD")] = {
                            label: value3.format("dddd, MMMM Do")
                        };
                    }
                    //Now check if the object has an array to hold the values, if not create one
                    if (!$.isArray(data.tasks.today[value3.format("YYYYMMDD")].items)) {
                        data.tasks.today[value3.format("YYYYMMDD")].items = [];
                    }
                    //Get a properly formatted task string
                    var task = model.formatTasks(key3, produce);
                    //Then send it to the previous task container object
                    data.tasks.today[value3.format("YYYYMMDD")].items.push(task);
                    //If previous    
                } else if (value3.isBetween(data.today.clone().subtract(params.tasksPrev, 'days'), data.today, 'day') === true) {
                    //Check if an object has been created for this date, if not create one
                    if (!$.isPlainObject(data.tasks.prev[value3.format("YYYYMMDD")])) {
                        data.tasks.prev[value3.format("YYYYMMDD")] = {
                            label: value3.format("dddd, MMMM Do")
                        };
                    }
                    //Now check if the object has an array to hold the values, if not create one
                    if (!$.isArray(data.tasks.prev[value3.format("YYYYMMDD")].items)) {
                        data.tasks.prev[value3.format("YYYYMMDD")].items = [];
                    }
                    //Get a properly formatted task string
                    var task = model.formatTasks(key3, produce);
                    //Then send it to the previous task container object
                    data.tasks.prev[value3.format("YYYYMMDD")].items.push(task);
                    //If upcoming  /  
                } else if (value3.isBetween(data.today, data.today.clone().add(params.tasksNext, 'days'), 'day') === true) {
                    //Check if an object has been created for this date, if not create one
                    if (!$.isPlainObject(data.tasks.next[value3.format("YYYYMMDD")])) {
                        data.tasks.next[value3.format("YYYYMMDD")] = {
                            label: value3.format("dddd, MMMM Do")
                        };
                    }
                    //Now check if the object has an array to hold the values, if not create one
                    if (!$.isArray(data.tasks.next[value3.format("YYYYMMDD")].items)) {
                        data.tasks.next[value3.format("YYYYMMDD")].items = [];
                    }
                    //Get a properly formatted task string
                    var task = model.formatTasks(key3, produce);
                    //Then send it to the previous task container object
                    data.tasks.next[value3.format("YYYYMMDD")].items.push(task);
                }
            }, //end addTasks


            /**
             * Create the string used in the task pane
             * @param {str} type - String of the task type, IE 'seedlings' or 'plant'
             * @param {obj} obj - The plant object
             * @returns {controller_L4.greenThumb.model.formatTasks.obj} - Returns the plant object with the dates added
             */
            formatTasks: function (type, obj) {

                var str;
                //Figure out which activity type this is, set appropriate string for output in task pane
                switch (type) {
                    case 'seedlings':
                        str = 'Start ' + obj.numPlants + ' Seedlings for ' + obj.label;
                        break;
                    case 'plant':
                        str = 'Plant ' + obj.numPlants + ' ' + obj.label;
                        break;
                    case 'harvest_start':
                        str = 'Start harvesting ' + obj.label;
                        break;
                    case 'harvest_finish':
                        str = 'Finish harvesting ' + obj.label;
                        break;
                }

                var obj = {
                    label: str,
                    slug: 'filter-task-' + type,
                    produce: obj
                };
                return obj;
            }
        };//end model

        return data;
    });


  
    /**
     * Controller for the task scheduler
     */
    greenThumb.app.controller('gtSchedule', function ($scope, gtGetData) {
      
        $scope.$on('dataPassed', function () {
            $scope.tasksToday = gtGetData.tasks.today;
            $scope.tasksPrev = gtGetData.tasks.prev;
            $scope.tasksNext = gtGetData.tasks.next;
       });
        
    }).directive('dateEntry', function () {
        return {
            restrict: 'E',
            scope: {
                data: '='
            },
            templateUrl: 'partials/date-entry.html'
        };
    });


    /**
     * Controller for the calender
     */
    greenThumb.app.controller('gtCalendar', function ($scope, gtGetData) {
       
        //Garden does not need to be updated everytime data is passed, only once
        $scope.$on('dataPassed', function () {
            $scope.name = gtGetData.garden.name;
            $scope.garden = gtGetData.garden.areas;
            
        });
    }).directive('areas', function () {
        return {
            restrict: 'E',
            scope: {
                data: '='
            },
            templateUrl: 'partials/calendar-row.html'
        };
    });
     
    
    /**
     * Controller for the display & interactive options
     */
    greenThumb.app.controller('gtDisplay', function ($scope, gtGetData) {

        //When the main model is updated, add the latest date to the date picker
        $scope.$on('dataPassed', function () {
            $scope.date = gtGetData.today.format("MM/DD/YYYY");
        });

        //When the display date input is changed
        $scope.display = function () {
            //Get the date from the box
            var set = moment($scope.date).add(1, 'days');
            //Update app main date
            gtGetData.update(set);
        };
    });
  
    /**
     * Adds the datepicker functionality
     */
    greenThumb.app.directive('datepicker', function DatePicker() {
        return {
            require: 'ngModel',
            restrict: 'A',
            scope: {format: "="},
            link: function (scope, element, attrs, ngModel) {
                if (typeof (scope.format) === "undefined") {
                    scope.format = "mm/dd/yyyy";
                }
                $(element).fdatepicker({format: scope.format}).on('changeDate', function (ev) {
                    scope.$apply(function () {
                        ngModel.$setViewValue(ev.date);
                    });
                });
            }
        };
    });

    //Helper Methods
    var helpers = {
        /**
         * Convert a string to a URL friendly slug
         * @param {type} str - A string
         * @returns {undefined} - URL friendly slug
         */
        makeSlug: function (str) {
            return str.toLowerCase()
                    .replace(/ /g, '-')
                    .replace(/[^\w-]+/g, '');
        }, //end makeSlug  

        /**
         * Figure out where to position the calender item in the DOM
         * @param {type} date
         * @returns {Number}
         */
        position: function (date) {

            var num = Math.floor((params.monthWidth * (date.format('M') - 1)));
            if (date.format('D') !== 1) {
                num += (date.format('D') * params.daysToPixels);
            }
            return num;
        },
        /**
         * Return the season of the supplied date
         * @param {type} date - Moment.js date object
         * @returns {String} - Returns a string CSS class with the season name
         */
        getSeason: function (date) {
            var plantMonth = date.format('M');
            var season;

            //Spring, March = May
            if (plantMonth >= 3 && plantMonth <= 5) {
                season = 'spring';
                //Summer, June - Aug
            } else if (plantMonth >= 6 && plantMonth <= 8) {
                season = 'summer';
                //Fall, Sept - Nov
            } else if (plantMonth >= 9 && plantMonth <= 11) {
                season = 'fall';
                //Winter, Dec - Feb    
            } else if (plantMonth >= 12 || plantMonth <= 2) {
                season = 'winter';
            }

            return 'filter-season-' + season;
        }//end getSeason
    };//end helpers

   


    
    

    return greenThumb;
})();



