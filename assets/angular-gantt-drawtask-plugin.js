/*
Project: angular-gantt v1.2.11-fork-1.0.1 - Gantt chart component for AngularJS - DSEAB Fork
Authors: Marco Schweighauser, Rémi Alvergnat
License: MIT
Homepage: https://www.angular-gantt.com
Github: https://github.com/angular-gantt/angular-gantt.git
*/
(function(){
    'use strict';
    angular.module('gantt.drawtask', ['gantt']).directive('ganttDrawTask', ['$document', 'ganttMouseOffset', 'ganttUtils', 'moment', function(document, mouseOffset, utils, moment) {
        return {
            restrict: 'E',
            require: '^gantt',
            scope: {
                enabled: '=?',
                moveThreshold: '=?',
                taskModelFactory: '=?taskFactory'
            },
            link: function(scope, element, attrs, ganttCtrl) {
                var api = ganttCtrl.gantt.api;

                if (scope.enabled === undefined) {
                    scope.enabled = true;
                }

                if (scope.moveThreshold === undefined) {
                    scope.moveThreshold = 0;
                }

                if (scope.taskModelFactory === undefined) {
                    scope.taskModelFactory = function() {
                        return {}; // New empty task.
                    };
                }

                api.directives.on.new(scope, function(directiveName, directiveScope, element) {
                    if (directiveName === 'ganttRow') {
                        var addNewTask = function(x) {
                            var startDate = api.core.getDateByPosition(x, true);
                            var endDate = moment(startDate);

                            var taskModel = scope.taskModelFactory();
                            // PATCH: Snap to magnet units.
                            taskModel.from = startDate.startOf(directiveScope.row.rowsManager.gantt.columnMagnetUnit);
                            taskModel.to = endDate.endOf(directiveScope.row.rowsManager.gantt.columnMagnetUnit);

                            var task = directiveScope.row.addTask(taskModel);
                            task.isResizing = true;
                            task.updatePosAndSize();
                            directiveScope.row.updateVisibleTasks();

                            directiveScope.row.$scope.$digest();
                        };

                        var deferDrawing = function(startX) {
                            var moveTrigger = function(evt) {
                                var currentX = mouseOffset.getOffset(evt).x;

                                if (Math.abs(startX - currentX) >= scope.moveThreshold) {
                                    element.off('mousemove', moveTrigger);
                                    addNewTask(startX);
                                }
                            };

                            element.on('mousemove', moveTrigger);
                            document.one('mouseup', function() {
                                element.off('mousemove', moveTrigger);
                            });
                        };

                        var drawHandler = function(evt) {
                            var evtTarget = (evt.target ? evt.target : evt.srcElement);
                            // PATCH:   Added second parameter "directiveScope.row" in call to enabled()-function.
                            //          The row information is required to determine if a task may be created for this
                            //          row or not.
                            var enabled = angular.isFunction(scope.enabled) ? scope.enabled(evt, directiveScope.row): scope.enabled;
                            if (enabled && evtTarget.className.indexOf('gantt-row') > -1) {
                                var x = mouseOffset.getOffset(evt).x;

                                if (scope.moveThreshold === 0) {
                                    addNewTask(x, x);
                                } else {
                                    deferDrawing(x);
                                }
                            }
                        };

                        element.on('mousedown', drawHandler);
                        directiveScope.drawTaskHandler = drawHandler;
                    }
                });

                api.directives.on.destroy(scope, function(directiveName, directiveScope, element) {
                    if (directiveName === 'ganttRow') {
                        element.off('mousedown', directiveScope.drawTaskHandler);
                        delete directiveScope.drawTaskHandler;
                    }
                });
            }
        };
    }]);
}());


angular.module('gantt.drawtask.templates', []).run(['$templateCache', function ($templateCache) {

}]);

//# sourceMappingURL=angular-gantt-drawtask-plugin.js.map