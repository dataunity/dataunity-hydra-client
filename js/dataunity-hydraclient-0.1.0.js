// Create a module for adding new routes to extend Hydra App. The routes
// allow Hydra Class and Hydra SupportedOperation combinations to be 
// routed to a different view rather than the detault option from the
// Hydra client
(function () {

    // Inspired by: http://weblogs.asp.net/dwahlin/dynamically-loading-controllers-and-views-with-angularjs-and-requirejs
    var routeResolver = function () {

        this.$get = function () {
            return this;
        };

        this.routeConfig = function () {
            var templates = {},
                controllers = {},
                paths = [],
                pathToView = {},
                viewToPath = {},

            getKey = function (classIRI, suppOpIRI) {
                return classIRI + " " + suppOpIRI;
            },

            getPaths = function () {
                return paths;
            },

            getPath = function (classIRI, suppOpIRI) {
                var path = viewToPath[getKey(classIRI, suppOpIRI)];
                if (typeof path === 'undefined') {
                    path = null;
                }
                return path;
            },

            getViewDetails = function (path) {
                return pathToView[path];
            },

            // Gets a template matching the Hydra Class and Supported
            // Operation combination, otherwise returns null if
            // template doesn't exist.
            getTemplate = function (classIRI, suppOpIRI) {
                var template = templates[getKey(classIRI, suppOpIRI)];
                if (typeof template === 'undefined') {
                    template = null;
                }
                return template;
            },

            // Gets a controller matching the Hydra Class and Supported
            // Operation combination, otherwise returns null if
            // controller doesn't exist.
            getController = function (classIRI, suppOpIRI) {
                var controller = controllers[getKey(classIRI, suppOpIRI)];
                if (typeof controller === 'undefined') {
                    controller = null;
                }
                return controller;
            },

            // Registers a view to be called when a certain Hydra Class and 
            // Supported Operation combination occurs. 
            registerView = function (options) {
                var path = options.path, 
                    classIRI = options.suppClassIRI, 
                    suppOpIRI = options.suppOpIRI, 
                    template = options.template, 
                    controller = options.controller,
                    viewKey = getKey(classIRI, suppOpIRI);
                paths.push(path);
                pathToView[path] = [classIRI, suppOpIRI];
                viewToPath[viewKey] = path;
                templates[viewKey] = template;
                controllers[viewKey] = controller;
            };

            return {
                getPaths: getPaths,
                getPath: getPath,
                getViewDetails: getViewDetails,
                registerView: registerView,
                getTemplate: getTemplate,
                getController: getController
            };
        }();

        this.route = function (routeConfig) {

            var resolve = function (classIRI, suppOpIRI) {
                    var routeDef = {};
                    routeDef.template = routeConfig.getTemplate(classIRI, suppOpIRI);
                    routeDef.controller = routeConfig.getController(classIRI, suppOpIRI);
                    return routeDef;
                },

                resolveFromPath = function (path) {
                    var viewDetails = routeConfig.getViewDetails(path),
                        classIRI = viewDetails[0],
                        suppOpIRI = viewDetails[1];
                    return resolve(classIRI, suppOpIRI);
                };

            return {
                resolveFromPath: resolveFromPath
            }
        }(this.routeConfig);

    };

    var servicesApp = angular.module('duRouteResolverService', []);

    //Must be a provider since it will be injected into module.config()    
    servicesApp.provider('routeResolver', routeResolver);
}());

// This config module can be used to define additional routes through
// the route resolve service.
angular.module('duConfig', ['duRouteResolverService'])

    // Configure the entry point
    .provider('entryPoint', function () {
        this.entryPointIRI = null;

        this.$get = function () {
            return this;
        };

        this.getEntryPoint = function () {
            if (this.entryPointIRI == null) {
                throw "Hydra Entry Point IRI must be supplied in config."
            }
            return this.entryPointIRI;
        };

        this.setEntryPoint = function (entryPointIRI) {
            this.entryPointIRI = entryPointIRI;
        };
    });

