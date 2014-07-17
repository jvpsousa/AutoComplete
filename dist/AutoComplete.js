(function(angular) {
	var module = angular.module('net.enzey.autocomplete', ['ngSanitize']);

	var controllerName = 'nzCtrl';
	var defaultTemplateUrl = 'AutoComplete/hintTemplate.html';
	module.run(function($templateCache) {
		var defaultTemplate = '<div nz-auto-complete-hint-text></div>';
		$templateCache.put(defaultTemplateUrl, defaultTemplate);
	});

	module.directive('nzReturnModelCtrl', function($parse) {
		return {
			restrict: 'A',
			require: '?ngModel',
			compile: function($element, $attrs) {
				var myName = this.name;
				var myDataName = 'data' + myName[0].toUpperCase() + myName.slice(1);

				return {
					pre: function (scope, element, attr, modelCtrl) {
						if (attr.$attr[myName]) {
							$parse(attr[myName]).assign(scope, modelCtrl);
						} else if (attr.$attr[myDataName]) {
							$parse(attr[myDataName]).assign(scope, modelCtrl);
						} else {
							throw 'location to return the model controller is required.';
						}
					}
				};
			}
		};
	});

	module.directive('nzAutoCompleteHintText', function($parse) {
		return {
			restrict: 'AE',
			link: {
				post: function(scope, element, attrs) {
					var inputText = scope[controllerName].$viewValue;
					var hintText = scope.displayPath === null ? 'hint' : 'hint.' + scope.displayPath;
					var highlightRegExp =  new RegExp('(' + inputText +  ')', 'gi');
					var text = $parse(hintText)(scope);
					if (text) {
						var markedText = text.replace(highlightRegExp, '<mark>$1</mark>');

						element[0].innerHTML = markedText;
					}
				}
			}
		};
	});

	module.directive('nzAutoCompleteInclude', function($compile, $http, $templateCache) {
		return {
			restrict: 'AE',
			link: function (scope, element, attr) {
				$http.get(attr.nzAutoCompleteInclude, {cache: $templateCache})
				.success(function(html) {
					element.replaceWith($compile(html)(scope));
				});
			}
		};
	});

	var positionAndAddScrollBar = function(hintList, inputElem) {
		hintList.css('display', 'block');
		var scroller = hintList.find('div')[0];
		if (scroller.scrollHeight > scroller.clientHeight) {
			angular.element(scroller).css('overflow-y', 'scroll');
		} else {
			angular.element(scroller).css('overflow-y', '');
		}
		hintList.css('display', '');
	};

	module.directive('nzAutoComplete', function($parse, $timeout) {
		return {
			scope: {},
			restrict: 'AE',
			template: function(element, attr) {
				element.addClass('autoComplete');

				var inputElem = element[0].querySelector('input');
				if (inputElem) {
					inputElem = angular.element(inputElem);
				} else {
					inputElem = angular.element('<input type="text"></input>');
				}
				inputElem.removeAttr('ng-model');
				inputElem.removeAttr('data-ng-model');
				var hintInputElem = inputElem.clone();

				inputElem.addClass('textEntry');
				inputElem.attr('nz-return-model-ctrl', controllerName);
				hintInputElem.addClass('hintBox');
				hintInputElem.attr('tabindex', '-1');
				hintInputElem.removeAttr('placeholder');

				var wrapper = angular.element('<div></div>');
				wrapper.append(hintInputElem);
				wrapper.append(angular.element('<iframe></iframe>'));
				wrapper.append(inputElem);
				wrapper.append(angular.element('<div class="loadingIndicator"></div>'));

				element.empty();
				return wrapper[0].innerHTML;
			},
			compile: function ($element, $attrs) {
				var inputElem =     angular.element($element[0].querySelector('.textEntry'));
				var hintInputElem = angular.element($element[0].querySelector('.hintBox'));

				var ngModelName = '$parent.' + $attrs.ngModel;
				inputElem.attr('ng-model', ngModelName);

				var templateUrl = angular.isDefined($attrs.templateUrl) ? $attrs.templateUrl : defaultTemplateUrl;
				var hintList = angular.element('\
					<div class="scrollerContainer">\
						<iframe></iframe>\
						<div class="scroller" ng-hide="hints.length < 2">\
							<div class="hint"\
									ng-repeat="hint in hints"\
									ng-click="select($index)"\
									ng-mouseover="hoverOver($index)"\
									ng-class="{selectedHint: $index === selectedHintIndex}">\
								<div nz-auto-complete-include="' + templateUrl + '"></div>\
							</div>\
						</div>\
						<div class="scroller noResults">\
							<span class="noResults hint">{{noResultsText}}</span>\
						</div>\
					</div>\
				');
				$element.append(hintList);

				var displayHint = false;
				return {
					pre: function(scope, element, attrs) {
						scope.hints = [];

						scope.displayPath = null;
						if (angular.isDefined(attrs.displayPath)) {
							scope.displayPath = attrs.displayPath;
						}

						scope.noResultsText = "No Results";
						if (angular.isDefined(attrs.noResultsText)) {
							scope.noResultsText = attrs.noResultsText;
						}

						scope.hoverOver = function(selectedIndex) {
							scope.selectRow(selectedIndex);
						};

						scope.getHintDisplay = function() {
							var hintDisplayObj = scope.hints[scope.selectedHintIndex];
							if (scope.displayPath !== null) {
								return $parse(scope.displayPath)(hintDisplayObj);
							}
							return hintDisplayObj;
						};
						scope.selectRow = function(index) {
							if (index === scope.selectedHintIndex) {return;}

							if (0 <= index && index < scope.hints.length) {
								var scroller = element[0].querySelector('.scroller');
								var hints =   angular.element(scroller).children();

								$timeout(function() {
									hintList.css('display', 'block');
									var selectedHint = scroller.querySelector('.selectedHint');
									if (selectedHint.offsetTop < scroller.scrollTop) {
										// scrollUp
										scroller.scrollTop = selectedHint.offsetTop;
									} else if (selectedHint.offsetTop + selectedHint.clientHeight > scroller.scrollTop + scroller.clientHeight) {
										// scrollDown
										scroller.scrollTop = selectedHint.offsetTop + selectedHint.clientHeight - scroller.clientHeight;
									}
									hintList.css('display', '');
								}, 0, false);

								scope.selectedHintIndex = index;
								if (displayHint === true) {
									var hintDisplayText = scope.getHintDisplay();
									var userInputString = inputElem.val();
									hintInputElem.val(userInputString + hintDisplayText.slice(userInputString.length, hintDisplayText.length));
								}
							}
						};

						/*
						positionHintsFn = function(hintList, inputElem) {
							$(hintList).position({
								my: "left top",
								at: "left bottom",
								of: inputElem,
								collision: 'flip'
							});
						}
						*/
						scope.positionHintsFn = function(){};
						if (angular.isDefined(attrs.positionHintsFn)) {
							var customPositionFunction = $parse(attrs.positionHintsFn)(scope.$parent);
							if (angular.isFunction(customPositionFunction)) {
								scope.positionHintsFn = customPositionFunction;
							}
						}

					},
					post: function (scope, element, attrs) {
						var modelCtrl = scope[controllerName];

						var displaySuggestions = function(hintResults) {
							scope.hints = hintResults;
							if (!scope.hints) {scope.hints = [];}

							if (scope.hints.length > 0) {
								var regex = new RegExp('^' + modelCtrl.$viewValue, 'i');
								var objParser = null;
								if (scope.displayPath !== null) {
									objParser = $parse(scope.displayPath);
								}
								scope.hints.forEach(function(hintObj) {
									if (!displayHint) {return;}

									if (objParser) {
										displayHint = displayHint && regex.test(objParser(hintObj));
									} else {
										displayHint = displayHint && regex.test(hintObj);
									}
								});
								scope.selectRow(0);
							} else {
								element.addClass('noResults');
							}

							$timeout(function() {
								if (!scope.positionHintsFn(hintList, inputElem)) {
									positionAndAddScrollBar(hintList, inputElem);
								}
							}, 0, false);

						};

						var getResultsFn = $parse(attrs.getResultsFn)(scope.$parent);
						if (!getResultsFn || !typeof getResultsFn === 'function') {
							throw 'A function that returns results is required!';
						}
						var pendingResultsFunctionCall;
						var getResults = function() {
							displayHint = inputElem[0].scrollWidth <= inputElem[0].clientWidth;
							//setParentModel();

							scope.selectedHintIndex = null;
							scope.hints = [];
							element.addClass('loading');
							element.removeClass('noResults');
							// Stop any pending requests

							$timeout.cancel(pendingResultsFunctionCall);

							if (angular.isDefined(modelCtrl.$viewValue) && minimumChars <= modelCtrl.$viewValue.length) {
								pendingResultsFunctionCall = $timeout(function() {
									element.removeClass('loading');
									getResultsFn( modelCtrl.$viewValue ).then(displaySuggestions);
								}, silentPeriod, true);
							} else {
								element.removeClass('loading');
							}
						};

						scope.select = function(selectedIndex) {
							scope.selectedHintIndex = selectedIndex;
							modelCtrl.$setViewValue(scope.getHintDisplay());
							scope.actualText = modelCtrl.$viewValue;
							inputElem.val(modelCtrl.$viewValue);
							inputElem[0].focus();
						};

						var minimumChars = +$parse(attrs.minChar)(scope.$parent);
						if (isNaN(minimumChars)) {minimumChars = 1;}
						if (minimumChars === 0) {
							if (!modelCtrl.$viewValue) {
								modelCtrl.$setViewValue('');
							}
							getResults();
						}

						var silentPeriod = +$parse(attrs.silentPeriod)(scope.$parent);
						if (isNaN(silentPeriod)) {silentPeriod = 250;}

						var isSelectionRequired = false;
						if (angular.isDefined(attrs.selectionRequired) && attrs.selectionRequired === 'true') {
							isSelectionRequired = true;
						}

						modelCtrl.$parsers.push(function(value) {
							hintInputElem.val('');
							if (value) {
								var result;
								if (isSelectionRequired) {
									var selectedObj = scope.hints[scope.selectedHintIndex];
									if (scope.hints && scope.hints.length > 0 &&
									( value === selectedObj || value === $parse(scope.displayPath)(selectedObj) ) ) {
										result = selectedObj;
									}
								} else {
									if (minimumChars <= value.length) {
										result = value;
									}
								}
								if (!result) {
									modelCtrl.$setValidity('hasSelection', false);
								}
							}
							getResults();
							return result;
						});
						modelCtrl.$formatters.push(function(value) {
							$timeout(getResults, 0, true);
							hintInputElem.val('');
							if (!value) {return;}
							var result;
							if (scope.displayPath) {
								result = $parse(scope.displayPath)(value);
							} else {
								result = value;
							}
							return result;
						});

						inputElem.bind("focus", function() {
							if (scope.hints && scope.hints.length > 0) {
								$timeout(function() {
									scope.positionHintsFn(hintList, inputElem);
								}, 0, false);
							}
						});

						inputElem.bind("keydown", function(e) {
							if (scope.selectedHintIndex !== null && (e.keyCode === 13 || e.keyCode === 9)) {
								var selectedObj = scope.hints[scope.selectedHintIndex];
								$parse(ngModelName).assign(scope, selectedObj);
								scope.$apply();
							} else if (e.keyCode === 40) {
								// key down
								if (scope.selectedHintIndex !== null && scope.hints.length > 1) {
									var newIndex;
									if (scope.selectedHintIndex === scope.hints.length - 1) {
										newIndex = 0;
									} else {
										newIndex = scope.selectedHintIndex + 1;
									}
									scope.selectRow(newIndex);
									scope.$apply();
								}
								e.preventDefault();
								e.stopPropagation();
							} else if (e.keyCode === 38) {
								// key up
								if (scope.selectedHintIndex !== null && scope.hints.length > 1) {
									var newIndex;
									if (scope.selectedHintIndex === 0) {
										newIndex = scope.hints.length - 1;
									} else {
										newIndex = scope.selectedHintIndex - 1;
									}
									scope.selectRow(newIndex);
									scope.$apply();
								}
								e.preventDefault();
								e.stopPropagation();
							}
						});

					}
				}
			}
		};
	});

})(angular);