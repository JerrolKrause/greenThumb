/* global moment */
/* jshint unused: true */

window.greenThumb = (function () {
    'use strict';

    //Master object
    var greenThumb = {
        app : angular.module('gtApp', []),//Angular app
        produce: window.gtProduce, //Get produce from other JS file, produce.js
        garden: jQuery.extend(true, {}, window.gtGarden), //Get garden from model, clone to ensure we don't mess with the original data source
        tasks: {
            today: {},
            prev: {},
            next: {}
        }
    };

    //Application parameters
    var params = {
        today: moment(), //Today's date
        //daysToPixels : Math.round($('#gt-year').width()/365*100)/100,                       //Each day is represented by this many pixels
        rowWidth: 18, //The width between multiple rows
        tasksNext: 120, //Show upcoming tasks within this many days
        tasksPrev: 120                                     //Show previous tasks within this many days
        
                //monthWidth : $('#gt-year').find('.gt-col')[0].getBoundingClientRect().width - 1     //Get the width of the month
    };

    params.today = moment().set({year: 2015, month: 2, date: 1, hours: 0});


    /**
     * Kick things off
     * @returns {undefined}
     */
    greenThumb.init = function () {
        //Add todays date line
        //$('#gt-areas-bg').css('left', helpers.position(params.today) + 'px');

        greenThumb.model.build(greenThumb.garden.areas);

    };


    greenThumb.model = {
        /**
         * Build the data model for the schedule and pass to angular
         * @returns {undefined}
         */
        build: function (data) {

            //Loop through each growing area in the model
            $.each(data, function (key1, value1) {
                //Loop through the produce within each area
                $.each(value1.produce, function (key2, value2) {

                    //Update the model with the seedling, harvest start and harvest complete dates
                    greenThumb.garden.areas[key1].produce[key2] = greenThumb.model.updateDates(value2);

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
                });
            });
        }, //end greenThumb.buildSchedule


        /**
         * Adds the seedling, harvest start and harvest complete dates to the object. These dates are based off the plant date.
         * @param {type} obj - A produce object
         * @returns {undefined} - The same produce object with the new dates added
         */
        updateDates: function (obj) {
            //console.log('WHY YOU NO WORK????');
            var produce;

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

            //Now we need to add dates for the other planting chores, IE starting seedlings etc.
            //These are all based off the plant date and pull data from produce.js
            produce.dates = {
                seedlings: obj.date_plant.clone().subtract(produce.seedling, 'weeks').day(6),
                plant: obj.date_plant,
                harvest_start: obj.date_plant.clone().add(produce.maturity, 'days'),
                harvest_finish: obj.date_plant.clone().add((produce.harvest * 7) + produce.maturity, 'days')
            };
            
            return produce;
        },//end addDates
        
        
        /**
         * 
         * @param {type} type
         * @param {type} obj
         * @returns {controller_L4.greenThumb.model.formatTasks.obj}
         */
        formatTasks: function (type,obj) {
           
            var str;
            //Figure out which activity type this is, set appropriate string
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
     * 
     */
    //greenThumb.app = angular.module('gtApp', []);
    /**
     * Controller for the task scheduler
     */
    greenThumb.app.controller('gtSchedule', ['$scope', function ($scope) {
            $scope.name = 'Moms Backyard';

            $scope.tasksPrev = greenThumb.tasks.prev;
            $scope.tasksNext = greenThumb.tasks.next;
            $scope.tasksToday = greenThumb.tasks.today;
            console.log($scope.tasksPrev);
        }]).directive('dateEntry', function () {
        return {
            restrict: 'E',
            scope: {
                data: '='
            },
            //template: '<p><strong>{{customerinfo.label}}</strong></p><ul><li class="filter-task filter-task-seedlings" ng-repeat="taskItem in customerinfo.items">{{taskItem.label}}</li></ul>'
            templateUrl: 'partials/date-entry.html'
        };
    });

    /**
     * Controller for the calender
     */
    greenThumb.app.controller('gtCalendar', ['$scope', function ($scope) {
            $scope.name = 'Moms Backyard';
    }]);

        

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

    greenThumb.init();

    return greenThumb;
})();



