/* global moment, angular */
/* jshint unused: true */

/* FEATURE IDEAS
 * - round to nearest saturday
 */


'use strict';
var greenThumb = angular.module('gtApp', []);                                   //Angular app


/**
 * Ajaxes in the model content and makes available to angular
 * @param {type} $http 
 * @param {type} $rootScope
 */
greenThumb.factory("gtGetData", function ($http, $rootScope) {

    //Main data object
    var data = {
        produce             : window.gtProduce,
        dates               : {},
        update: function (obj) {
            //Overwrite any parameters supplied by the input object
            angular.merge(data.params, obj);
            //Now rebuild the appropriate items in the garden
            model.initialize(data.garden);
        }
    };

    //Application parameters
    data.params = {
        today               : moment(),                                         //Todays date
        tasksNext           : 30,                                               //Show upcoming tasks within this many days
        tasksPrev           : 30,                                               //Show upcoming tasks within this many days
        calcPlants          : true,                                             //Automatically calculate how many seedlings should be planted
        initLoad            : false,                                            //Flag to ensure certain only items fire on first load
        filters             : false                                             //Holds filtering options
    };

    //Override todays date for testing
    data.params.today = moment().set({year: 2015, month: 2, date: 1, hours: 0});

    //Fetch JSON object of garden to use
    $http({
        method: 'GET',
        url: 'js/model.js'
    }).then(function ($response) {
        model.initialize($response.data[0]);
    });
    
    
    
    //Main model class
    var model = {
        
        /**
         * Build the data model for the schedule to pass to angular
         * This method contains the master loop
         * @param {type} obj - An object containing the garden info. Originally passed from ajax then stored in the data object
         * @returns {undefined}
         */
        initialize: function (obj) {
            //Load the garden into into the main data object
            data.garden = obj;
            
            //Loop through each growing area in the model
            angular.forEach(data.garden.areas, function (value1, key1) {
                //Loop through the produce within each area
                angular.forEach(value1.produce, function (value2, key2) {

                    if(data.params.initLoad === false){
                        model.build(value1, key1,value2, key2);
                    }
                    
                    //If the option to calculate plants is set
                    if(data.params.calcPlants === true && value1.length){
                       //Calculate tbe number of plants/seedlings needed by this grow bed
                       model.addPlantCount(value1, value2);
                    //Use set values if provided, if not set to blank   
                    } else {
                        value2.plantCount = value2.numPlants || '';
                        value2.seedlingCount = value2.seedlingPlants || '';
                    }
                    
                });//end produce loop
            });//end grow area loop
            
            
            model.refresh();
            
            data.params.initLoad = true;
            
            console.log(data);
            
            //Now that the task and garden list has been rebuilt, broadcast the update to the controllers so that the data is updated in the view
            $rootScope.$broadcast('dataPassed');
        }, //end model.build


        /**
         * 
         * @param {type} value1
         * @param {type} key1
         * @param {type} value2
         * @param {type} key2
         * @returns {undefined}
         */
        build: function (value1, key1,value2, key2) {
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
                value2.parent = value1.label;
            }

            //Check if the dates have already been generated, only generate on first pass
            if (typeof value2.dates.seedlings === 'undefined') {
                //Update the model with the seedling, harvest start and harvest complete dates
                //Object needs to be duplicate since we are reusing data from the input object
                model.addDates(value2);
            }

            //Loop through all the dates within each produce item
            angular.forEach(data.garden.areas[key1].produce[key2].dates, function (value3, key3) {

                //Check if the an object exists to hold the date and date object, if not create it
                if (!angular.isObject(data.dates[value3.format("YYYYMMDD")])) {
                    data.dates[value3.format("YYYYMMDD")] = {date: value3};
                }

                //Check if an array exists to hold the dates, if not create it
                if (!angular.isObject(data.dates[value3.format("YYYYMMDD")].items)) {
                    data.dates[value3.format("YYYYMMDD")].items = {};
                }
                
                //Check if an array exists to hold the dates, if not create it
                if (!angular.isArray(data.dates[value3.format("YYYYMMDD")].items[key3])) {
                    data.dates[value3.format("YYYYMMDD")].items[key3] = [];
                }

                //Add the current produce item to the date array
                data.dates[value3.format("YYYYMMDD")].items[key3].push(value2);
            });//end dates loop
        },


        /**
         * Create the tasks list
         * @returns {undefined}
         */
        refresh: function () {
           //console.log(data.dates);
            //Reset tasks/create default object to hold tasks
            data.tasks = {today: {}, prev: {}, next: {}};

            //Loop through the dates in the date object
            angular.forEach(data.dates, function (value, key) {
                //console.log(value);
                //If task occurs today
                if (value.date.isSame(data.params.today, 'day') === true) {
                    model.addTasks(value, data.tasks.today);
                //If task is previous    
                } else if (value.date.isBetween(data.params.today.clone().subtract(data.params.tasksPrev, 'days'), data.params.today, 'day') === true) {
                    model.addTasks(value, data.tasks.prev);
                //If task is upcoming/next     
                } else if (value.date.isBetween(data.params.today, data.params.today.clone().add(data.params.tasksNext, 'days'), 'day') === true) {
                    model.addTasks(value, data.tasks.next);
                }
            });
         
            //Check if each task item is empty, if so set default text
            angular.forEach(data.tasks, function (value, key) {
                if (Object.keys(value).length === 0) {
                    data.tasks[key] = 'Nothing';
                }
            });
        }, //end model.refresh

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
                plant           : plant,
                seedlings       : plant.clone().subtract(produce.seedling, 'weeks'), //.day(6) <- round to nearest saturday
                harvest_start   : plant.clone().add(produce.maturity, 'days'),
                harvest_finish  : plant.clone().add((produce.harvest * 7) + produce.maturity, 'days')
            };

            //Create parameters needed by the DOM elements, used for width and positioning of calendar items
            produce.dom = {
                wSeedlings      : Math.round(produce.seedling * 7 * 100 / 365 * 10) / 10 + 5,
                wGrowing        : Math.round(produce.maturity * 100 / 365 * 10) / 10 + 5,
                wHarvesting     : Math.round(produce.harvest * 7 * 100 / 365 * 10) / 10,
                pSeedlings      : Math.round((((produce.dates.seedlings.format("M") - 1) * 8.333) + ((produce.dates.seedlings.format("D") / produce.dates.seedlings.daysInMonth()) * 8.333)) * 10) / 10,
                pGrowing        : Math.round((((produce.dates.plant.format("M") - 1) * 8.333) + ((produce.dates.plant.format("D") / produce.dates.plant.daysInMonth()) * 8.333)) * 10) / 10,
                pHarvesting     : Math.round((((produce.dates.harvest_start.format("M") - 1) * 8.333) + ((produce.dates.harvest_start.format("D") / produce.dates.harvest_start.daysInMonth()) * 8.333)) * 10) / 10
            };
            
            
            //Spring Planting
            if (plant.isBetween(moment().month('March').subtract(1, 'month'),moment().month('June').add(1, 'month'), 'month')) {
                //console.log('Spring Planting: ('+ plant.format("MMMM") +') ' + produce.label);
                produce.dom.season = 'spring';
            //Summer Planting    
            } else if (plant.isBetween(moment().month('July').subtract(1, 'month'),moment().month('October').add(1, 'month'), 'month')) {
                //console.log('Summer Planting: ('+ plant.format("MMMM") +') ' + produce.label);
                produce.dom.season = 'summer';
            //Fall Planting    
            } else if (plant.isBetween(moment().month('November').subtract(1, 'month'),moment().month('February').add(1, 'month').add(1, 'year'), 'month') || plant.isBetween(moment().month('January').subtract(1, 'month'),moment().month('Feb').add(1, 'month'), 'month')) {
                //console.log('Fall/Winter Planting: ('+ plant.format("MMMM") +') ' + produce.label);
                produce.dom.season = 'fall';
            }
            
           
            
            
        }, //end model.addDates


        /**
         * Calculates the numer of plants and seedlings needed, determined by the growing area size
         * @param {type} value1
         * @param {type} value2
         * @returns {undefined}
         */
        addPlantCount: function (value1, value2) {
            //console.log(value2);
            //Reset seedling and plant counts
            value2.seedlingCount = value2.plantCount = '';

            var count           = value1.produce.length;       //Number of types of produce in this grow bed. REQUIRES SAME SPACING
            var length          = value1.length;               //Length of grow bed
            var spacing         = value2.spacing;              //Spacing between plants
            var rows            = value2.rowsPerBed || 1;      //# of rows in this bed to plant

            //Length of bed * 12 inches / plant spacing / number of produce items sharing this grow area * number of rows for this plant
            value2.plantCount   = Math.floor(length * 12 / spacing  * rows);

            //Calculate the number of seedlings. We need a buffer to account for germination failure or weak seedlings.
            var seedlingCount;
            if (value2.plantCount === 1) {
                seedlingCount = value2.plantCount * 3;
            } else if (value2.plantCount >= 2 && value2.plantCount < 5) {
                seedlingCount = value2.plantCount * 2;
            } else if (value2.plantCount >= 6 && value2.plantCount < 10) {
                seedlingCount = value2.plantCount * 1.5;
            } else {
                seedlingCount = value2.plantCount + Math.floor(value2.plantCount / 4);
            }
            value2.seedlingCount = seedlingCount + ' (' + value2.plantCount + ')';
        }, //end model.addPlantCount


        /**
         * Create the string used in the task pane
         * @param {str} type - String of the task type, IE 'seedlings' or 'plant'
         * @param {obj} obj - The plant object
         * @returns {controller_L4.greenThumb.model.formatTasks.obj} - Returns the plant object with the dates added
         */
        addTasks: function (dateItems, taskObj) {
            
            //Loop through each of the task types in the dateItems obj, IE seedlings, plant, harvest
            //This implementation can accomodate multiple tasks type occuring on the same day (IE start seedlings and plant something)
            angular.forEach(dateItems.items, function (value, key) {
                //Now loop through each individual task item within the group
                angular.forEach(value, function (value2, key2) {
                    //console.log(value2)
                    var str;
                    
                    //Figure out which activity type this is, set appropriate string for output in task pane
                    switch (key) {
                        case 'seedlings':
                            str = 'Start ' + value2.seedlingCount + ' seedlings for ' + value2.label;
                            break;
                        case 'plant':
                            str = 'Plant ' + value2.plantCount + ' ' + value2.label;
                            break;
                        case 'harvest_start':
                            str = 'Start harvesting ' + value2.label;
                            break;
                        case 'harvest_finish':
                            str = 'Finish harvesting ' + value2.label;
                            break;
                    }
                    
                    var obj = {
                        label: str,
                        slug: 'filter-task-' + key
                    };
                    
                    //Make sure the date object exists, if not create it
                    if (!angular.isObject(taskObj[dateItems.date.format("YYYYMMDD")])) {
                        taskObj[dateItems.date.format("YYYYMMDD")] = {
                            label: dateItems.date.format("dddd, MMMM Do"),
                            items : []
                        };
                    }
                    
                    //Load the task into the task object
                    taskObj[dateItems.date.format("YYYYMMDD")].items.push(obj); 
                });
            });
        }
    };//end model.formatTasks

    return data;
});



/**
 * Controller for the task scheduler
 */
greenThumb.controller('gtSchedule', function ($scope, gtGetData) {
    
    $scope.$on('dataPassed', function () {
        $scope.tasksToday   = gtGetData.tasks.today;
        $scope.tasksPrev    = gtGetData.tasks.prev;
        $scope.tasksNext    = gtGetData.tasks.next;
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
        $scope.name     = gtGetData.garden.name;
        $scope.garden   = gtGetData.garden.areas;
        $scope.params   = gtGetData.params;
    });
    
}).directive('areas', function () {
    return {
        restrict: 'E',
        scope: {
            data: '=',
            data2: '='
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
    
    //Filter seasons
    $scope.filterSeason = function(item){
        var filter = false;
        angular.forEach($scope.filter, function (value, key) {
            if(value === true){
                filter = $scope.filter;
            }
        });
        
        gtGetData.update({filters: filter});
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