angular.module('duHydraClient', ['ngRoute', 'duConfig', 'duRouteResolverService'])

    .config(['$routeProvider', 'entryPointProvider', 'routeResolverProvider', 
        function($routeProvider, entryPointProvider, routeResolverProvider) {
        var route = routeResolverProvider.route;

        $routeProvider
            // Route for item view
            .when('/view/:iri*', {
                template: '<div ng-init="load()"> \
                <h2>{{title}}</h2> \
                <du-item ng-repeat="item in pageItems"></du-item> \
                </div>',
                controller: 'ItemViewCtrl'
            })
            // Route for collection view
            .when('/collection/:iri*', {
                template: '<div ng-init="load()"> \
                <h2>Title: {{title}}</h2> \
                <div ng-repeat="member in members" class="du-member"> \
                    <du-item ng-repeat="item in member.pageItems"></du-item> \
                </div> \
                </div>',
                controller: 'CollectionCtrl'
            })
            // Route for form view
            .when('/form/:formId*', {
                template: '<div ng-init="load()"> \
                <h2>Form: {{title}}</h2> \
                <ng-form name="du-form-hydra" action="{{formURL}}" method="{{formMethod}}"> \
                    <div ng-repeat="suppProp in hydraForm.data.fields"> \
                        <input ng-if="suppProp._hidden" \
                            name="{{getSupportedPropertyPropertyId(suppProp)}}" \
                            type="hidden" \
                            data-ng-model="suppProp.data" \
                            value="{{getSupportedPropertyValue(suppProp)}}"> \
                        <div ng-if="!suppProp._hidden"> \
                            <label for="{{getSupportedPropertyPropertyId(suppProp)}}"> \
                                {{getSupportedPropertyLabel(suppProp)}} \
                            </label> \
                            <input ng-if="!suppProp._hasChoice" \
                                name="{{getSupportedPropertyPropertyId(suppProp)}}" \
                                type="text" \
                                data-ng-model="suppProp.data" \
                                value="{{getSupportedPropertyValue(suppProp)}}"> \
                            <select ng-if="suppProp._hasChoice" \
                                name="{{getSupportedPropertyPropertyId(suppProp)}}" \
                                type="text" \
                                data-ng-model="suppProp.data" \
                                ng-options="color.name for color in suppProp._choices" \
                                value="{{getSupportedPropertyValue(suppProp)}}"> \
                            </select> \
                        </div> \
                    </div> \
                    <du-item ng-repeat="item in formItems"></du-item> \
                    <div><button ng-click="submitForm()">Add</button></div> \
                    <div du-form-feedback></div> \
                </ng-form> \
                </div>',
                controller: 'FormCtrl'
            })
            // Homepage
            .when('/', {
                redirectTo: '/view/' + encodeURIComponent(entryPointProvider.getEntryPoint())
            });
            // ToDo: redirect to 404
            // .otherwise({
            //     redirectTo: '/view/http%3A%2F%2F0.0.0.0%3A6543%2Fhydra%2Fentrypoint'
            // });

        // Register any user defined routes
        var customPaths = routeResolverProvider.routeConfig.getPaths();
        angular.forEach(customPaths, function (path) {
            $routeProvider.when(path, route.resolveFromPath(path));
        });
    }])

    .factory('hydraNs', function() {
        // Hydra namespace
        var hydraBase = 'http://www.w3.org/ns/hydra/core#';
        return {
            _base: hydraBase,
            supportedClass: hydraBase + "supportedClass",
            supportedProperty: hydraBase + "supportedProperty",
            supportedOperation: hydraBase + "supportedOperation",
            operation: hydraBase + "operation",
            property: hydraBase + "property",
            title: hydraBase + "title",
            method: hydraBase + "method",
            expects: hydraBase + "expects",
            Link: hydraBase + "Link",
            Class: hydraBase + "Class",
            returns: hydraBase + "returns",
            Collection: hydraBase + "Collection",
            PagedCollection: hydraBase + "PagedCollection",
            member: hydraBase + "member"
        };
    })

    .factory('hydraExtNs', function() {
        // Data Unity Hydra extensions namespace
        var hydraBase = 'http://dataunity.org/ns/hydra-ext#';
        return {
            _base: hydraBase,
            valuesConstraint: hydraBase + "valuesConstraint",
            valuesPagedCollection: hydraBase + "valuesPagedCollection",
            memberValueProperty: hydraBase + "memberValueProperty",
            memberLabelProperty: hydraBase + "memberLabelProperty",
            possibleValue: hydraBase + "possibleValue",
            value: hydraBase + "value"
        };
    })

    .factory('rdfNs', function() {
        // RDF namespace
        var rdfBase = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
        return {
            Property: rdfBase + "Property"
        };
    })

    .factory('rdfsNs', function() {
        // RDFS namespace
        var rdfsBase = 'http://www.w3.org/2000/01/rdf-schema#';
        return {
            label: rdfsBase + "label"
        };
    })

    .factory('jsonldLib', function () {
        // JSON-LD namespace
        // A simple wrapper for the jsonld library dependency
        return jsonld;
    })

    // Helper for JSON-LD
    .factory('jsonldHelper', ['jsonldLib', function (jsonldLib) {
            // Gets the first value in subject which matches property
        var getValue = function (subject, property, defaultVal) {
                var vals = jsonldLib.getValues(subject, property),
                    val = null,
                    defaultValue = null;
                if (typeof defaultVal !== 'undefined') {
                    defaultValue = defaultVal;
                }
                if (vals.length < 1) {
                    return defaultValue;
                }
                val = vals[0];
                return val;
            },

            // Gets a literal value from subject using the property
            getLiteralValue = function (subject, property, defaultVal) {
                var val = getValue(subject, property, defaultVal);
                if (val && typeof val === 'object' && jsonldLib.hasProperty(val, "@value")) {
                    val = val["@value"]
                }
                return val;
            },

            // Gets the JSON-LD @id from an object
            hasId = function (idObj) {
                var idObject = angular.isArray(idObj) ? idObj[0] : idObj;
                return typeof idObject["@id"] !== 'undefined';
            },

            // Gets the JSON-LD @id from an object
            getIdValue = function (idObj) {
                var idObject = angular.isArray(idObj) ? idObj[0] : idObj,
                    vals = jsonldLib.getValues(idObject, "@id");
                if (vals.length !== 1) {
                    throw "Expected one value for id object, instead got " + String(vals.length);
                }
                return vals[0];
            },

            // Checks whether obj has JSON-LD value (@value)
            isValue = function (val) {
                var toCheck = val;
                if (angular.isArray(val) && val.length === 1) {
                    toCheck = val[0];
                }
                return "@value" in toCheck;
            },

            // Removes the JSON array wrapper that JSON-LD processor puts
            // around JSON results
            removeJSONArray = function (obj) {
                return angular.isArray(obj) ? obj[0] : obj;
            };
        return {
            getValue: getValue,
            getLiteralValue: getLiteralValue,
            getIdValue: getIdValue,
            hasId: hasId,
            isValue: isValue,
            removeJSONArray: removeJSONArray
        }
    }])

    // Helper for Hydra API Documentation
    .factory('apiDocHelper', ['rdfsNs', 'hydraNs', 'jsonldHelper', function (rdfsNs, hydraNs, jsonldHelper) {

        var getProperty = function (suppProp) {
                // Gets the property from a SupportedProperty.
                // The JSON-LD must be expanded.
                return angular.isArray(suppProp[hydraNs.property]) ? suppProp[hydraNs.property][0] : suppProp[hydraNs.property];
            },

            // Finds the specified Hydra SupportedClass in the API Documentation
            findSupportedClass = function (apiDoc, classType) {
                var apiDocClass = null,
                    supportedClasses = apiDoc[hydraNs.supportedClass],
                    typesToCheck;

                // Note: slightly inefficient as it doesn't break
                // when item found, but easier to read
                if (supportedClasses) {
                    angular.forEach(supportedClasses, function (cls) {
                        typesToCheck = angular.isArray(classType) ? classType : [classType];
                        angular.forEach(typesToCheck, function (singleHydraCls) {
                            if (cls["@id"] === singleHydraCls) {
                                apiDocClass = cls;
                            }
                        });
                    });
                }

                return apiDocClass;
            },

            // Finds the SupportedProperty in given SupportedClass
            findSupportedPropertyInClass = function (cls, propType) {
                var apiDocSuppProp = null,
                    suppProps = cls[hydraNs.supportedProperty],
                    typesToCheck;

                if (suppProps) {
                    angular.forEach(suppProps, function (suppProp) {
                        typesToCheck = angular.isArray(propType) ? propType : [propType];
                        prop = getProperty(suppProp);
                        if (prop == null) {
                            throw "Couldn't find property for SupportedProperty in SupportedClass " +
                                String(cls["@id"]) + ". Check all SupportedProperty items have " +
                                "a 'property' property."
                        }
                        angular.forEach(typesToCheck, function (singlePropType) {
                            if (prop["@id"] === singlePropType) {
                                apiDocSuppProp = suppProp;
                            }
                        });
                    });
                }

                return apiDocSuppProp;
            },       

            // Finds the SupportedProperty across all classes in API Documentation
            findSupportedProperty = function (apiDoc, classType, propType) {
                var apiDocSuppProp = null,
                    suppClasses = apiDoc[hydraNs.supportedClass],
                    classTypesToCheck;

                // Note: slightly inefficient as it doesn't break
                // when item found, but easier to read
                if (suppClasses) {
                    angular.forEach(suppClasses, function (cls) {
                        classTypesToCheck = angular.isArray(classType) ? classType : [classType];
                        angular.forEach(classTypesToCheck, function (singleHydraCls) {
                            if (cls["@id"] === singleHydraCls) {
                                // Right class, check supported properties
                                suppProp = findSupportedPropertyInClass(cls, propType);
                                if (suppProp != null) {
                                    apiDocSuppProp = suppProp;
                                }
                            }
                        });
                    });
                }

                return apiDocSuppProp;
            },
            getSupportedPropertyLabel = function (suppProp) {
                var label = jsonldHelper.getLiteralValue(suppProp, hydraNs.title),
                    prop = null;

                if (typeof label === 'undefined' || label == null) {
                    var prop = getProperty(suppProp);
                    if (prop == null) {
                        label = "Untitled";
                    } else {
                        label = jsonldHelper.getLiteralValue(prop, rdfsNs.label);
                    }
                }
                return label;
            };

        return {
            getProperty: getProperty,
            findSupportedClass: findSupportedClass,
            findSupportedProperty: findSupportedProperty,
            getSupportedPropertyLabel: getSupportedPropertyLabel
        }
    }])

    // Hydra helper
    .service('hydraHelper', ['jsonldLib', 'jsonldHelper', 'hydraNs', 'apiDocHelper',
        function (jsonldLib, jsonldHelper, hydraNs, apiDocHelper) {

        // Gets the first hydra type from a list of RDF types
        this.hydraType = function (types) {

            if (typeof types === 'undefined' || types == null) {
                return null;
            }
            
            var i;
            for (i = 0; i < types.length; i++) {
                if (types[i].toLowerCase().search(hydraNs["_base"]) !== -1) {
                    return types[i];
                }
            }
            return null;
        };

        this.getSupportedOperation = function (prop, method) {
            var suppOps = jsonldLib.getValues(prop, hydraNs.supportedOperation),
                suppOp = null,
                tmpSuppOp = null,
                tmpMethod = "",
                index = 0;
            if (suppOps) {
                for (index = 0; index < suppOps.length; index++) {
                    tmpSuppOp = suppOps[index];
                    tmpMethod = jsonldHelper.getLiteralValue(tmpSuppOp, hydraNs.method);
                    if (tmpMethod === method) {
                        suppOp = tmpSuppOp;
                        break;
                    }
                }
            }
            return suppOp;
        };

        // Whether the hydra:property has the operation method
        this.hasOperationMethod = function (prop, method) {
            var suppOp = this.getSupportedOperation(prop, method);
            return suppOp ? true : false;
        };

        // Whether the hydra opertation returns a collection
        this.operationReturnsCollection = function (prop, method) {
            var suppOp = this.getSupportedOperation(prop, method),
                isCollection = false,
                returnsTypes, tmp;
            if (!suppOp) {
                return false;
            }
            returnsTypes = jsonldLib.getValues(suppOp, hydraNs.returns);
            angular.forEach(returnsTypes, function (returnType) {
                tmp = jsonldHelper.getIdValue(returnType);
                if (tmp === hydraNs.Collection || tmp === hydraNs.PagedCollection) {
                    isCollection = true;
                }
            })
            return isCollection;
        };
    }])

    .factory('apiResources', ['$http', '$log', '$q',
        function($http, $log, $q) {
        // Dependencies
        var jsonLd = jsonld,
            jsonldPromises = jsonld.promises();
        return {
            getResource: function(iri) {
                var deferred = $q.defer();
                $http.get(iri, {headers: {"Accept": "application/json"}})
                    .success(function(data) {
                        // Expand the context
                        jsonldPromises.expand(data)
                            .then(function (expanded) {
                                // ToDo: find API Doc from entry point context
                                // See: http://lists.w3.org/Archives/Public/public-hydra/2014May/0003.html
                                // "you would reference the API documentation via an HTTP Link header"
                                deferred.resolve({
                                    data: expanded, 
                                    apiDocURL: '/hydra/api-doc'});
                            }, 
                            function (err) {
                                deferred.reject("There was an error expanding the Resource data: " + err.name + " " + err.message);
                                $log.error("There was an error expanding the Resource data: " + err.name + " " + err.message);
                            });
                    }).error(function(msg, code) {
                        deferred.reject(msg);
                        $log.error(msg, code);
                    });
                return deferred.promise;
            },
            getResourceNonExpanded: function(iri) {
                var deferred = $q.defer();
                $http.get(iri, {headers: {"Accept": "application/json"}})
                    .success(function(data) {
                        // Expand the context
                        // ToDo: find API Doc from entry point context
                        // See: http://lists.w3.org/Archives/Public/public-hydra/2014May/0003.html
                        // "you would reference the API documentation via an HTTP Link header"
                        deferred.resolve({
                            data: data, 
                            apiDocURL: '/hydra/api-doc'});
                    }).error(function(msg, code) {
                        deferred.reject(msg);
                        $log.error(msg, code);
                    });
                return deferred.promise;
            },
            getAPIDoc: function(iri) {
                var deferred = $q.defer();
                $http.get(iri, {headers: {"Accept": "application/json"}})
                    .success(function(data) {
                        // Expand the context
                        jsonldPromises.expand(data)
                            .then(function (expanded) {
                                deferred.resolve(expanded);
                            }, 
                            function (err) {
                                deferred.reject("There was an error expanding the API Documentation data: " + err.name + " " + err.message);
                                $log.error("There was an error expanding the API Documentation data: " + err.name + " " + err.message);
                            });
                    }).error(function(msg, code) {
                        deferred.reject(msg);
                        $log.error(msg, code);
                    });
                return deferred.promise;
            }
        }
    }])

    .factory('formStore', function () {
        // Store temp detail for making a form
        var formData = {},
            saveFormData = function (method, url, data, suppClass) {
                var id = method + "_" + url + "_" + suppClass["@id"];
                formData[id] = {
                    method: method,
                    url: url,
                    data: data,
                    suppClass: suppClass
                };
                return id;
            },
            getFormData = function (id) {
                return formData[id];
            };

        return {
            saveFormData: saveFormData,
            getFormData: getFormData
        }
    })

    .factory('pageBuilder', ['jsonldLib', 'jsonldHelper', 'hydraNs', 'apiDocHelper', 'hydraHelper', 'routeResolver', 'formStore', 
        function (jsonldLib, jsonldHelper, hydraNs, apiDocHelper, hydraHelper, routeResolver, formStore) {

        var saveForm = function (apiDoc, suppOp, method, formURL, formData) {
            // Saves the form details to pass to form page
            var payloadTypes = [],
                payloadClass = null,
                index = 0;

            // Lookup the hydra:Class which provides the form details
            payloadTypes = jsonldLib.getValues(suppOp, hydraNs.expects);
            if (payloadTypes.length === 0) {
                throw "Couldn't determine type of form to create from looking at hydra 'expects' property in API Doc";
            }
            if (payloadTypes) {
                for (index = 0; index < payloadTypes.length; index++) {
                    if (typeof payloadTypes[index]["@id"] !== 'undefined') {
                        payloadTypes[index] = jsonldHelper.getIdValue(payloadTypes[index]);
                    }
                }
            }
            payloadClass = apiDocHelper.findSupportedClass(apiDoc, payloadTypes);
            if (payloadClass == null || typeof payloadClass === 'undefined') {
                throw "Could not find form's Hydra API class for " + String(payloadTypes);
            }

            var savedFormId = formStore.saveFormData(method, formURL, formData, payloadClass);
            return savedFormId;
        },

        addPageItems = function (pageItemCollection, pageData, apiDoc, pageTypes) {
            // pageItemCollection is the collection that will be added to
            var suppProp, prop, pageItemValue;
            angular.forEach(pageData, function (value, key) {
                if (key.indexOf("@") === 0) {
                    return;
                } else {
                    suppProp = apiDocHelper.findSupportedProperty(apiDoc, pageTypes, key);
                    if (suppProp == null) {
                        throw "Could not find SupportedProperty " + String(key) + 
                            " in SupportedClass " + String(pageTypes);
                    }
                    prop = apiDocHelper.getProperty(suppProp);

                    if (jsonldHelper.isValue(value)) {
                        value = angular.isArray(value) && value.length > 0 ? value[0] : value;
                        pageItemValue = jsonldHelper.getLiteralValue(value, "@value");
                    } else {
                        pageItemValue = jsonldHelper.getIdValue(value);
                    }
                    
                    var propTypes = prop["@type"];
                    var pageItemType = hydraHelper.hydraType(propTypes);
                    if (pageItemType == null) {
                        // No specific hydra type, like Link. Try other types
                        if (propTypes && angular.isArray(propTypes) && propTypes.length > 0) {
                            pageItemType = propTypes[0];
                        }
                    }

                    var suppClass = pageTypes[0];

                    pageItemCollection.push({
                        "type": pageItemType,
                        "value": pageItemValue,
                        "prop": prop,
                        "suppProp": suppProp,
                        "suppClass": suppClass
                    });
                }
            });
        },

        // Determines the link for the pageItem
        pageItemLink = function (pageItem) {
            var suppClass = pageItem.suppClass,
                getPath = routeResolver.routeConfig.getPath,
                suppOp, routePath;
            // ToDo: this needs refactorting so more than one
            // GET SuppOp can be handled
            if (hydraHelper.hasOperationMethod(pageItem.prop, "GET")) {
                // HTTP GET
                suppOp = hydraHelper.getSupportedOperation(pageItem.prop, "GET");
                routePath = getPath(suppClass, suppOp["@id"]);
                if (routePath != null) {
                    // User defined view for this SupportedClass and SupportedOp
                    // Bit of a hack to insert target IRI
                    return "#" + routePath.replace(":iri*", encodeURIComponent(pageItem.value));
                } else if (hydraHelper.operationReturnsCollection(pageItem.prop, "GET")) {
                    return "#/collection/" + encodeURIComponent(pageItem.value);
                } else {
                    return "#/view/" + encodeURIComponent(pageItem.value);
                }
            } else {
                throw "Only GET requests supported here.";
            }
        },

        // Determines the text to use for a pageItem link
        pageItemLinkText = function (pageItem) {
            if (hydraHelper.hasOperationMethod(pageItem.prop, "GET")) {
                // HTTP GET
                return "Go";
            } else if (hydraHelper.hasOperationMethod(pageItem.prop, "POST")) {
                // HTTP POST
                return "Create";
            } else {
                throw "Unknown Link type";
            }
        };

        return {
            saveForm: saveForm,
            addPageItems: addPageItems,
            pageItemLink: pageItemLink,
            pageItemLinkText: pageItemLinkText
        }
    }])


    // ---------------------
    // Directives
    // ---------------------

    .directive('duFormFeedback', function() {
        return {
            template: '{{formFeedback}}'
        };
    })

    .directive('duItem', ['$compile', 'rdfNs', 'rdfsNs', 'hydraNs', 
        function ($compile, rdfNs, rdfsNs, hydraNs) {
        var getTemplate = function (hydraType) {
            var template;

            if (hydraType === hydraNs.Link) {
                // ToDo: find out why rdfsNs.label property stopped working in new Controller
                template = '<div> \
                    {{getSupportedPropertyLabel(item.suppProp)}} \
                    <span ng-if="hasGET(item.prop)"> \
                        <a href="{{hrefURL(item)}}">{{hrefText(item)}}</a> \
                    </span> \
                    <span ng-if="hasPOST(item.prop)"> \
                        <a href="#/form/{{encodeURIComponent(saveForm(\'POST\', item.value, item.prop))}}">Create</a> \
                    </span> \
                    </div>';
            } else if (hydraType === rdfNs.Property) {
                template = '<div>{{item.value}}</div>'
            } else {
                throw "Unrecognised Hydra type " + String(hydraType);
            }

            return template;
        }

        return {
            restrict: 'E',
            link: function(scope, element) {
                var template = getTemplate(scope.item.type);
                element.html(template);
                $compile(element.contents())(scope);
            }
        };
    }])

    .controller('ItemViewCtrl', ['$scope', '$routeParams', 'apiResources', 'jsonldLib', 'jsonldHelper', 
        'rdfsNs', 'hydraNs', 'hydraHelper', 'apiDocHelper', 'pageBuilder',
        function($scope, $routeParams, apiResources, jsonldLib, jsonldHelper, 
            rdfsNs, hydraNs, hydraHelper, apiDocHelper, pageBuilder) {

        $scope.iri = decodeURIComponent($routeParams.iri);

        $scope.pageData = null;
        $scope.apiDoc = null;
        $scope.title = "";
        $scope.pageItems = [];

        $scope.load = function () {
            apiResources.getResource($scope.iri)
                .then(function (results) { 
                    $scope.pageData = results.data;
                    return apiResources.getAPIDoc(results.apiDocURL); })
                .then(function (results) {
                    $scope.apiDoc = results;
                    $scope.updatePage();
                });
        };

        $scope.updatePage = function () {
            var pageData = angular.isArray($scope.pageData) ? $scope.pageData[0] : $scope.pageData,
                pageTypes = jsonldLib.getValues(pageData, "@type"),
                apiDoc = angular.isArray($scope.apiDoc) ? $scope.apiDoc[0] : $scope.apiDoc,
                hydraCls = apiDocHelper.findSupportedClass(apiDoc, pageTypes),
                suppProp, pageItemValue;

            if (hydraCls == null) {
                throw "Could not find Hydra SupportedClass for " + String(pageTypes);
            }

            // Set the page title
            if (typeof hydraCls[rdfsNs.label] !== 'undefined') {
                $scope.title = jsonldHelper.getLiteralValue(hydraCls, rdfsNs.label);
            } else {
                $scope.title = "Untitled";
            }

            pageBuilder.addPageItems($scope.pageItems, pageData, apiDoc, pageTypes);
            //hydraHelper.addPageItems($scope.pageItems, pageData, apiDoc, pageTypes);
        };

        $scope.saveForm = function (method, formURL, prop) {
            // Saves the form details to pass to form page
            var pageData = angular.isArray($scope.pageData) ? $scope.pageData[0] : $scope.pageData,
                apiDoc = angular.isArray($scope.apiDoc) ? $scope.apiDoc[0] : $scope.apiDoc,
                // Find the operation in the property
                suppOp = hydraHelper.getSupportedOperation(prop, method),
                formData = null;

            if (suppOp == null) {
                throw "Can't build form, no supported operation in property with the method '" + method + "'";
            }

            return pageBuilder.saveForm(apiDoc, suppOp, method, formURL, formData);
        };

        $scope.getLiteralValue = function (subject, predicate) {
            return jsonldHelper.getLiteralValue(subject, predicate);
        };

        $scope.getSupportedPropertyLabel = function (suppProp) {
            return apiDocHelper.getSupportedPropertyLabel(suppProp);
        };

        $scope.hasGET = function (prop) {
            // Whether the hydra:property has a GET operation
            return hydraHelper.hasOperationMethod(prop, "GET");
        };
        $scope.hasPOST = function (prop) {
            // Whether the hydra:property has a POST operation
            return hydraHelper.hasOperationMethod(prop, "POST");
        };

        $scope.encodeURIComponent = function (val) {
            return encodeURIComponent(val);
        };

        $scope.hrefURL = function (pageItem) {
            return pageBuilder.pageItemLink(pageItem);
            //return hydraHelper.pageItemLink(pageItem);
        };

        $scope.hrefText = function (pageItem) {
            return pageBuilder.pageItemLinkText(pageItem);
            //return hydraHelper.pageItemLinkText(pageItem);
        };
    }])

    .controller('CollectionCtrl', ['$scope', '$routeParams', 'apiResources', 'jsonldLib', 'jsonldHelper', 
        'rdfsNs', 'hydraNs', 'hydraHelper', 'apiDocHelper', 'pageBuilder',
        function($scope, $routeParams, apiResources, jsonldLib, jsonldHelper, 
            rdfsNs, hydraNs, hydraHelper, apiDocHelper, pageBuilder) {

        $scope.iri = decodeURIComponent($routeParams.iri);

        $scope.pageData = null;
        $scope.apiDoc = null;
        $scope.title = "";
        $scope.members = [];

        $scope.load = function () {
            apiResources.getResource($scope.iri)
                .then(function (results) { 
                    $scope.pageData = results.data;
                    return apiResources.getAPIDoc(results.apiDocURL); })
                .then(function (results) {
                    $scope.apiDoc = results;
                    $scope.updatePage();
                });
        };

        $scope.updatePage = function () {
            var pageData = angular.isArray($scope.pageData) ? $scope.pageData[0] : $scope.pageData,
                membersData = jsonldLib.getValues(pageData, hydraNs.member),
                apiDoc = angular.isArray($scope.apiDoc) ? $scope.apiDoc[0] : $scope.apiDoc,
                suppProp, pageItemValue;

            // ToDo: how to find title for a collection?
            // Set the page title
            // if (typeof hydraCls[rdfsNs.label] !== 'undefined') {
            //     $scope.title = jsonldHelper.getLiteralValue(hydraCls, rdfsNs.label);
            // } else {
            //     $scope.title = "Untitled";
            // }

            angular.forEach(membersData, function (memberData) {
                var pageTypes = jsonldLib.getValues(memberData, "@type"),
                    hydraCls = apiDocHelper.findSupportedClass(apiDoc, pageTypes),
                    member;
                if (hydraCls == null) {
                    throw "Could not find Hydra SupportedClass for " + String(pageTypes);
                }

                // Create member for page collection
                member = { pageItems: [] };
                pageBuilder.addPageItems(member.pageItems, memberData, apiDoc, pageTypes);
                //hydraHelper.addPageItems(member.pageItems, memberData, apiDoc, pageTypes);
                $scope.members.push(member);
            });
        };

        $scope.saveForm = function (method, formURL, prop) {
            // Saves the form details to pass to form page
            var pageData = angular.isArray($scope.pageData) ? $scope.pageData[0] : $scope.pageData,
                apiDoc = angular.isArray($scope.apiDoc) ? $scope.apiDoc[0] : $scope.apiDoc,
                // Find the operation in the property
                suppOp = hydraHelper.getSupportedOperation(prop, method),
                formData = null;

            if (suppOp == null) {
                throw "Can't build form, no supported operation in property with the method '" + method + "'";
            }

            return pageBuilder.saveForm(apiDoc, suppOp, method, formURL, formData);
        };

        $scope.getLiteralValue = function (subject, predicate) {
            return jsonldHelper.getLiteralValue(subject, predicate);
        };

        $scope.getSupportedPropertyLabel = function (suppProp) {
            return apiDocHelper.getSupportedPropertyLabel(suppProp);
        };

        $scope.hasGET = function (prop) {
            // Whether the hydra:property has a GET operation
            return hydraHelper.hasOperationMethod(prop, "GET");
        };
        $scope.hasPOST = function (prop) {
            // Whether the hydra:property has a POST operation
            return hydraHelper.hasOperationMethod(prop, "POST");
        };

        $scope.encodeURIComponent = function (val) {
            return encodeURIComponent(val);
        };

        $scope.hrefURL = function (pageItem) {
            return pageBuilder.pageItemLink(pageItem);
            //return hydraHelper.pageItemLink(pageItem);
        };

        $scope.hrefText = function (pageItem) {
            return pageBuilder.pageItemLinkText(pageItem);
            //return hydraHelper.pageItemLinkText(pageItem);
        };
    }])

    .controller('FormCtrl', ['$scope', '$routeParams', '$http', 'jsonldLib', 'jsonldHelper', 
        'rdfsNs', 'hydraNs', 'hydraExtNs', 'hydraHelper', 'apiDocHelper', 'formStore', 
        'pageBuilder', '$sce', 'apiResources',
        function($scope, $routeParams, $http, jsonldLib, jsonldHelper, 
            rdfsNs, hydraNs, hydraExtNs, hydraHelper, apiDocHelper, formStore, 
            pageBuilder, $sce, apiResources) {

        $scope.formId = $routeParams.formId;

        $scope.formData = null;
        $scope.formMethod = null;
        $scope.formURL = null;
        $scope.suppClass = null;

        $scope.title = "";
        $scope.formItems = [];

        $scope.hydraForm = {};
        $scope.hydraForm.data = {};
        $scope.hydraForm.data.fields = [];

        $scope.resetPage = function () {
            $scope.formItems = [];
            $scope.hydraForm = {};
            $scope.hydraForm.data = {};
            $scope.hydraForm.data.fields = [];
        };

        $scope.load = function () {
            var formId = $scope.formId,
            formData = formStore.getFormData(formId);

            $scope.formData = formData.data;
            $scope.formMethod = formData.method;
            $scope.formURL = $sce.trustAsResourceUrl(formData.url);
            $scope.suppClass = formData.suppClass;

            $scope.updatePage();
        };

        populateChoices = function (suppProp) {
            var valuesConstraint = suppProp[hydraExtNs.valuesConstraint],
                collectionIRI, memberValueProperty, memberLabelProperty;

            console.log("Choices form data")
            console.log($scope.formData)

            valuesConstraint = jsonldHelper.removeJSONArray(valuesConstraint);

            if (valuesConstraint[hydraExtNs.possibleValue]) {
                // Values to use as hydra-ext:value and rdfs:label pairs
                var collection = valuesConstraint[hydraExtNs.possibleValue];
                angular.forEach(collection, function (member, index) {
                    var name = jsonldHelper.getLiteralValue(member, rdfsNs.label),
                        value = jsonldHelper.getLiteralValue(member, hydraExtNs.value);
                    suppProp._choices.push({name: name, value: value});
                });

            } else if (valuesConstraint[hydraExtNs.valuesPagedCollection]) {
                collectionIRI = jsonldHelper.removeJSONArray(valuesConstraint[hydraExtNs.valuesPagedCollection]);
                memberValueProperty = jsonldHelper.getLiteralValue(valuesConstraint, hydraExtNs.memberValueProperty);
                memberLabelProperty = jsonldHelper.getLiteralValue(valuesConstraint, hydraExtNs.memberLabelProperty);
                if (memberValueProperty == null) {
                    throw "Expected memberValueProperty to find value in value constraint collection."
                }
                if (memberLabelProperty == null) {
                    throw "Expected memberLabelProperty to find value in value constraint collection."
                }
                if (jsonldHelper.hasId(collectionIRI)) {
                    collectionIRI = jsonldHelper.getIdValue(collectionIRI);
                }
                apiResources.getResource(collectionIRI)
                    .then(function (data) {
                        var collection = jsonldHelper.removeJSONArray(data.data);
                        angular.forEach(collection[hydraNs.member], function (member, index) {
                            var name = jsonldHelper.getLiteralValue(member, memberLabelProperty),
                                value = member[memberValueProperty];
                            suppProp._choices.push({name: name, value: value});
                        });
                    })
                    .catch(function (reason) {
                        throw "Error getting value options: " + reason;
                    });
                
            } else {
                throw "Don't know how to retrieve values for value constraint.";
            }
        }

        $scope.updatePage = function () {
            var suppProps, 
                rdfType = $scope.suppClass["@id"],
                typeSuppProp = {}, 
                typeProp;

            $scope.resetPage();

            suppProps = jsonldLib.getValues($scope.suppClass, hydraNs.supportedProperty);
            // console.log("form items");
            // console.log(suppProps);

            // Note: used following as basis for dynamic form elements:
            // http://jsfiddle.net/langdonx/6H8Xx/2/
            angular.forEach(suppProps, function (suppProp, key) {
                // Collections
                if ($scope.hasValueConstraint(suppProp)) {
                    suppProp._hasChoice = true;
                    suppProp._choices = [];
                    populateChoices(suppProp);
                } else {
                    suppProp._hasChoice = false;
                }
                $scope.hydraForm.data.fields.push(suppProp);
            });

            // Add a SupportedProperty for the @type
            typeSuppProp[hydraNs.property] = {"@id": "@type"};
            typeProp = typeSuppProp[hydraNs.property];
            typeProp[rdfsNs.label] = {"@value": "Type"};
            typeProp[rdfsNs.range] = rdfsNs.Literal;
            // Use model binding to attach value
            typeSuppProp.data = rdfType;
            typeSuppProp._hidden = true; // Make this hidden
            $scope.hydraForm.data.fields.push(typeSuppProp);
        };

        $scope.submitForm = function () {
            var formData = {},
                jsonData = {},
                url = $scope.formURL,
                method = $scope.formMethod,
                requestHeaders = {"Content-Type": "application/json"};

            angular.forEach($scope.hydraForm.data.fields, function (suppProp, key) {
                var fieldName = $scope.getSupportedPropertyPropertyId(suppProp),
                    fieldValue = suppProp.data,
                    isSelectField = suppProp._hasChoice;
                if (typeof fieldValue !== 'undefined') {
                    if (isSelectField) {
                        // HTML select field
                        formData[fieldName] = fieldValue.value;
                    } else {
                        // Regular input like HTML input
                        formData[fieldName] = fieldValue;
                    }
                }                    
            });
            console.log("formData");
            console.log(formData);

            // Add the context
            //if (apiDoc["@context"]) {
            //    formData["@context"] = apiDoc["@context"];
            //}

            jsonData = JSON.stringify(formData);
            $http({
                method: method, 
                url: url, 
                data: jsonData, 
                headers: requestHeaders})
                .success(function(data, status, headers, config) {
                    console.log("Got data back from post");
                    console.log(data);

                    // Look at response and decide what to do next
                    // ToDo: this is a hacky way of finding out what to do next.
                    // See discussions at:
                    // http://lists.w3.org/Archives/Public/public-hydra/2014Sep/0087.html
                    if (data && data["@type"]) {
                        jsonld.promises().expand(data)
                            .then(function (expanded) {
                                expanded = jsonldHelper.removeJSONArray(expanded);
                                var op = expanded[hydraNs.operation];
                                //console.log(expanded)
                                // ToDo: check there is only one operation available
                                // by looking for SupportedClass operations

                                // Process the operation if it's the only one
                                if (op) {
                                    console.log("Has return operation");
                                    op = jsonldHelper.removeJSONArray(op);
                                    var method = jsonldHelper.getLiteralValue(op, hydraNs.method);
                                    console.log("method: " + method);
                                    
                                    // Hack: get api doc
                                    // ToDo: whole of this section needs to be
                                    // refactored in with normal page loading code
                                    console.log("Remove form POST results hack.")
                                    apiResources.getAPIDoc('/hydra/api-doc')
                                        .then(function (results) {
                                            var apiDoc = jsonldHelper.removeJSONArray(results);
                                            if (method === "GET") {
                                                throw "Form GET redirect not implemented"
                                            } else if (method === "POST") {
                                                var formURL = data["iri"], // Hack to get Form's POST url
                                                    formData = null;
                                                $scope.formId = pageBuilder.saveForm(apiDoc, op, method, formURL, formData);
                                                //$scope.formId = formStore.saveFormData(method, formURL, formData, payloadClass);
                                                $scope.load();
                                            } else {
                                                throw "Unknown method in Form response operation."
                                            }
                                        });
                                    
                                } else {
                                    // ToDo: don't know what to do next
                                    $scope.formFeedback = "Success";
                                }
                            }, 
                            function (err) {
                                $scope.formFeedback = "Error expanding return document: " + err;
                            });
                    } else {
                        // No info about what to do next
                        $scope.formFeedback = "Success";
                    }
                    
                })
                .error(function(data, status, headers, config) {
                    //console.log("Error");
                    //console.log(status);
                    $scope.formFeedback = "Error: " + status;
                });
        };

        $scope.getSupportedPropertyLabel = function (suppProp) {
            return apiDocHelper.getSupportedPropertyLabel(suppProp);
        };

        $scope.getSupportedPropertyPropertyId = function (suppProp) {
            // Gets the id of the property belonging to the SupportedProperty
            var prop = apiDocHelper.getProperty(suppProp);
            if (prop == null) {
                throw "SupportedProperty doesn't have a property so unable to fetch id."
            }
            return jsonldHelper.getIdValue(prop, "@id")
        };

        $scope.hasValueConstraint = function (suppProp) {
            // Whether the input method has a list of predefined choices
            if (suppProp[hydraExtNs.valuesConstraint]) {
                return true;
            } else {
                return false;
            }
        };

    }]);
