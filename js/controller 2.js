/* global moment, angular */
/* jshint unused: true */

window.greenThumb = (function () {
    'use strict';

    //Master object
    var greenThumb = {
        app : angular.module('gtApp', []),                                      //Angular app
        produce: window.gtProduce,                                              //Get produce from other JS file, produce.js
        garden : {},
        tasks: {
            today: {},
            prev: {},
            next: {}
        }
    };

    //Application parameters
    var params = {
        today: moment(),                                                        //Today's date
        //daysToPixels : Math.round($('#gt-year').width()/365*100)/100,         //Each day is represented by this many pixels
        rowWidth: 18,                                                           //The width between multiple rows
        tasksNext: 90,                                                          //Show upcoming tasks within this many days
        tasksPrev: 90                                                           //Show previous tasks within this many days
        //monthWidth : $('#gt-year').find('.gt-col')[0].getBoundingClientRect().width - 1     //Get the width of the month
    };

    //Override todays date
    params.today = moment().set({year: 2015, month: 2, date: 1, hours: 0});



     /**
     * Ajaxes in the model content and makes available to angular
     */
    greenThumb.app.factory("gtGetData", function ($http) {
       
        var params = {
            today: moment(), //Today's date
            rowWidth: 18, //The width between multiple rows
            tasksNext: 90, //Show upcoming tasks within this many days
            tasksPrev: 90, //Show previous tasks within this many days
            data: $http({
                method: 'GET',
                url: 'js/model.js'
            }).then(function ($response) {
                //model.build($response.data[0]);
                greenThumb.model.build($response.data[0]);
                return greenThumb;
            })
        };
        
        var model = {
            /**
             * Build the data model for the schedule to pass to angular
             * @param {type} data - An object containing the garden info
             * @returns {undefined}
             */
            build: function (data) {

                //Reset tasks
                params.tasks = {today: {}, prev: {}, next: {}};

                //Loop through each growing area in the model
                $.each(data.areas, function (key1, value1) {

                    //Loop through the produce within each area
                    $.each(value1.produce, function (key2, value2) {

                        //Check if the dates have already been generated
                        if (typeof greenThumb.garden.areas[key1].produce[key2].dates.seedlings === 'undefined') {
                            //Update the model with the seedling, harvest start and harvest complete dates
                            //Object needs to be duplicate since we are reusing data from the input object
                            greenThumb.garden.areas[key1].produce[key2] = angular.copy(greenThumb.model.updateDates(value2));
                        }

                        //Build the tasks list
                        greenThumb.model.addTasks(key1, key2);
                    });
                });
            }, //end greenThumb.buildSchedule


            /**
             * Adds the seedling, harvest start and harvest complete dates to the object. These dates are based off the plant date.
             * @param {type} obj - A produce object
             * @returns {undefined} - The same produce object with the new dates added
             */
            updateDates: function (obj) {
                //console.log(obj);
                var produce = {};

                //Check if this produce item has a parent item with preset values. 
                if (greenThumb.produce[obj.id].hasOwnProperty('parent')) {
                    //Load the data from the parent item
                    produce = greenThumb.produce[greenThumb.produce[obj.id].parent];
                    //Now overwrite the parent data with any data present in the child item
                    $.each(greenThumb.produce[obj.id], function (key, value) {
                        produce[key] = value;
                    });
                    //No parent item, just load default data    
                } else {
                    produce = greenThumb.produce[obj.id];
                }

                //Add in number of plants
                produce.numPlants = obj.numPlants;
                produce.slug = obj.id;

                //Turn plant date into moment object
                var plant = moment().set({month: obj.dates.plant.month, date: obj.dates.plant.day});

                //Now we need to add dates for the other planting chores, IE starting seedlings etc.
                //These are all based off the plant date and pull data from produce.js
                produce.dates = {
                    plant: plant,
                    seedlings: plant.clone().subtract(produce.seedling, 'weeks').day(6),
                    harvest_start: plant.clone().add(produce.maturity, 'days'),
                    harvest_finish: plant.clone().add((produce.harvest * 7) + produce.maturity, 'days')
                };
                return produce;
            }, //end addDates


            /**
             * Create the tasks list
             * @param {type} key1
             * @param {type} key2
             * @returns {undefined}
             */
            addTasks: function (key1, key2) {

                /**/
                //Now loop through all the dates within this produce item
                $.each(greenThumb.garden.areas[key1].produce[key2].dates, function (key3, value3) {
                    //If Today
                    if (value3.isSame(params.today, 'day') === true) {
                        //Check if an object has been created for this date, if not create one
                        if (!$.isPlainObject(greenThumb.tasks.today[value3.format("YYYYMMDD")])) {
                            greenThumb.tasks.today[value3.format("YYYYMMDD")] = {
                                label: value3.format("dddd, MMMM Do")
                            };
                        }
                        //Now check if the object has an array to hold the values, if not create one
                        if (!$.isArray(greenThumb.tasks.today[value3.format("YYYYMMDD")].items)) {
                            greenThumb.tasks.today[value3.format("YYYYMMDD")].items = [];
                        }
                        //Get a properly formatted task string
                        var task = greenThumb.model.formatTasks(key3, greenThumb.garden.areas[key1].produce[key2]);
                        //Then send it to the previous task container object
                        greenThumb.tasks.today[value3.format("YYYYMMDD")].items.push(task);
                        //If previous    
                    } else if (value3.isBetween(params.today.clone().subtract(params.tasksPrev, 'days'), params.today, 'day') === true) {
                        //Check if an object has been created for this date, if not create one
                        if (!$.isPlainObject(greenThumb.tasks.prev[value3.format("YYYYMMDD")])) {
                            greenThumb.tasks.prev[value3.format("YYYYMMDD")] = {
                                label: value3.format("dddd, MMMM Do")
                            };
                        }
                        //Now check if the object has an array to hold the values, if not create one
                        if (!$.isArray(greenThumb.tasks.prev[value3.format("YYYYMMDD")].items)) {
                            greenThumb.tasks.prev[value3.format("YYYYMMDD")].items = [];
                        }
                        //Get a properly formatted task string
                        var task = greenThumb.model.formatTasks(key3, greenThumb.garden.areas[key1].produce[key2]);
                        //Then send it to the previous task container object
                        greenThumb.tasks.prev[value3.format("YYYYMMDD")].items.push(task);
                        //If upcoming  /  
                    } else if (value3.isBetween(params.today, params.today.clone().add(params.tasksNext, 'days'), 'day') === true) {
                        //Check if an object has been created for this date, if not create one
                        if (!$.isPlainObject(greenThumb.tasks.next[value3.format("YYYYMMDD")])) {
                            greenThumb.tasks.next[value3.format("YYYYMMDD")] = {
                                label: value3.format("dddd, MMMM Do")
                            };
                        }
                        //Now check if the object has an array to hold the values, if not create one
                        if (!$.isArray(greenThumb.tasks.next[value3.format("YYYYMMDD")].items)) {
                            greenThumb.tasks.next[value3.format("YYYYMMDD")].items = [];
                        }
                        //Get a properly formatted task string
                        var task = greenThumb.model.formatTasks(key3, greenThumb.garden.areas[key1].produce[key2]);
                        //Then send it to the previous task container object
                        greenThumb.tasks.next[value3.format("YYYYMMDD")].items.push(task);
                    }
                });
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
        
        
       
       return params;
      
    });


    /**
     * Class for data object
     */
    greenThumb.model = {

        /**
         * Build the data model for the schedule to pass to angular
         * @param {type} data - An object containing the garden info
         * @returns {undefined}
         */
        build: function (data) {
            console.log('build');
            greenThumb.garden = data;
            
            //Reset tasks
            greenThumb.tasks = {today: {},prev: {},next: {}};

            //Loop through each growing area in the model
            $.each(data.areas, function (key1, value1) {
                
                //Loop through the produce within each area
                $.each(value1.produce, function (key2, value2) {

                    //Check if the dates have already been generated
                    if (typeof greenThumb.garden.areas[key1].produce[key2].dates.seedlings === 'undefined') {
                        //Update the model with the seedling, harvest start and harvest complete dates
                        //Object needs to be duplicate since we are reusing data from the input object
                        greenThumb.garden.areas[key1].produce[key2] = angular.copy(greenThumb.model.updateDates(value2));
                    }
                    
                    //Build the tasks list
                    greenThumb.model.addTasks(key1,key2);
                });
            });
        }, //end greenThumb.buildSchedule


        /**
         * Adds the seedling, harvest start and harvest complete dates to the object. These dates are based off the plant date.
         * @param {type} obj - A produce object
         * @returns {undefined} - The same produce object with the new dates added
         */
        updateDates: function (obj) {
            //console.log(obj);
            var produce = {};

            //Check if this produce item has a parent item with preset values. 
            if (greenThumb.produce[obj.id].hasOwnProperty('parent')) {
                //Load the data from the parent item
                produce = greenThumb.produce[greenThumb.produce[obj.id].parent];
                //Now overwrite the parent data with any data present in the child item
                $.each(greenThumb.produce[obj.id], function (key, value) {
                    produce[key] = value;
                });
            //No parent item, just load default data    
            } else {
                produce =  greenThumb.produce[obj.id];
            }
            
            //Add in number of plants
            produce.numPlants = obj.numPlants;
            produce.slug = obj.id;
            
            //Turn plant date into moment object
            var plant = moment().set({month: obj.dates.plant.month, date: obj.dates.plant.day});
            
            //Now we need to add dates for the other planting chores, IE starting seedlings etc.
            //These are all based off the plant date and pull data from produce.js
            produce.dates = {
                plant : plant,
                seedlings: plant.clone().subtract(produce.seedling, 'weeks').day(6),
                harvest_start: plant.clone().add(produce.maturity, 'days'),
                harvest_finish: plant.clone().add((produce.harvest * 7) + produce.maturity, 'days')
            };
            return produce;
        },//end addDates
        
    
        /**
         * Create the tasks list
         * @param {type} key1
         * @param {type} key2
         * @returns {undefined}
         */
        addTasks: function(key1,key2){
            
            /**/
            //Now loop through all the dates within this produce item
            $.each(greenThumb.garden.areas[key1].produce[key2].dates, function (key3, value3) {
                //If Today
                if (value3.isSame(params.today, 'day') === true) {
                    //Check if an object has been created for this date, if not create one
                    if (!$.isPlainObject(greenThumb.tasks.today[value3.format("YYYYMMDD")])) {
                        greenThumb.tasks.today[value3.format("YYYYMMDD")] = {
                            label: value3.format("dddd, MMMM Do")
                        };
                    }
                    //Now check if the object has an array to hold the values, if not create one
                    if (!$.isArray(greenThumb.tasks.today[value3.format("YYYYMMDD")].items)) {
                        greenThumb.tasks.today[value3.format("YYYYMMDD")].items = [];
                    }
                    //Get a properly formatted task string
                    var task = greenThumb.model.formatTasks(key3, greenThumb.garden.areas[key1].produce[key2]);
                    //Then send it to the previous task container object
                    greenThumb.tasks.today[value3.format("YYYYMMDD")].items.push(task);
                    //If previous    
                } else if (value3.isBetween(params.today.clone().subtract(params.tasksPrev, 'days'), params.today, 'day') === true) {
                    //Check if an object has been created for this date, if not create one
                    if (!$.isPlainObject(greenThumb.tasks.prev[value3.format("YYYYMMDD")])) {
                        greenThumb.tasks.prev[value3.format("YYYYMMDD")] = {
                            label: value3.format("dddd, MMMM Do")
                        };
                    }
                    //Now check if the object has an array to hold the values, if not create one
                    if (!$.isArray(greenThumb.tasks.prev[value3.format("YYYYMMDD")].items)) {
                        greenThumb.tasks.prev[value3.format("YYYYMMDD")].items = [];
                    }
                    //Get a properly formatted task string
                    var task = greenThumb.model.formatTasks(key3, greenThumb.garden.areas[key1].produce[key2]);
                    //Then send it to the previous task container object
                    greenThumb.tasks.prev[value3.format("YYYYMMDD")].items.push(task);
                    //If upcoming  /  
                } else if (value3.isBetween(params.today, params.today.clone().add(params.tasksNext, 'days'), 'day') === true) {
                    //Check if an object has been created for this date, if not create one
                    if (!$.isPlainObject(greenThumb.tasks.next[value3.format("YYYYMMDD")])) {
                        greenThumb.tasks.next[value3.format("YYYYMMDD")] = {
                            label: value3.format("dddd, MMMM Do")
                        };
                    }
                    //Now check if the object has an array to hold the values, if not create one
                    if (!$.isArray(greenThumb.tasks.next[value3.format("YYYYMMDD")].items)) {
                        greenThumb.tasks.next[value3.format("YYYYMMDD")].items = [];
                    }
                    //Get a properly formatted task string
                    var task = greenThumb.model.formatTasks(key3, greenThumb.garden.areas[key1].produce[key2]);
                    //Then send it to the previous task container object
                    greenThumb.tasks.next[value3.format("YYYYMMDD")].items.push(task);
                }
            });
        },//end addTasks
        
        
        /**
         * Create the string used in the task pane
         * @param {str} type - String of the task type, IE 'seedlings' or 'plant'
         * @param {obj} obj - The plant object
         * @returns {controller_L4.greenThumb.model.formatTasks.obj} - Returns the plant object with the dates added
         */
        formatTasks: function (type,obj) {
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
                slug: 'filter-task-'+type,
                produce: obj
            };
            return obj;
        }
    };//end model
    
   
   
   
   
   


   
    
  
    /**
     * Controller for the task scheduler
     */
    greenThumb.app.controller('gtSchedule', function ($scope, gtGetData) {
      console.log(gtGetData);
        /**/
        gtGetData.data.then(function (data) {
            //$scope.tasksPrev = data.tasks.prev;
            //$scope.tasksNext = data.tasks.next;
            $scope.tasksToday = data.tasks.today;
            /*
            $scope.$watch(function () {
                //console.log('Me')
                $scope.tasksToday = data.tasks.today;
            });
           */
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

        $scope.name = 'Moms Backyard';
        /*
        gtGetData.then(function (data) {
            $scope.garden = data.garden.areas;
        });
        */
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

        $scope.datetoday = params.today.format("YYYYMMDD");

        $scope.display = function () {
            //console.log(greenThumb.tasks);
            params.today = moment().set({year: 2015, month: 4, date: 1, hours: 0});
            //gtGetData.update();
            greenThumb.model.build(greenThumb.garden);
            //gtGetData.data = greenThumb;
            //console.log(gtGetData);
           
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



