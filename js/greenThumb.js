/* global moment */ 
/* jshint unused: true */

window.greenThumb = (function(){
    'use strict';
     
    //Master object
    var greenThumb = {
        users : {},                                                                         //Hold created users
        produce : window.produce                                                            //Get produce from other JS file, produce.js
    };
 
    //Application parameters
    var params = {
        today : moment(),                                                                   //Today's date
        daysToPixels : Math.round($('#gt-year').width()/365*100)/100,                       //Each day is represented by this many pixels
        rowWidth : 18,                                                                      //The width between multiple rows
        tasksNext : 30,                                                                     //Show upcoming tasks within this many days
        tasksPrev : 30,                                                                     //Show previous tasks within this many days
        monthWidth : $('#gt-year').find('.gt-col')[0].getBoundingClientRect().width - 1     //Get the width of the month
    };
    
    //params.today = moment().set({year: 2015, month: 9, date: 17, hours: 0});
    
  
    /**
     * Kick things off
     * @returns {undefined}
     */
    greenThumb.init = function() {
        //Add todays date line
        $('#gt-areas-bg').css('left', helpers.position(params.today) + 'px');
        //Kick off app
        greenThumb.scheduling.buildCalendar();
        events.init();
        events.display();
    };
    
    
    /**
     * Manage the data
     */
    greenThumb.addEdit = {
        
        /**
         * Create a new user. 1 user can have multiple gardens
         * @param {type} obj
         * @returns {unresolved}
         */
        user: function(obj) {
            var num;
            //If a user ID is specified, update the user information
            if (typeof obj.userID !== "undefined") {
                greenThumb.users[obj.userID].name = obj.name;
                //No ID specified, create a new user and default garden
            } else {
                //Get current number of users in obj, use that as primary key
                num = Object.keys(greenThumb.users).length;
                greenThumb.users[num] = {
                    name: obj.name
                };
                //Create default garden
                greenThumb.users[num].gardens = {};
                params.userID = num;
            }
            return num;
        }, //end user
              
        
        /**
         * Create a new garden. 1 garden can have multiple growing areas
         * @param {type} obj
         * @returns {unresolved}
         */
        garden: function(obj) {
            var num;
            //If a userID and a gardenID are specified, update the information
            if (typeof obj.userID !== "undefined" && typeof obj.gardenID !== "undefined") {
                greenThumb.users[obj.userID].gardens[obj.gardenID].label = obj.label;
                //Create a new garden    
            } else {
                num = Object.keys(greenThumb.users[obj.userID].gardens).length;
                greenThumb.users[obj.userID].gardens[num] = {
                    label: obj.label,
                    areas: {}//Create a default first area
                };
                params.gardenID = num;
            }
            return num;
        }, //end garden


        /**
         * Add a growing area within the garden
         * @param {type} obj
         * @returns {unresolved}
         */
        area: function(obj) {
            var num = Object.keys(greenThumb.users[obj.userID].gardens[obj.gardenID].areas).length;
            greenThumb.users[obj.userID].gardens[obj.gardenID].areas[num] = {
                label: obj.label,
                width: obj.width, //in inches
                length: obj.length, //in inches
                produce: []
            };
            params.areaID = num;
            return num;
        }, //end area
        
        /**
         * Add produce to a growing area. An area can have multiple produce objects
         * @param {type} obj
         * @returns {undefined}
         */
        produce: function(obj) {
            //console.log(obj);
            //Create new object with all the parameters
            var item = {};
            //Clone object
            var produce = $.extend({}, greenThumb.produce[obj.produce]);
            
            //Check if this produce entry has a parent, load that parents stats first
            if(typeof produce.parent !== 'undefined' ){
                //Clone parent object
                item.plant =  $.extend({}, greenThumb.produce[produce.parent]);
                
                //Loop through the values in the current produce item and replace any from the parent
                $.each(produce, function(key){
                    //Check if a key in the current produce item is set, override parent item
                    if(typeof item.plant[key] !== 'undefined'){
                        item.plant[key] = produce[key];
                    }
                });
            } else {
                item.plant = produce;
            }
            
            //Calculate all the correct dates for this produce item
            item.dates = {
                seedlings: obj.plantingDate.clone().subtract(item.plant.seedling, 'weeks').day(6),
                planting: obj.plantingDate.day(6),
                harvestStart: obj.plantingDate.clone().add(item.plant.maturity, 'days'),
                harvestComplete: obj.plantingDate.clone().add((item.plant.harvest * 7) + item.plant.maturity, 'days')
            };
            
            //If a custom number of plants for this growing area is specified, use that
            if (typeof obj.numPlants !== "undefined") {
                item.totalPlants = obj.numPlants;
                //Calculate the recommended number of plants that will fit within the growing area
                //NOTE: Automatic plant calculation requires that no other plants are in the growing area. Users will have to manually calculate their own if thats not the case
            } else {
                item.rows = Math.floor(greenThumb.users[obj.userID].gardens[obj.gardenID].areas[obj.areaID].width / params.rowWidth);
                item.plantsPerRow = Math.floor(greenThumb.users[obj.userID].gardens[obj.gardenID].areas[obj.areaID].length / obj.produce.spacing);
                item.totalPlants = item.rows * item.plantsPerRow;
            }
            
            //Add produce item to growing area
            greenThumb.users[obj.userID].gardens[obj.gardenID].areas[obj.areaID].produce.push(item);
        },
        
        /**
         * Create a new user with a default garden and growing area
         * @param {type} obj
         * @returns {undefined}
         */
        easyStart: function(obj) {
            params.userID = greenThumb.addEdit.user(obj);
            params.gardenID = greenThumb.addEdit.garden({
                userID: params.userID,
                label: 'My Backyard'
            });
           
        }//end easyStart
    };
    
    

    
    
    
    greenThumb.scheduling = {
        /**
         * Build the calendar component. 
         */
        buildCalendar : function(){
            //Object to consolidate dates
            var dateObj = {};
            
            //Loop through each growing area
            $.each(greenThumb.users[params.userID].gardens[params.gardenID].areas, function(key1, area) {
                
                //Create the HTML container for the growing area. This needs to reset for each loop of the areas param
                var $htmlEntry = $('<div/>').attr('class', 'gt-area gt-area-' + helpers.makeSlug(area.label))
                        .append($('<h4/>').html(area.label));
               
                //Loop through each produce item within each growing area
                $.each(area.produce, function(key2, item) {
                    //Add each item of produce to the growing area DOM element
                    $htmlEntry.append(greenThumb.scheduling.calendarItem(item));
                    
                    //Loop through the dates within each planting item
                    $.each(item.dates, function(key3, date) {
                        //Create an array within the date object to hold all the planting dates
                        if (typeof dateObj[date.format('YYYY-MM-DD')] === "undefined") {
                            dateObj[date.format('YYYY-MM-DD')] = {date : date, content : [], id : date.format('YYYYMMDD')};
                        }
                       
                        var content = {
                            plant : item.plant,
                            type : key3,
                            totalPlants : item.totalPlants
                        };
                        //Add item to the array
                        dateObj[date.format('YYYY-MM-DD')].content.push(content);
                    });
                });
                
                //Load HTML area DOM element into content area
                $('#gt-areas').append($htmlEntry);
            });
            //Now outside the loop, add all the appropriate tasks in
            greenThumb.scheduling.taskCheck(dateObj);
        },//end buildCalendar
        
        
        /**
         * Build each individual calendar item
         * @param {type} item
         * @returns {unresolved}
         */
        calendarItem: function(item) {
            //Create DOM element for this row
            var $produceRow = $('<div/>').attr('class', 'gt-produce filter gt-row gt-produce-' + helpers.makeSlug(item.plant.label))
                                .append($('<div/>').attr('class', 'gt-description gt-row').html(item.plant.label))
                                .append($('<div/>').attr('class', 'gt-content gt-row'))
                                .append($('<div/>').attr('style', 'clear:both;'));
            
            //Determine what season the planting date is in
            var plantMonth = item.dates.planting.format('M');
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
                            
            $produceRow.attr('data-season',season);
            $produceRow.addClass('filter-season-'+season);
            
            var plantingLocation = Math.floor(helpers.position(item.dates.seedlings));

            //Seedling DIV
            var seedlingWidth = Math.floor(item.plant.seedling * params.daysToPixels * 7);
            var harvestWidth = Math.floor(item.plant.harvest * params.daysToPixels * 7);
            var plantingWidth = Math.floor((item.plant.maturity * params.daysToPixels) + seedlingWidth + harvestWidth);
            
            //Harvest start DIV
            var $planting = $('<div/>').addClass('gt-plant gt-planting').css({left: plantingLocation + 'px', width: plantingWidth + 'px'})
                .append($('<div/>').addClass('gt-plant gt-seedlings').css({width: seedlingWidth + 'px'}).attr('data-date',item.dates.seedlings.format('YYYY-MM-DD'))
                        )
                .append($('<div/>').addClass('gt-plant gt-harvestStart').css({width: harvestWidth + 'px'}).attr('data-date',item.dates.harvestStart.format('YYYY-MM-DD'))
                        );
                         
            $planting.attr('data-date',item.dates.planting.format('YYYY-MM-DD'));
                             
            //Load those 3 divs into the row DOM element
            $produceRow.find('.gt-content').append($planting);
            
            //Check if this calendar item bleeds into the next year, IE wraps from year to year
            //If so we need to create another DOM elements that starts in the first of the year
            if (plantingWidth + plantingLocation > $('#gt-year').width()) {
                //Figure out how much to offset the new row
                var offset = -Math.abs($('#gt-year').width() - plantingLocation);
                //Duplicate the planting row and offset with the specified amount so it wraps correctly form year to year
                var clone = $planting.clone().css({left: offset + 'px'});
                //Add this to the product row element
                $produceRow.find('.gt-content').append(clone);
            }

            return $produceRow;
        },//end calendarItem
        
        
        /**
         * Loop through the dates array and check if any scheduled dates fall within the parameters specified
         * @param {type} dateObj
         * @returns {undefined}
         */
        taskCheck: function(dateObj) {
            //Rebuild the date object into an array
            //This allows us to sort the tasks by date which isn't possible in an object
            var dateArray = [];
            $.each(dateObj, function(key, value) {
                dateArray.push(value);
            });
          
            //Sort date array
            dateArray.sort(function(a, b) {
                return parseFloat(a.id) - parseFloat(b.id);
            });

            //Loop through the date array, figure out which task pane to put it in (if any)
            $.each(dateArray, function(key, value) {
                if (value.date.isSame(params.today, 'day') === true) {
                    $('#gt-schedule-today').append(greenThumb.scheduling.taskBuild(value));
                } else if (value.date.isBetween(params.today.clone().subtract(params.tasksPrev, 'days'), params.today, 'day') === true) {
                    $('#gt-schedule-prev').append(greenThumb.scheduling.taskBuild(value));
                } else if (value.date.isBetween(params.today, params.today.clone().add(params.tasksNext, 'days'), 'day') === true) {
                    $('#gt-schedule-next').append(greenThumb.scheduling.taskBuild(value));
                }
            });
        },//end taskCheck
        
        
        /**
         * Builds the DOM element to load into the task pane
         * @param {type} obj - A date object passed from taskCheck
         * @returns {unresolved} - jQuery HTML object
         */
        taskBuild: function(obj) {
            //console.log(obj);
            
            //Build default DOM object
            var $content = $('<div/>').addClass('filter-tasks ' + helpers.getSeason(obj.date))
                    .append('<p>' + obj.date.format('dddd, MMMM Do') + '</p>')
                    .append('<ul/>');
            
            //Now loop through all the tasks that are shared on this date and add to the DOM object
            $.each(obj.content, function(key, value) {
                var str, plantCount;
                
                //Check if the number of plants is set, if not set to blank
                if(!isNaN(parseFloat(value.totalPlants))){
                    plantCount = value.totalPlants;
                } else {
                    plantCount = '';
                }
                
                //Build string for task pane
                switch (value.type) {
                    case 'planting':
                        str = 'Plant ' + plantCount + ' ';
                        break;
                    case 'seedlings':
                        str = 'Start ' + plantCount + ' seedlings for ';
                        break;
                    case 'harvestStart':
                        str = 'Start harvesting ';
                        break;
                    case 'harvestComplete':
                        str = 'Complete harvesting ';
                        break;
                }
                
                //This could be better
                if (value.plant.seedling === (0|'NA') && value.type === 'seedlings') {
                    //console.log('No seedlings');
                } else {
                     $content.find('ul').append('<li class="filter-task filter-task-' + value.type + '">' + str + value.plant.label + '</li>');
                }
                
                //Add a filtering option to the task entry
                //$content.addClass('filter-task-' + value.type);
            });
            return $content;
        }//end taskBuild
    };//end scheduling
    
    
    /**
     * Manage the interaction events
     * @returns {undefined}
     */
    var events = {
        
        formSeasons : $('#gt-filter-season').find('input'),                     //The form for filtering by season
        formTasks : $('#gt-filter-task').find('input'),                         //The form for filtering tasks
        
        /**
         * Set all the interaction events
         * @returns {undefined}
         */
        init : function(){
            //Load variable content that needs to happen AFTER the DOM is built. Loaded only once on init.
            events.tasks = $('#gt-schedule').find('.filter-task');
            events.taskGroup = $('#gt-schedule').find('.filter-tasks');
            events.areas = $('#gt-areas').find('.gt-area');
            events.produce = $('.filter');
            
            //When an option from the seasons form is changed
            events.formSeasons.on('change', function() {
                events.display();
            });

            //When an option from the task type form is changed
            events.formTasks.on('change', function() {
                events.display();
            });
        },//end init
        
        /**
         * Manage all the filtering and sorting functionality
         * @returns {undefined}
         */
        display: function() {
            //We need to build a string to use for the filtering component
            var string = [];
            $.each(events.formSeasons, function() {
                if ($(this).is(":checked")) {
                    string.push('.filter-season-' + $(this).val());
                }
            });
            //Hide all the calendar items and only show the filtered ones
            events.produce.hide().filter(string.join(', ')).show();
            //If nothing is checked, show all
            if (events.produce.is(':visible') === false) {
                events.produce.show();
            }
            //Hide any areas that don't have a produce entry visible
            events.areas.show();
            $.each(events.areas, function() {
                if ($(this).find('.gt-produce').is(':visible') === false) {
                    $(this).hide();
                }
            });

            //We need to build a string to use for the filtering component
            var string = [];
            $.each(events.formTasks, function() {
                if ($(this).is(":checked")) {
                    string.push('.filter-task-' + $(this).val());
                }
            });

            //Hide all the task items and only show the filtered ones
            events.tasks.hide().filter(string.join(', ')).show();
            //If nothing is checked, show all
            if (events.formTasks.is(':checked') === false) {
                events.tasks.show();
            }

            //Make sure a task group has at least one visible item. If not hide the group
            events.taskGroup.show();
            $.each(events.taskGroup, function() {
                if ($(this).find('.filter-task').is(':visible') === false) {
                    $(this).hide();
                }
            });
        }//end display
    };//end events
    
    
    //Helper Methods
    var helpers = {
        /**
         * Convert a string to a URL friendly slug
         * @param {type} str - A string
         * @returns {undefined} - URL friendly slug
         */
        makeSlug: function(str) {
            return str.toLowerCase()
                    .replace(/ /g, '-')
                    .replace(/[^\w-]+/g, '');
        },//end makeSlug  
        
        /**
         * Figure out where to position the calender item in the DOM
         * @param {type} date
         * @returns {Number}
         */
        position: function(date){
            
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
        getSeason : function(date){
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