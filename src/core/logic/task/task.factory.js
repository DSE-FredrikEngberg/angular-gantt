(function() {
    'use strict';
    angular.module('gantt').factory('GanttTask', ['moment', function(moment) {

        /* GENERAL NOTES ON ALIGNMENT OF TASKS TO THE SELECTED CHANGE UNIT

             The following changes overrides are made to get a consistent behaviour when moving or resizing tasks.

             Rules used in this implementation:
             1.  When a task is moved it's start is aligned to the beginning of the current change unit (day,
                 week, month, year).
             2.  When the beginning of a task is moved (resize) it is aligned to the beginning of the current
                 change unit.no
             3.  When the end of a task is moved (resize) it is aligned to the end of the current change unit.

             For example if the unit is day a one day task will be represented as this:
             {
                 "id": "15",
                 "from": "2007-02-12T00:00:00.000+01:00",
                 "to": "2007-02-18T23:59:59.999+01:00"
             }

             Only change units supported directly by moment.js can currently be used.

         */

        var moveToCallbackFn, moveToCallbackFnThis;

        var Task = function(row, model) {
            this.rowsManager = row.rowsManager;
            this.row = row;
            this.model = model;
            this.truncatedLeft = false;
            this.truncatedRight = false;
        };

        Task.registerMoveToCallBack = function(callbackFn, thisArg) {
            moveToCallbackFn = callbackFn;
            moveToCallbackFnThis = thisArg;
        };

        Task.unregisterCallBack =  function() {
            moveToCallbackFn = undefined;
            moveToCallbackFnThis = undefined;
        };

        Task.prototype.isMilestone = function() {
            return !this.model.to || this.model.from - this.model.to === 0;
        };

        Task.prototype.isOutOfRange = function() {
            var firstColumn = this.rowsManager.gantt.columnsManager.getFirstColumn();
            var lastColumn = this.rowsManager.gantt.columnsManager.getLastColumn();

            return (firstColumn === undefined || this.model.to < firstColumn.date ||
                    lastColumn === undefined || this.model.from > lastColumn.endDate);
        };

        // Updates the pos and size of the task according to the from - to date
        Task.prototype.updatePosAndSize = function() {
            var oldViewLeft = this.left;
            var oldViewWidth = this.width;
            var oldTruncatedRight = this.truncatedRight;
            var oldTruncatedLeft = this.truncatedLeft;

            if (!this.isMoving && this.isOutOfRange()) {
                this.modelLeft = undefined;
                this.modelWidth = undefined;
            } else {
                this.modelLeft = this.rowsManager.gantt.getPositionByDate(this.model.from);
                this.modelWidth = this.rowsManager.gantt.getPositionByDate(this.model.to) - this.modelLeft;
            }

            var lastColumn = this.rowsManager.gantt.columnsManager.getLastColumn();
            var maxModelLeft = lastColumn ? lastColumn.left + lastColumn.width : 0;

            var modelLeft = this.modelLeft;
            var modelWidth = this.modelWidth;

            if (this.rowsManager.gantt.options.value('daily')) {
                modelLeft = this.rowsManager.gantt.getPositionByDate(moment(this.model.from).startOf('day'));
                modelWidth = this.rowsManager.gantt.getPositionByDate(moment(this.model.to).endOf('day')) - modelLeft;
            }

            if (modelLeft === undefined || modelWidth === undefined ||
                modelLeft + modelWidth < 0 || modelLeft > maxModelLeft) {
                this.left = undefined;
                this.width = undefined;
            } else {
                this.left = Math.min(Math.max(modelLeft, 0), this.rowsManager.gantt.width);
                if (modelLeft < 0) {
                    this.truncatedLeft = true;
                    if (modelWidth + modelLeft > this.rowsManager.gantt.width) {
                        this.truncatedRight = true;
                        this.width = this.rowsManager.gantt.width;
                    } else {
                        this.truncatedRight = false;
                        this.width = modelWidth + modelLeft;
                    }
                } else if (modelWidth + modelLeft > this.rowsManager.gantt.width) {
                    this.truncatedRight = true;
                    this.truncatedLeft = false;
                    this.width = this.rowsManager.gantt.width - modelLeft;
                } else {
                    this.truncatedLeft = false;
                    this.truncatedRight = false;
                    this.width = modelWidth;
                }

                if (this.width < 0) {
                    this.left = this.left + this.width;
                    this.width = -this.width;
                }
            }

            this.updateView();
            if (!this.rowsManager.gantt.isRefreshingColumns &&
                (oldViewLeft !== this.left ||
                oldViewWidth !== this.width ||
                oldTruncatedRight !== this.truncatedRight ||
                oldTruncatedLeft !== this.truncatedLeft)) {
                this.rowsManager.gantt.api.tasks.raise.viewChange(this);
            }
        };

        Task.prototype.updateView = function() {
            if (this.$element) {
                if (this.left === undefined || this.width === undefined) {
                    this.$element.css('display', 'none');
                } else {
                    this.$element.css({'left': this.left + 'px', 'width': this.width + 'px', 'display': ''});

                    if (this.model.priority > 0) {
                        var priority = this.model.priority;
                        angular.forEach(this.$element.children(), function(element) {
                            angular.element(element).css('z-index', priority);
                        });
                    }

                    this.$element.toggleClass('gantt-task-milestone', this.isMilestone());
                }
            }
        };

        Task.prototype.getBackgroundElement = function() {
            if (this.$element !== undefined) {
                var backgroundElement = this.$element[0].querySelector('.gantt-task-background');
                if (backgroundElement !== undefined) {
                    backgroundElement = angular.element(backgroundElement);
                }
                return backgroundElement;
            }
        };

        Task.prototype.getContentElement = function() {
            if (this.$element !== undefined) {
                var contentElement = this.$element[0].querySelector('.gantt-task-content');
                if (contentElement !== undefined) {
                    contentElement = angular.element(contentElement);
                }
                return contentElement;
            }
        };

        Task.prototype.getForegroundElement = function() {
            if (this.$element !== undefined) {
                var foregroundElement = this.$element[0].querySelector('.gantt-task-foreground');
                if (foregroundElement !== undefined) {
                    foregroundElement = angular.element(foregroundElement);
                }
                return foregroundElement;
            }
        };

        // Expands the start of the task to the specified position (in em)
        // The override uses moment.startOf() to always align the beginning of a task with beginning of
        // the current change unit. The angular-gantt version is a mess.
        Task.prototype.setFrom = function(x, magnetEnabled) {
            this.model.from = this.rowsManager.gantt.getDateByPosition(x, false);
            if (magnetEnabled) {
                this.model.from = this.model.from.startOf(this.rowsManager.gantt.columnMagnetUnit);
            }
            this.row.setFromTo();
            this.updatePosAndSize();
        };

        // Expands the end of the task to the specified position (in em)
        // The override uses moment.endOf() to always align the end of a task with the end of the
        // current change unit.
        Task.prototype.setTo = function(x, magnetEnabled) {
            this.model.to = this.rowsManager.gantt.getDateByPosition(x, false);
            if (magnetEnabled) {
                this.model.to = this.model.to.endOf(this.rowsManager.gantt.columnMagnetUnit);
            }
            this.row.setFromTo();
            this.updatePosAndSize();
        };

        // Moves the task to the specified position (in em)
        // The override uses moment.startOf() to always align the beginning of a task with beginning of
        // the current change unit, when moved.
        Task.prototype.moveTo = function(x, magnetEnabled) {
            var newTaskRight;
            var newTaskLeft;

            this.model.from = this.rowsManager.gantt.getDateByPosition(x, false);
            if (magnetEnabled) {
                this.model.from = this.model.from.startOf(this.rowsManager.gantt.columnMagnetUnit);
            }
            newTaskLeft = this.rowsManager.gantt.getPositionByDate(this.model.from);
            newTaskRight = newTaskLeft + this.modelWidth;
            this.model.to = this.rowsManager.gantt.getDateByPosition(newTaskRight, false);

            this.row.setFromTo();
            this.updatePosAndSize();
        };

        // Override the moveTo method on the Task type to be able to properly detect when a task is being moved
        // this is a workaround for a limitation in `angular-gantt-plugins`. The problem is that a task is
        // moved before the event `moveBegin` is raised. This makes it impossible to know the original state,
        // and to save this undo information. An alternative would be to store undo information for all tasks
        // always, but this would be much more work and possibly be yet another performance load.
        // Note: This around-advice-construction doesn't use any public API of angular-gantt and may not
        // be compatible with future versions of the library.
        Task.prototype.moveTo = (function(originalFn) {
            return function(x, magnetEnabled) {
                var task = this;
                if (moveToCallbackFn) {
                    moveToCallbackFn.call(moveToCallbackFnThis, task.model);
                }
                originalFn.call(task, x, magnetEnabled);
            };
        })(Task.prototype.moveTo);

        Task.prototype.clone = function() {
            return new Task(this.row, angular.copy(this.model));
        };

        return Task;
    }]);
}());

