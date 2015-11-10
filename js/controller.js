/* global moment, angular */
/* jshint unused: true */

/* FEATURE IDEAS
 * - round to nearest saturday
 */


'use strict';
var greenThumb = angular.module('gtApp', []);                                     //Angular app


/**
 * Ajaxes in the model content and makes available to angular
 */
greenThumb.factory("gtGetData", function ($http, $rootScope) {

    //Main data object
    var data = {
        produce             : window.gtProduce,
        update: function (obj) {
            //Overwrite any parameters supplied by the input object
            angular.merge(data.params, obj);
            //Now rebuild the appropriate items in the garden
            model.build(data.garden);
        }
    };

    //Application parameters
    data.params = {
        today               : moment(),                                         //Todays date
        tasksNext           : 30,                                               //Show upcoming tasks within this many days
        tasksPrev           : 30,                                               //Show upcoming tasks within this many days
        calcPlants       : true                                              //Automatically calculate how many seedlings should be planted
    };


    //Override todays date for testing
    data.params.today = moment().set({year: 2015, month: 2, date: 1, hours: 0});

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
         * This method contains the master loop
         * @param {type} obj - An object containing the garden info. Originally passed from ajax then stored in the data object
         * @returns {undefined}
         */
        build: function (obj) {
            //console.log(data.params);
            //Load the garden into into the main data object
            data.garden = obj;

            //Reset tasks, create default object to hold tasks
            data.tasks = {today: {}, prev: {}, next: {}};

            //Loop through each growing area in the model
            angular.forEach(data.garden.areas, function (value1, key1) {
                //Loop through the produce within each area
                angular.forEach(value1.produce, function (value2, key2) {

                    //Check if this item has an ID set, this ensure this only happens once per loop
                    //If not set, we need to take the ID from the model and use that to pull in all the produce data
                    if (!value2.hasOwnProperty('id')) {
                        //If this produce item has a parent, load the child properties first
                        if (data.produce[value2.slug].hasOwnProperty('parent')) {
                            value2 = angular.extend(value2, data.produce[data.produce[value2.slug].parent]);
                        }

                        //Now load the OVERRIDE properties from the main produce item, this will replace any properties from a parent produce item
                        value2 = angular.extend(value2, data.produce[value2.slug]);
                        //Add an ID for 'track by' performance issue
                        value2.id = key2;
                    }

                    //Check if the dates have already been generated, only generate on first pass
                    if (typeof value2.dates.seedlings === 'undefined') {
                        //Update the model with the seedling, harvest start and harvest complete dates
                        //Object needs to be duplicate since we are reusing data from the input object
                        model.addDates(value2);
                    }

                    //Reset seedling and plant counts
                    value2.seedlingCount = '';
                    value2.plantCount = '';
                    //Calculate the number of seedlings and plants to produce based on grow area width
                    if(data.params.calcPlants === true && value1.length){
                        var count = value1.produce.length;      //Number of types of produce in this grow bed. REQUIRES SAME SPACING
                        var length = value1.length;             //Length of grow bed
                        var spacing = value2.spacing;           //Spacing between plants
                        var rows = value2.rowsPerBed || 1;      //# of rows in this bed to plant
                        
                        //Length of bed * 12 inches / plant spacing / number of produce items sharing this grow area * number of rows for this plant
                        var numPlants =  Math.floor(length * 12 / spacing / count * rows);
                        value2.plantCount = numPlants ;
                        
                        //Calculate the number of seedlings. We need a buffer to account for germination failure or weak seedlings.
                        var seedlingCount;
                        if(numPlants === 1){
                            seedlingCount = value2.plantCount * 3;
                        } else if(numPlants >=2 && numPlants < 5){
                            seedlingCount = value2.plantCount * 2;
                        } else if(numPlants >=6 && numPlants < 10){
                            seedlingCount = value2.plantCount * 1.5;
                        } else {
                            seedlingCount = value2.plantCount + Math.floor(value2.plantCount/4);
                        }
                        value2.seedlingCount = seedlingCount + ' (' + numPlants +')';
                        
                    //Use default values if provided, if not set to blank   
                    } else {
                        value2.plantCount = value2.numPlants || '';
                        value2.seedlingCount = value2.seedlingPlants || '';
                    }
                    
                    //Loop through all the dates within each produce item
                    angular.forEach(data.garden.areas[key1].produce[key2].dates, function (value3, key3) {
                        //Add the tasks to the view
                        model.addTasks(value2, value3, key3);
                    });

                });
            });

            //Now that the task and garden list has been rebuilt, broadcast the update to the controllers so that the data is updated in the view
            $rootScope.$broadcast('dataPassed');
        }, //end model.build


        /**
         * Adds the seedling, harvest start and harvest complete dates to the object. These dates are based off the plant date.
         * @param {type} produce - A produce object
         */
        addDates: function (produce) {

            //Turn plant date into moment object
            var plant = moment().set({month: produce.dates.plant.month, date: produce.dates.plant.day});

            //Now we need to add dates for the other planting chores, IE starting seedlings etc.
            //These are all based off the plant date and pull data from produce.js
            produce.dates = {
                plant: plant,
                seedlings: plant.clone().subtract(produce.seedling, 'weeks'), //.day(6) <- round to nearest saturday
                harvest_start: plant.clone().add(produce.maturity, 'days'),
                harvest_finish: plant.clone().add((produce.harvest * 7) + produce.maturity, 'days')
            };

            //Create parameters needed by the DOM elements, mainly for positioning
            produce.dom = {
                wSeedlings: Math.round(produce.seedling * 7 * 100 / 365 * 10) / 10 + 5,
                wGrowing: Math.round(produce.maturity * 100 / 365 * 10) / 10,
                wHarvesting: Math.round(produce.harvest * 7 * 100 / 365 * 10) / 10,
                pSeedlings: Math.round((((produce.dates.seedlings.format("M") - 1) * 8.333) + ((produce.dates.seedlings.format("D") / produce.dates.seedlings.daysInMonth()) * 8.333)) * 10) / 10,
                pGrowing: Math.round((((produce.dates.plant.format("M") - 1) * 8.333) + ((produce.dates.plant.format("D") / produce.dates.plant.daysInMonth()) * 8.333)) * 10) / 10,
                pHarvesting: Math.round((((produce.dates.harvest_start.format("M") - 1) * 8.333) + ((produce.dates.harvest_start.format("D") / produce.dates.harvest_start.daysInMonth()) * 8.333)) * 10) / 10
            };
            
            produce.dom.dupeMe = produce.dom.wHarvesting + produce.dom.pHarvesting;
            
        }, //end model.addDates


        /**
         * Create the tasks list
         * @param {type} produce
         * @param {type} value3
         * @param {type} key3
         * @returns {undefined}
         */
        addTasks: function (produce, value3, key3) {
            //console.log('addTasks');
            //Now loop through all the dates within this produce item

            //If Today
            if (value3.isSame(data.params.today, 'day') === true) {
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
            } else if (value3.isBetween(data.params.today.clone().subtract(data.params.tasksPrev, 'days'), data.params.today, 'day') === true) {
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
            } else if (value3.isBetween(data.params.today, data.params.today.clone().add(data.params.tasksNext, 'days'), 'day') === true) {
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
        }, //end model.addTasks


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
                    str = 'Start ' + obj.seedlingCount + ' seedlings for ' + obj.label;
                    break;
                case 'plant':
                    str = 'Plant ' + obj.plantCount + ' ' + obj.label;
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
    };//end model.formatTasks

    return data;
});



/**
 * Controller for the task scheduler
 */
greenThumb.controller('gtSchedule', function ($scope, gtGetData) {

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
greenThumb.controller('gtCalendar', function ($scope, gtGetData) {

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
greenThumb.controller('gtDisplay', function ($scope, gtGetData) {
    //Set default state of checkbox
    $scope.numSeedlings = true;

    //When the main model is updated, add the latest date to the date picker
    $scope.$on('dataPassed', function () {
        $scope.date = gtGetData.params.today.format("MM/DD/YYYY");
    });

    //When the display date input is changed
    $scope.display = function () {
        //Update app main date
        gtGetData.update({today: moment($scope.date).add(1, 'days')});
    };

    //When the seedling calculator is turned on
    $scope.calcPlants = function () {
        //Set the seedling calculator param to true so the application will calculate the # of seedlings
        gtGetData.update({calcPlants: $scope.numSeedlings});
    };

});

/**
 * Adds the datepicker functionality. Requires jQuery :(
 */
greenThumb.directive('datepicker', function DatePicker() {
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



