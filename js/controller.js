/* global moment, angular */
/* jshint unused: true */


window.greenThumb = (function(){
    'use strict';
    var greenThumb = angular.module('gtApp', ['ui.router']);                    //Angular app

    /**
     * Creates the model/data object for use by the rest of the application
     * @param {type} $http 
     * @param {type} $rootScope
     * @param {type} $stateParams
     * @param {type} $state
     */
    greenThumb.factory("gtGetData", function ($http, $rootScope, $stateParams, $state) {

        //Main data object
        var data = {
            produce             : window.gtProduce,
            dates               : {},
            update: function (obj) {
                //Overwrite any parameters supplied by the input object
                angular.merge(data.params, obj);
                //Now rebuild the appropriate items in the garden
                model.view.update(data.garden);
            },
            getSeason : function(date){
                return model.initialize.getSeason(date);
            }
        };

        //Application parameters
        data.params = {
            dates               : {
                main            : moment(),                                     //Main date var used by app. This can be changed in the display options
                today           : moment(),                                     //Always shows todays date
                main_pos        : false,                                        //Holds the position of the main date for use in the calendar
                today_pos       : false                                         //Holds the position of todays date for use in the calendar
            },
            tasksNext           : 30,                                           //Show upcoming tasks within this many days
            tasksPrev           : 30,                                           //Show upcoming tasks within this many days
            calcPlants          : false,                                        //Automatically calculate how many seedlings should be planted
            initLoad            : false,                                        //Flag to ensure certain only items fire on first load
            filters             : {season : false, tasks : false, misc : false} //Holds filtering options.
        };
        
        //Override todays date
        //data.params.dates.main = moment().set({year: 2015, month: 2, date: 1, hours: 0});

        //Fetch JSON object of garden to use
        $http({
            method: 'GET',
            url: 'js/model.js'
        }).then(function ($response) {
            //Pass data to updateview for display
            model.view.update($response.data[0]);
        });


        //Main model class
        var model = {

            //Class that manages the view. This gets updated every data refresh
            view: {
                /**
                 * Build the data model for the schedule to pass to angular
                 * This method contains the master loop
                 * @param {type} obj - An object containing the garden info. Originally passed from ajax then stored in the data object
                 * @returns {undefined}
                 */
                update: function (obj) {
                    //Load the garden into into the main data object
                    data.garden = obj;

                    if (data.params.initLoad === false) {
                        model.state();
                    }

                    //Loop through each growing area in the model
                    angular.forEach(data.garden.areas, function (value1, key1) {
                        
                        //Loop through the produce within each area
                        angular.forEach(value1.produce, function (value2, key2) {

                            //Only run the build script ONCE on load
                            if (data.params.initLoad === false) {
                                model.initialize.build(value1, key1, value2, key2);
                            }

                            //If the option to calculate plants is set
                            if (data.params.calcPlants === false && value1.length) {
                                value2.plantCount = value2.numPlants
                                //Calculate tbe number of plants/seedlings needed by this grow bed
                                model.view.calcPlants(value1, value2);
                            //Use set values if provided, if not set to blank   
                            } else {
                                value2.plantCount = value2.numPlants || '';
                                value2.seedlingCount = value2.seedlingPlants || '';
                            }

                        });//end produce loop
                    });//end grow area loop

                    //Refresh the task pane list
                    model.tasks.refresh();

                    //After init, set this flag to false
                    data.params.initLoad = true;
                    
                    data.params.dates.main_pos = Math.round((((data.params.dates.main.format("M") - 1) * 8.333) + ((data.params.dates.main.format("D") / data.params.dates.main.daysInMonth()) * 8.333)) * 10) / 10;
                    data.params.dates.today_pos = Math.round((((data.params.dates.today.format("M") - 1) * 8.333) + ((data.params.dates.today.format("D") / data.params.dates.today.daysInMonth()) * 8.333)) * 10) / 10;
                    
                    //Now that the task and garden list has been rebuilt, broadcast the update to the controllers so that the data is updated in the view
                    $rootScope.$broadcast('dataPassed');

                    console.log(data);
                }, //end model.updateView
                
                /**
                 * Calculates the numer of plants and seedlings needed, determined by the growing area size
                 * @param {type} value1
                 * @param {type} value2
                 * @returns {undefined}
                 */
                calcPlants: function (value1, value2) {
                    //console.log(value2);
                    //Reset seedling and plant counts
                    value2.seedlingCount =  '';

                    var count       = value1.produce.length;       //Number of types of produce in this grow bed. REQUIRES SAME SPACING
                    var length      = value1.length;               //Length of grow bed
                    var spacing     = value2.spacing;              //Spacing between plants
                    var rows        = value2.rowsPerBed || 1;      //# of rows in this bed to plant

                    //Length of bed * 12 inches / plant spacing / number of produce items sharing this grow area * number of rows for this plant
                    //value2.plantCount = Math.floor(length * 12 / spacing * rows);

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
                } //end view.calcPlants
            },//end view


            //Class object for methods that only happen on initialization/load
            initialize: {
                /**
                 * Create the main data object used by the rest of the application
                 * This method only fires once on initialization
                 * Takes the users garden JS and adds all the necessary date and task data
                 * @param {type} value1
                 * @param {type} key1
                 * @param {type} value2
                 * @param {type} key2
                 * @returns {undefined}
                 */
                build: function (value1, key1, value2, key2) {
                    //Check if this item has an ID set, this ensure this only happens once per loop
                    //If not set, we need to take the ID from the model and use that to pull in all the produce data
                    if (!value2.hasOwnProperty('id')) {
                        //If this produce item has a parent, load the child properties first
                        if (data.produce[value2.slug].hasOwnProperty('parent')) {
                            value2 = angular.extend(value2, data.produce[data.produce[value2.slug].parent]);
                            value2.label_parent = data.produce[data.produce[value2.slug].parent].label;
                        } else {
                            value2.label_parent = '';
                            value2.parent = value2.slug;
                        }
                        
                        //Now load the OVERRIDE properties from the main produce item, this will replace any properties from a parent produce item
                        value2 = angular.extend(value2, data.produce[value2.slug]);
                        //Add an ID for 'track by' performance issue
                        value2.id = key2;
                    }
                    
                    //Create a small/few character label for use on a mobile screen
                    value2.label_short = '';
                    angular.forEach(value2.label.split(' '), function (value, key) {
                        value2.label_short += value.charAt(0);
                    });
                    
                    if(value2.label_short.length === 1){
                        value2.label_short += value2.label.charAt(1);
                    }
                    //Only show the first 2 characters of the produce name
                    //value2.label_short = value2.label.charAt(0) + value2.label.charAt(1);
                   
                    //Check if the dates have already been generated, only generate on first pass
                    if (typeof value2.dates.seedlings === 'undefined') {
                        //Update the model with the seedling, harvest start and harvest complete dates
                        //Object needs to be duplicate since we are reusing data from the input object
                        model.initialize.addDates(value2);
                    }
                    
                    //Check if seasons is undefined, if so assign it
                    if(!angular.isArray(value1.seasons)){
                        value1.seasons = [];
                    }
                    
                    //If the value isn't already present add it to the array
                    if(value1.seasons.indexOf(value2.dom.season) === -1){
                        value1.seasons.push(value2.dom.season);
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
                },//end model.initialize.build
                
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
                        seedlings           : plant.clone().subtract(produce.seedling, 'weeks'), //.day(6) <- round to nearest saturday
                        plant               : plant,
                        harvest_start       : plant.clone().add(produce.maturity, 'days'),
                        harvest_complete    : plant.clone().add((produce.harvest * 7) + produce.maturity, 'days')
                    };
                    
                    //Check if a seedlings date falls to the proceeding year, add a year so it shows up in the tasks list
                    if(moment(produce.dates.seedlings).isBefore(produce.dates.plant, 'year')){
                        produce.dates.seedlings.add(1, 'year');
                    }
                    
                    //Create parameters needed by the DOM elements, used for width and positioning of calendar items
                    produce.dom = {
                        wSeedlings          : Math.round(produce.seedling * 7 * 100 / 365 * 10) / 10 + 1,
                        wGrowing            : Math.round(produce.maturity * 100 / 365 * 10) / 10,
                        wHarvesting         : Math.round(produce.harvest * 7 * 100 / 365 * 10) / 10 + 1,
                        pSeedlings          : Math.round((((produce.dates.seedlings.format("M") - 1) * 8.333) + ((produce.dates.seedlings.format("D") / produce.dates.seedlings.daysInMonth()) * 8.333)) * 10) / 10,
                        pGrowing            : Math.round((((produce.dates.plant.format("M") - 1) * 8.333) + ((produce.dates.plant.format("D") / produce.dates.plant.daysInMonth()) * 8.333)) * 10) / 10,
                        pHarvesting         : Math.round((((produce.dates.harvest_start.format("M") - 1) * 8.333) + ((produce.dates.harvest_start.format("D") / produce.dates.harvest_start.daysInMonth()) * 8.333)) * 10) / 10 - 1
                    };
                    
                    produce.dom.season = model.initialize.getSeason(plant);
                }, //end model.initialize.addDates
                
                /**
                 * Return a string of the season of the date supplied
                 * @param {type} date - A moment.js date object
                 * @returns {String} - A string of the season
                 */
                getSeason: function (date) {
                    //Spring Planting
                    if (date.isBetween(moment().month('March').subtract(1, 'month'), moment().month('May').date(31).add(1, 'month'), 'month')) {
                        return 'spring';
                        //Summer Planting    
                    } else if (date.isBetween(moment().month('June').subtract(1, 'month'), moment().month('August').date(31).add(1, 'month'), 'month')) {
                        return 'summer';
                        //Fall Planting    
                    } else if (date.isBetween(moment().month('September').subtract(1, 'month'), moment().month('November').date(30).add(1, 'month'), 'month')) {
                        return 'fall';
                        //Winter Planting    
                    } else if (date.isBetween(moment().month('November').subtract(1, 'month'), moment().month('February').add(1, 'month').add(1, 'year'), 'month') || date.isBetween(moment().month('January').subtract(1, 'month'), moment().month('Feb').add(1, 'month'), 'month')) {
                        return 'winter';
                    }
                }//end initialize.getSeason
            },//end model.initialize


            //Class object for managing tasks
            tasks: {
                /**
                 * Create or refresh the tasks list
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
                        if (value.date.isSame(data.params.dates.main, 'day') === true) {
                            model.tasks.create(value, data.tasks.today);
                            //If task is previous    
                        } else if (value.date.isBetween(data.params.dates.main.clone().subtract(data.params.tasksPrev, 'days'), data.params.dates.main, 'day') === true) {
                            model.tasks.create(value, data.tasks.prev);
                            //If task is upcoming/next     
                        } else if (value.date.isBetween(data.params.dates.main, data.params.dates.main.clone().add(data.params.tasksNext, 'days'), 'day') === true) {
                            model.tasks.create(value, data.tasks.next);
                        }
                    });

                    //Check if each task item is empty, if so set default text
                    angular.forEach(data.tasks, function (value, key) {
                        if (Object.keys(value).length === 0) {
                            data.tasks[key] = 'Nothing';
                        }
                    });
                }, //end model.tasks.refresh
                
                /**
                 * Create the string used in the task pane
                 * @param {str} dateItems - String of the task type, IE 'seedlings' or 'plant'
                 * @param {obj} taskObj - The plant object
                 * @returns {controller_L4.greenThumb.model.formatTasks.obj} - Returns the plant object with the dates added
                 */
                create: function (dateItems, taskObj) {
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
                                case 'harvest_complete':
                                    str = 'Complete harvesting ' + value2.label;
                                    break;
                            }

                            var obj = {
                                label: str,
                                slug: key
                            };

                            //Make sure the date object exists, if not create it
                            if (!angular.isObject(taskObj[dateItems.date.format("YYYYMMDD")])) {
                                taskObj[dateItems.date.format("YYYYMMDD")] = {
                                    label: dateItems.date.format("dddd, MMMM Do"),
                                    items: []
                                };
                            }

                            //Before loading this task into the tasks object, we need to meet the following conditions:
                            //If no filtering options are set, show all
                            //If the KEY of the current task item matches a filtering option AND is not UNDEFINED, show this one item
                            if (data.params.filters.tasks === false || data.params.filters.tasks[key] !== false && typeof data.params.filters.tasks[key] !== 'undefined') {
                                //Load the task into the task object
                                taskObj[dateItems.date.format("YYYYMMDD")].items.push(obj);
                            }
                        });
                    });
                }//end model.tasks.create
            },//end model.tasks
            
            /**
             * Manages the state of the application by using query parameters and UI routing
             * @returns {undefined}
             */
            state: function () {
                //Override todays date for testing
                if (typeof $stateParams.date !== 'undefined') {
                    var date = $stateParams.date.split('-');
                    data.params.dates.main = moment().set({year: parseInt(date[0], 10), month: parseInt(date[1], 10) - 1, date: parseInt(date[2], 10), hours: 0});
                }
            }//end model.state
        };//end model

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
            $scope.params       = gtGetData.params;
        });

    }).directive('dateEntry', function () {
        return {
            restrict: 'E',
            scope: {
                data: '=',
                data2: '='
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
            $scope.name         = gtGetData.garden.name;
            $scope.garden       = gtGetData.garden.areas;
            $scope.params       = gtGetData.params;
            $scope.main_pos     = gtGetData.params.dates.main_pos;
            $scope.today_pos    = gtGetData.params.dates.today_pos;
        });
        
    }).directive('areas', function () {
        return {
            restrict: 'E',
            scope: {
                data: '=',
                data2: '='
            },
            templateUrl: 'partials/calendar-row.html',
            controller: 'gtCalendar'
        };
    });


    /**
     * Controller for the display & interactive options
     */
    greenThumb.controller('gtDisplay', function ($scope, gtGetData, $stateParams, $state) {
 
        //Placeholder for filtering options. Necessary to bind events
        $scope.filterOptions = {
            season : {},
            tasks: {},
            misc : {}
        };
        
        /*
        //Get current season
        var season = gtGetData.getSeason(gtGetData.params.dates.main);
        //Set the default filtering option to the current season, both in the view and in the model
        $scope.filterOptions.season[season] = true;
        gtGetData.params.filters.season = {};
        gtGetData.params.filters.season[season] = true;
      */
     
        //When the main model is updated, add the latest date to the date picker
        $scope.$on('dataPassed', function () {
            $scope.date = gtGetData.params.dates.main.format("MM/DD/YYYY");
        });

        //When the display date input is changed
        $scope.display = function (date) {
            
            //On a date change, set all the season filtering to false to show all calendar items
            angular.forEach($scope.filterOptions.season, function(value,key){ 
                $scope.filterOptions.season[key] = false;
            });
           
            //Get the date from the main dropdown OR todays date
            var date;
            if(date === 'today'){
                date =  moment();
            } else {
                date =  moment($scope.date).add(1, 'days');
            }

            //Update app main date
            gtGetData.params.filters.season = false;
            
            $state.go('.', {date: date.format('YYYY-MM-DD')}, {notify: false});
            
            var obj = {dates : {main : date}};
            gtGetData.update(obj);
        };

        //When the seedling calculator is turned on
        $scope.calcPlants = function () {
            //Set the seedling calculator param to true so the application will calculate the # of seedlings
            gtGetData.update({calcPlants: $scope.calcSeedlings});
        };
        
        
        //Update all filters
        $scope.filterGarden = function () {

            var options = angular.copy($scope.filterOptions);

            //Loop through all the filtering options. If they are ALL set to false, set the master key to false
            angular.forEach(options, function (value, key) {
                angular.forEach(value, function (value2, key2) {
                    //console.log(key2 + ' - ' + value2);
                    if (value2 === false) {
                        //console.log('Is False');
                        delete options[key][key2];
                    }
                });

                if (Object.keys(value).length === 0) {
                    options[key] = false;
                }
            });

            //Pass filters to update function
            gtGetData.update({filters: options});

        };
    })

    /**
     * URL routing app. Manages the state of the app based on URL parameters
     * Lets the user bookmark application states
     * @param {type} param
     */
    greenThumb.config(function ($stateProvider, $urlRouterProvider) {
        $stateProvider.state('state', {
            url             : '/?date',//'/?date&filters'
            controller      : 'gtDisplay',
            controllerAs    : 'state'
        });

        $urlRouterProvider.otherwise('/');
    });


    /**
     * Adds the datepicker functionality. Requires jQuery :(
     */
    greenThumb.directive('datepicker', function DatePicker() {
        return {
            require     : 'ngModel',
            restrict    : 'A',
            scope       : {format: "="},
            link        : function (scope, element, attrs, ngModel) {
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
    
    //Make this application public and available in console
    return greenThumb;
})();