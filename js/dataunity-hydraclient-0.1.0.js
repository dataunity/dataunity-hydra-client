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
    })

    // Configure the styling APIDoc (for specifying UI display options)
    .provider('uiAPIDoc', function () {
        this.uiAPIDoc = {};

        this.$get = function () {
            return this;
        };

        this.getUIAPIDoc = function () {
            return this.uiAPIDoc;
        };

        this.setUIAPIDoc = function (uiAPIDoc) {
            _this = this;
            // ToDo: preferably have jsonld dependency in a
            // AngularJS wrapper like with duHydraClient

            // ToDo: AngularJS wont know to wait until the
            // expand callback is returned. Is there a way
            // to make sure config isn't complete until the
            // callback is returned?
            jsonld.expand(uiAPIDoc, function(err, expanded) {
                if (err) {
                    throw err;
                }
                expanded = angular.isArray(expanded) ? expanded[0] : expanded;
                _this.uiAPIDoc = expanded;
            });
            this.uiAPIDoc = uiAPIDoc;
        };
    });

angular.module('duHydraClient', ['ngRoute', 'duConfig', 'duRouteResolverService'])

    // -------
    // Config
    // -------
    .config(['$routeProvider', 'entryPointProvider', 'routeResolverProvider', 
        function($routeProvider, entryPointProvider, routeResolverProvider) {

        // Setup routes
        var route = routeResolverProvider.route;

        $routeProvider
            // Route for item view
            .when('/item/:iri*', {
                controller: 'ResourceRouteCtrl',
                template: '<du-hydra-view contentstype="item" \
                    resourceiri="{{iri}}" \
                    viewname="default"></du-hydra-view>'
            })
            // Route for collection view
            .when('/collection/:iri*', {
                controller: 'ResourceRouteCtrl',
                template: '<du-hydra-view contentstype="collection" \
                    resourceiri="{{iri}}" \
                    viewname="default"></du-hydra-view>'
            })
            // Route for form view
            .when('/form/:formId*', {
                controller: 'FormRouteCtrl',
                template: '<du-hydra-view contentstype="form" formid="{{formId}}"></du-hydra-view>'
            })
            // Homepage
            .when('/', {
                redirectTo: '/item/' + encodeURIComponent(entryPointProvider.getEntryPoint())
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

    // Controller to set resource id for route based navigation
    .controller('ResourceRouteCtrl', ['$scope', '$routeParams', 
        function($scope, $routeParams) {
            // Simple controller to make route parameter available
            // to Hydra view
            var resourceIRI = decodeURIComponent($routeParams.iri);
            $scope.iri = resourceIRI;
    }])

    // Controller to set resource id for route based navigation
    .controller('FormRouteCtrl', ['$scope', '$routeParams', 
        function($scope, $routeParams) {
            // Simple controller to make route parameter available
            // to Hydra view
            $scope.formId = $routeParams.formId;
            $scope.contentsType = "form";
    }])


    // ---------------
    // RDF Namespaces
    // ---------------

    .factory('hydraNs', function () {
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

    .factory('hydraExtNs', function () {
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

    .factory('hydraUINs', function () {
        // Data Unity Hydra extensions namespace for styling
        // the UI
        hydraUIBase = "http://dataunity.org/ns/hydra-ui#"
        return {
            _base: hydraUIBase,
            swapContent: hydraUIBase + "swapContent",
            PostForm: hydraUIBase + "PostForm",
            orderId: hydraUIBase + "orderId",
            cssClass: hydraUIBase + "cssClass",
            labelInfo: hydraUIBase + "labelInfo"
        };
    })

    .factory('rdfNs', function () {
        // RDF namespace
        var rdfBase = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
        return {
            Property: rdfBase + "Property"
        };
    })

    .factory('rdfsNs', function () {
        // RDFS namespace
        var rdfsBase = 'http://www.w3.org/2000/01/rdf-schema#';
        return {
            label: rdfsBase + "label",
            subClassOf: rdfsBase + "subClassOf"
        };
    })

    .factory('oslcNs', function () {
        // OSLC - Resource Shapes namespace (http://www.w3.org/Submission/2014/SUBM-shapes-20140211)
        var oslcBase = "http://open-services.net/ns/core#";
        return {
            instanceShape: oslcBase + "instanceShape",
            resourceShape: oslcBase + "resourceShape",
            ResourceShape: oslcBase + "ResourceShape",
            describes: oslcBase + "describes",
            property: oslcBase + "property",
            Property: oslcBase + "Property",
            propertyDefinition: oslcBase + "propertyDefinition",
            name: oslcBase + "name",
            occurs: oslcBase + "occurs",
            ExactlyOne: oslcBase + "Exactly-one",
            ZeroOrOne: oslcBase + "Zero-or-one",
            OneOrMany: oslcBase + "One-or-many",
            ZeroOrMany: oslcBase + "Zero-or-many",
            allowedValues: oslcBase + "allowedValues",
            allowedValue: oslcBase + "allowedValue",
            readOnly: oslcBase + "readOnly"
        }
    })

    // ----------------
    // JSON-LD Helpers
    // ----------------

    .factory('jsonldLib', function () {
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
            hasValue = function (val) {
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
            },

            isNullOrUndefined = function (obj) {
                return typeof obj === 'undefined' || obj === null;
            },
            isNotNullOrUndefined = function (obj) {
                return !isNullOrUndefined(obj);
            };
        return {
            getValue: getValue,
            getLiteralValue: getLiteralValue,
            getIdValue: getIdValue,
            hasId: hasId,
            hasValue: hasValue,
            removeJSONArray: removeJSONArray,
            isNullOrUndefined: isNullOrUndefined,
            isNotNullOrUndefined: isNotNullOrUndefined
        }
    }])


    // --------------
    // Hydra helpers
    // --------------

    // Helper for Hydra API Documentation
    .factory('apiDocHelper', ['rdfsNs', 'hydraNs', 'jsonldLib', 'jsonldHelper', 
        function (rdfsNs, hydraNs, jsonldLib, jsonldHelper) {

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
            // Get's an available label for the object
            getLabel = function (obj, defaultVal) {
                var defaultLabel = "Untitled",
                    label = "";
                if (typeof defaultVal !== "undefined") {
                    defaultLabel = defaultVal;
                }
                if (jsonldHelper.isNullOrUndefined(obj)) {
                    return defaultLabel;
                }
                label = jsonldHelper.getLiteralValue(obj, hydraNs.title);
                if (jsonldHelper.isNullOrUndefined(label)) {
                    label = jsonldHelper.getLiteralValue(obj, rdfsNs.label);
                }
                if (jsonldHelper.isNullOrUndefined(label)) {
                    label = defaultLabel;
                }
                return label;
            },
            getSupportedPropertyLabel = function (suppProp) {
                var label = getLabel(suppProp),
                    prop = null;

                if (jsonldHelper.isNullOrUndefined(label)) {
                    prop = getProperty(suppProp);
                    if (prop == null) {
                        label = "Untitled";
                    } else {
                        label = getLabel(prop, "Untitled");
                    }
                }
                return label;
                // var label = jsonldHelper.getLiteralValue(suppProp, hydraNs.title),
                //     prop = null;

                // if (typeof label === 'undefined' || label == null) {
                //     var prop = getProperty(suppProp);
                //     if (prop == null) {
                //         label = "Untitled";
                //     } else {
                //         label = jsonldHelper.getLiteralValue(prop, rdfsNs.label);
                //     }
                // }
                // return label;
            },
            // Finds whether the SupportedClass is a rdfs sub type of one of
            // the base classes supplied
            isSubClassOf = function (apiDoc, classIRI, baseClassIRIs) {
                // Find the class in API Doc
                var apiDoc = jsonldHelper.removeJSONArray(apiDoc),
                    suppClass = findSupportedClass(apiDoc, classIRI),
                    baseClass = "",
                    isSubClass = false;

                if (jsonldHelper.isNullOrUndefined(suppClass)) {
                    return false;
                }

                baseClass = suppClass[rdfsNs.subClassOf];

                if (baseClass) {
                    typesToCheck = angular.isArray(baseClass) ? baseClass : [baseClass];
                    baseClassIRIs = angular.isArray(baseClassIRIs) ? baseClassIRIs : [baseClassIRIs];
                    angular.forEach(typesToCheck, function (typeToCheck) {
                        var iriToCheck = typeToCheck;
                        if (jsonldHelper.hasId(iriToCheck)) {
                            iriToCheck = jsonldHelper.getIdValue(iriToCheck);
                        }
                        angular.forEach(baseClassIRIs, function (baseClassIRI) {
                            if (iriToCheck === baseClassIRI) {
                                isSubClass = true;
                            }
                        });
                    });
                }

                return isSubClass;
            },
            // Finds a SupportedOperation in the SupportedProperty
            // with the given form method
            findSupportedOperationWithMethod = function (suppProp, method) {
                var suppOps, prop, suppOp = null;
                if (jsonldHelper.isNullOrUndefined(suppProp)) {
                    return suppOp;
                }
                prop = getProperty(suppProp);
                if (jsonldHelper.isNullOrUndefined(prop)) {
                    return suppOp;
                }
                suppOps = prop[hydraNs.supportedOperation];
                if (jsonldHelper.isNullOrUndefined(suppOps)) {
                    return suppOp;
                }
                angular.forEach(suppOps, function (tmpSuppOp, ind) {
                    var methodVal = jsonldHelper.getLiteralValue(tmpSuppOp, hydraNs.method);
                    if (jsonldHelper.isNotNullOrUndefined(methodVal)) {
                        if (methodVal === method) {
                            suppOp = tmpSuppOp;
                            // ToDo: inefficiency as loop doesn't exit
                        }
                    }
                });
                return suppOp;
            },
            // Whether the hydra SupportedOpertation returns a collection
            supportedOperationReturnsCollection = function (apiDoc, suppOp) {
                var isCollection = false,
                    returnsTypes, tmp;
                if (!suppOp) {
                    return false;
                }
                returnsTypes = jsonldLib.getValues(suppOp, hydraNs.returns);
                angular.forEach(returnsTypes, function (returnType) {
                    tmp = jsonldHelper.getIdValue(returnType);
                    if (tmp === hydraNs.Collection || tmp === hydraNs.PagedCollection) {
                        isCollection = true;
                    } else {
                        if (!isCollection) {
                            // Check if type is sub class of collection
                            if (isSubClassOf(apiDoc, tmp, 
                                [hydraNs.Collection, hydraNs.PagedCollection])) {
                                isCollection = true;
                            }
                        }
                    }
                    
                });
                return isCollection;
            };

        return {
            getProperty: getProperty,
            getLabel: getLabel,
            findSupportedClass: findSupportedClass,
            findSupportedProperty: findSupportedProperty,
            findSupportedOperationWithMethod: findSupportedOperationWithMethod,
            getSupportedPropertyLabel: getSupportedPropertyLabel,
            isSubClassOf: isSubClassOf,
            supportedOperationReturnsCollection: supportedOperationReturnsCollection
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
    }])

    .factory('apiResources', ['$http', '$log', '$q',
        function($http, $log, $q) {
        // Dependencies
        var jsonLd = jsonld,
            jsonldPromises = jsonld.promises(),
            getAPIDocIRI = function (headers) {
                // Finds API Documentation IRI from Link header.
                // See http://lists.w3.org/Archives/Public/public-hydra/2014May/0003.html
                // "you would reference the API documentation via an HTTP Link header"
                // Note: AngularJS seems to convert header name to lower case
                var link = headers()["link"],
                    apiDocIRI = null,
                    linkParts;
                if (typeof link === "undefined") {
                    $log.info("Resource doesn't have Hydra API Documentation Link.");
                } else {
                    linkParts = link.split("rel=");
                    if (linkParts.length === 2 && 
                        linkParts[1].trim() === '"http://www.w3.org/ns/hydra/core#apiDocumentation"') {
                        apiDocIRI = linkParts[0].trim();
                        if (apiDocIRI.length > 0 && apiDocIRI[apiDocIRI.length - 1] === ";") {
                            apiDocIRI = apiDocIRI.substr(0, apiDocIRI.length - 1).trim();
                        }
                        if (apiDocIRI.length > 0 && apiDocIRI[0] === "<") {
                            apiDocIRI = apiDocIRI.substr(1);
                        }
                        if (apiDocIRI.length > 0 && apiDocIRI[apiDocIRI.length - 1] === ">") {
                            apiDocIRI = apiDocIRI.substr(0, apiDocIRI.length - 1);
                        }
                    }
                }

                console.log("link apiDocIRI", apiDocIRI)

                if (apiDocIRI == null) {
                    // ToDo: turn this into an error?
                    $log.info("Resource doesn't have Hydra API Documentation Link.");
                    // Hack: static url 
                    apiDocIRI = '/hydra/api-doc';
                }
                return apiDocIRI;
            };
        return {
            getResource: function(iri) {
                var deferred = $q.defer();
                $http.get(iri, {headers: {"Accept": "application/json"}})
                    .success(function(data, status, headers, config) {
                        var apiDocIRI;
                        try {
                            apiDocIRI = getAPIDocIRI(headers);
                        } catch (err) {
                            deferred.reject("Can't get API Documentation IRI. " + err.message);
                        }
                        
                        // Expand the context
                        jsonldPromises.expand(data)
                            .then(function (expanded) {
                                deferred.resolve({
                                    data: expanded, 
                                    apiDocURL: apiDocIRI});
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
                    .success(function(data, status, headers, config) {
                        var apiDocIRI;
                        try {
                            apiDocIRI = getAPIDocIRI(headers);
                        } catch (err) {
                            deferred.reject("Can't get API Documentation IRI. " + err.message);
                        }
                        
                        deferred.resolve({
                            data: data, 
                            apiDocURL: apiDocIRI});
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


    // -----------
    // Form store
    // -----------
    // This stores form information between switches in views.
    // It uses an id to retrieve the form information
    .factory('formStore', function () {
        // Store temp detail for making a form
        var formData = {},
            saveFormData = function (method, url, resourceIRI, data, suppClass) {
                var id = method + "_" + url + "_" + suppClass["@id"];
                formData[id] = {
                    method: method,
                    url: url,
                    resourceIRI: resourceIRI,
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


    // -------------
    // Page builder
    // -------------
    // Page builder manages 'page items', which are simple wrappers around
    // Hydra information to make things easier to display in the UI
    .factory('pageBuilder', ['jsonldLib', 'jsonldHelper', 'hydraNs', 'rdfNs', 'hydraUINs',
        'apiDocHelper', 'hydraHelper', 'uiAPIDocHelper', 'routeResolver', 'formStore',
        function (jsonldLib, jsonldHelper, hydraNs, rdfNs, hydraUINs,
            apiDocHelper, hydraHelper, uiAPIDocHelper, routeResolver, formStore) {

        var saveForm = function (apiDoc, suppOp, method, formURL, resourceIRI, formData) {
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

            var savedFormId = formStore.saveFormData(method, formURL, resourceIRI, formData, payloadClass);
            return savedFormId;
        },
        // Puts Hydra and page data into a wrapper to make things easier for 
        // the UI to consume
        addPageItems = function (pageItemCollection, pageData, apiDoc, pageTypes) {
            // pageItemCollection is the collection that will be added to
            pageItems = [];
            angular.forEach(pageData, function (itemValue, key) {
                var value, suppProp, prop, propTypes, propType, propId, resourceIRI, suppClass,
                    propertyValue, pageItem;

                if (key.indexOf("@") === 0) {
                    return;
                } else {
                    value = angular.isArray(itemValue) && itemValue.length > 0 ? itemValue[0] : itemValue;
                    suppProp = apiDocHelper.findSupportedProperty(apiDoc, pageTypes, key);
                    if (suppProp == null) {
                        throw "Could not find SupportedProperty " + String(key) + 
                            " in SupportedClass " + String(pageTypes);
                    }
                    prop = apiDocHelper.getProperty(suppProp);

                    // Get the property @type and @id
                    propTypes = prop["@type"];
                    propType = hydraHelper.hydraType(propTypes);
                    if (propType == null) {
                        // No specific hydra type, like Link. Try other types
                        if (propTypes && angular.isArray(propTypes) && propTypes.length > 0) {
                            propType = propTypes[0];
                        }
                    }
                    propId = jsonldHelper.hasId(prop) ? jsonldHelper.getIdValue(prop) : null;
                    // propType = prop["@type"];
                    // propType = propType && angular.isArray(propType) ? propType[0] : propType;

                    // console.log('prop["@type"]')
                    // console.log(propType)
                    //if (suppProp["@type"])

                    // if (jsonldHelper.hasValue(value)) {
                    //     value = angular.isArray(value) && value.length > 0 ? value[0] : value;
                    //     pageItemValue = jsonldHelper.getLiteralValue(value, "@value");
                    // } else {
                    //     pageItemValue = jsonldHelper.getIdValue(value);
                    // }

                    // Store resource IRI
                    // console.log("looking to store resource iri for key " + key)
                    //if (jsonldHelper.hasId(value)) {
                    if (propType === hydraNs.Link) {
                        resourceIRI = jsonldHelper.getIdValue(value);
                        propertyValue = null;
                    } else if (propType === rdfNs.Property) {
                        resourceIRI = null;
                        if (jsonldHelper.hasValue(value)) {
                            propertyValue = jsonldHelper.getLiteralValue(value, "@value");
                        } else {
                            propertyValue = "Unknown";
                        }
                    } else {
                        resourceIRI = null;
                        propertyValue = "Unknown";
                    }
                    // console.log("link resourceIRI")
                    // console.log(resourceIRI)

                    // Place the information about Hydra Link/Property into
                    // a convenient wrapper for the UI
                    suppClass = pageTypes[0];
                    pageItem = {
                        "type": propType,
                        "value": propertyValue,
                        "resourceIRI": resourceIRI,
                        "prop": prop,
                        "suppProp": suppProp,
                        "suppClass": suppClass
                    };

                    // Find out if there's any UI styling overrides
                    var suppPropUI = uiAPIDocHelper.supportedPropertyOptions(suppClass, propId);
                    if (suppPropUI) {
                        var orderId = jsonldHelper.getLiteralValue(suppPropUI, hydraUINs.orderId, null),
                            uiProp = apiDocHelper.getProperty(suppPropUI),
                            uiSuppOps = uiProp[hydraNs.supportedOperation],
                            swapContentInfo = suppPropUI[hydraUINs.swapContent],
                            suppOps;

                        console.log("Supp op ui", uiProp[hydraNs.supportedOperation])

                        // Ordering of SupportedProperties
                        if (jsonldHelper.isNotNullOrUndefined(orderId)) {
                            pageItem._orderId = orderId;
                        }

                        if (uiSuppOps) {
                            // There is some information about SupportedOperations so
                            // markup the suppOps in pageItem
                            console.log("Has UI suppOp info")
                            suppOps = prop[hydraNs.supportedOperation];
                            angular.forEach(suppOps, function (suppOp) {
                                var method = jsonldHelper.getLiteralValue(suppOp, hydraNs.method),
                                    uiSuppOp = apiDocHelper.findSupportedOperationWithMethod(suppPropUI, method),
                                    cssClass;
                                console.log("Using suppOp info", uiSuppOp)
                                if (uiSuppOp) {
                                    cssClass = jsonldHelper.getLiteralValue(uiSuppOp, hydraUINs.cssClass, null);
                                    if (jsonldHelper.isNotNullOrUndefined(cssClass)) {
                                        console.log("CssClass", cssClass)
                                        suppOp._cssClass = cssClass;
                                    }
                                }
                            });
                        }

                        if (swapContentInfo) {
                            // Swap out SupportedProperty for different content
                            swapContentInfo = angular.isArray(swapContentInfo) ? swapContentInfo[0] : swapContentInfo;
                            swapContentType = angular.isArray(swapContentInfo["@type"]) ? swapContentInfo["@type"][0] : swapContentInfo["@type"];
                            // Find out what to swap in place of the SupportedProperty
                            if (swapContentType === hydraUINs.PostForm) {
                                // Swap with POST Form
                                console.log("Swap form resource iri", resourceIRI)
                                var method = "POST",
                                    op = apiDocHelper.findSupportedOperationWithMethod(suppProp, method), 
                                    formURL = resourceIRI, 
                                    formData = null, 
                                    formId;
                                if (jsonldHelper.isNullOrUndefined(op)) {
                                    throw "Expected UI swap content override property to have a POST operation."
                                }
                                pageItem._swapType = "form";
                                formId = saveForm(apiDoc, op, method, formURL, resourceIRI, formData);
                                pageItem._formId = formId;
                                console.log("TODO: Create form")
                            }
                        }
                        
                    }

                    // pageItemCollection.push(pageItem);
                    pageItems.push(pageItem);
                }
            });

            // Sort the items by orderId
            pageItems.sort(function (lhs, rhs) {
                var lhsOrderId = jsonldHelper.isNullOrUndefined(lhs._orderId) ? 0 : lhs._orderId,
                    rhsOrderId = jsonldHelper.isNullOrUndefined(rhs._orderId) ? 0 : rhs._orderId;
                return lhsOrderId - rhsOrderId;
            })

            // Add items to pageItems collection
            angular.forEach(pageItems, function (pageItem) {
                pageItemCollection.push(pageItem);
            });
        };

        return {
            saveForm: saveForm,
            addPageItems: addPageItems
        }
    }])


    // -------------
    // Styling info
    // -------------
    // Helper for looking up styling information contained in the
    // optional config setting. Uses a structure similar to Hydra
    // APIDoc, but with UI styling options instead.
    .factory('uiAPIDocHelper', ['uiAPIDoc', 'hydraNs', 'apiDocHelper',
        function (uiAPIDoc, hydraNs, apiDocHelper) {

        var supportedPropertyOptions = function (hydraClassId, hydraPropId) {
                var apiDocUI = uiAPIDoc.getUIAPIDoc(),
                    suppPropOptions = apiDocHelper.findSupportedProperty(apiDocUI, hydraClassId, hydraPropId);
                // console.log("suppProp:");
                // console.log(suppProp);
                return suppPropOptions || null;
            };

        return {
            supportedPropertyOptions: supportedPropertyOptions
        };
    }])


    // -------------
    // Hydra views
    // -------------

    // Service for managing Hydra views
    .factory('hydraViews', ['jsonldLib', function (jsonldLib) {
        var views = {},
            registerView = function (name, scope) {
                console.log("Registering view", name)
                return views[name] = scope;
            },
            changeView = function (name, contentsType, resourceIRI) {
                var scope = views[name];
                if (typeof scope === "undefined" || scope === null) {
                    throw "No scope for view name";
                }
                console.log("Changing view", name, scope);
                scope.changeView(contentsType, resourceIRI);
            };
        return {
            registerView: registerView,
            changeView: changeView
        }
    }])

    // Encapsulates a step through a Hydra API path (there may be other different paths
    // being displayed in the page at the same time)
    .directive('duHydraView', ['rdfNs', 'rdfsNs', 'hydraNs', 
        function (rdfNs, rdfsNs, hydraNs) {
        return {
            restrict: 'E',
            scope: {
                contentsType: "@contentstype",
                iri: "@resourceiri",
                formId: "@formid",
                viewName: "@viewname"
            },
            controller: "HydraViewCtrl",
            template: '<div> \
                    <du-hydra-item \
                        ng-if="contentsType == \'item\'"> \
                    </du-hydra-item> \
                    <du-hydra-collection \
                        ng-if="contentsType == \'collection\'"> \
                    </du-hydra-collection> \
                    <div ng-if="contentsType == \'form\'"> \
                        <du-form></du-form> \
                    </div> \
                </div>',
            link: function(scope, element) {
            }
        };
    }])

    // Controller to manage changing views
    .controller('HydraViewCtrl', ['$scope', '$window', 'hydraViews',
        function($scope, $window, hydraViews) {
            // When navigating, whether to change who page or just this view
            $scope.doRouteRedirect = true;
            console.log("HydraViewCtrl loading", $scope.contentsType, $scope.iri, Math.random());

            $scope.$on('changeView', function(evnt, contentsType, resourceIRI) {
                console.log('changeView', contentsType, resourceIRI);
                if ($scope.doRouteRedirect) {
                    $window.location.href = "#/" + contentsType + "/" + encodeURIComponent(resourceIRI);
                } else {
                    // $scope.iri = resourceIRI;
                    // $scope.contentsType = contentsType;
                    console.log("Manually triggering view load")
                    $scope.changeView(contentsType, resourceIRI);
                }
            });

            $scope.$on('changeFormView', function(evnt, contentsType, formId) {
                console.log('changeFormView', contentsType, formId);
                if ($scope.doRouteRedirect) {
                    $window.location.href = "#/form/" + encodeURIComponent(formId);
                } else {
                    $scope.formId = formId;
                    $scope.contentsType = contentsType;
                }                
            });

            $scope.changeView = function (contentsType, resourceIRI) {
                var oldContentsType = $scope.contentsType;
                $scope.iri = resourceIRI;
                $scope.contentsType = contentsType;
                if (oldContentsType === contentsType) {
                    // The directive wont update as it's already loaded
                    // the html and controller for this content type.
                    // Manually trigger an update.
                    console.log("Manually triggering resource load...");
                    $scope.$broadcast("loadResource");
                }
            };

            hydraViews.registerView($scope.viewName, $scope);
    }])


    // -----------------------------
    // SupportedProperty directives
    // -----------------------------

    .directive('duSupportedPropertyLabel', function() {
        return {
            restrict: 'E',
            scope: {
                "suppProp": "=suppprop",
                "suppClass": "=suppclass"
            },
            template: '<span class="{{getCssClass()}}">{{getLabel()}}</span>',
            // template: '<span>{{getLabel()}}</span>',
            controller: "SupportedPropertyLabelCtrl"
        };
    })

    // Controller to manage changing views
    .controller('SupportedPropertyLabelCtrl', ['$scope', 'jsonldHelper', 'hydraUINs', 
        'apiDocHelper', 'uiAPIDocHelper',
        function($scope, jsonldHelper, hydraUINs, apiDocHelper, uiAPIDocHelper) {
            $scope.getLabel = function () {
                return apiDocHelper.getLabel($scope.suppProp);
            };

            $scope.getCssClass = function () {
                // See if there are any styling overrides
                var cssClass = "hy-supp-prop-label",
                    prop = apiDocHelper.getProperty($scope.suppProp),
                    hydraClassId = $scope.suppClass, 
                    hydraPropId, uiSuppProp, labelInfo, uiProp, uiCssClass;
                if ( jsonldHelper.hasId(prop) ) {
                    hydraPropId = jsonldHelper.getIdValue(prop);
                    uiSuppProp = uiAPIDocHelper.supportedPropertyOptions(hydraClassId, hydraPropId);
                    console.log("uiSuppProp", uiSuppProp)
                    if (uiSuppProp) {
                        // Look for information about label
                        labelInfo = uiSuppProp[hydraUINs.labelInfo];
                        labelInfo = jsonldHelper.removeJSONArray(labelInfo);
                        if (labelInfo) {
                            uiCssClass = jsonldHelper.getLiteralValue(labelInfo, hydraUINs.cssClass, null);
                            console.log("uiCssClass", labelInfo, uiCssClass)
                            if (uiCssClass) {
                                cssClass = uiCssClass;
                            }
                        }
                        // uiProp = apiDocHelper.getProperty(uiSuppProp);
                        // if (uiProp) {
                        //     uiCssClass = jsonldHelper.getLiteralValue(uiProp, hydraUINs.cssClass, null);
                        //     console.log("uiCssClass", uiCssClass)
                        //     if (uiCssClass) {
                        //         cssClass = uiCssClass;
                        //     }
                        // }
                    }
                }
                return cssClass;
            };
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
        var getTemplate = function (hydraType, swapType) {
            var template;

            if (swapType === "form") {
                template = '<div ng-controller="FormPageItemCtrl"><du-form></du-form></div>'
            } else if (hydraType === hydraNs.Link) {
                template = '<div> \
                    <du-supported-property-label \
                        suppclass="item.suppClass" \
                        suppprop="item.suppProp"> \
                    </du-supported-property-label> \
                    <du-supp-op ng-repeat="suppOp in item.prop[\'http://www.w3.org/ns/hydra/core#supportedOperation\']" \
                        suppop="suppOp" \
                        suppclass="item.suppClass" \
                        resourceiri="item.resourceIRI" \
                        apidoc="apiDoc" \
                        cssclass="suppOp._cssClass"> \
                    </du-supp-op> \
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
            // template: '<div ng-if="item._swapType === \'form\'" ng-controller="FormCtrl"><du-form></du-form></div> \
            //     <div ng-if="item.type === \'http://www.w3.org/ns/hydra/core#Link\'"> \
            //         {{getSupportedPropertyLabel(item.suppProp)}} \
            //         <du-supp-op ng-repeat="suppOp in item.prop[\'http://www.w3.org/ns/hydra/core#supportedOperation\']" \
            //             suppop="suppOp" \
            //             suppclass="item.suppClass" \
            //             resourceiri="item.resourceIRI" \
            //             apidoc="apiDoc"> \
            //         </du-supp-op> \
            //     </div> \
            //     <div ng-if="item.type === \'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property\'"> \
            //         {{item.value}} \
            //     </div> \
            //     <div ng-if="item.type !== \'http://www.w3.org/ns/hydra/core#Link\' && item.type !== \'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property\'"> \
            //         Unrecognised item type \
            //     </div>'
            link: function(scope, element) {
                // Note: inline template seems to go into an infinite loop
                // when an 'swap content' inline form is added. 
                // Using template function avoids this issue.
                var template = getTemplate(scope.item.type, scope.item._swapType);
                element.html(template);
                $compile(element.contents())(scope);
            }
        };
    }])

    // Controller to set form id based on a pageItem
    .controller('FormPageItemCtrl', ['$scope', 
        function($scope) {
            $scope.formId = $scope.item._formId;
    }])


    // ---------------------------
    // SupportedOperation display
    // ---------------------------

    .directive('duSuppOp', ['$compile', 'rdfNs', 'rdfsNs', 'hydraNs', 
        function ($compile, rdfNs, rdfsNs, hydraNs) {

        return {
            restrict: 'E',
            scope: {
                suppOp: "=suppop",
                suppClass: "=suppclass",
                resourceIRI: "=resourceiri",
                apiDoc: "=apidoc",
                cssClass: "=cssclass"
            },
            //template: '<span><a href="{{getHref()}}" ng-click="changeView()">{{getLabel()}}</a></span>',
            template: '<span ng-click="changeView()" class="{{getCssClass()}}">{{getLabel()}}</span>',
            controller: "SuppOpCtrl",
            link: function(scope, element) {
                // var template = getTemplate(scope.item.type);
                // element.html(template);
                // $compile(element.contents())(scope);
            }
        };
    }])

    .controller('SuppOpCtrl', ['$scope', '$window', 'jsonldHelper', 
        'rdfsNs', 'hydraNs', 'hydraHelper', 'apiDocHelper', 'pageBuilder', 'routeResolver',
        function($scope, $window, jsonldHelper, 
            rdfsNs, hydraNs, hydraHelper, apiDocHelper, pageBuilder, routeResolver) {

        $scope.getLabel = function () {
            return apiDocHelper.getLabel($scope.suppOp);
        };

        $scope.getCssClass = function () {
            return jsonldHelper.isNotNullOrUndefined($scope.cssClass) ? $scope.cssClass : "hy-supp-prop";
        };

        $scope.changeView = function () {
            var suppClass = $scope.suppClass,
                resourceIRI = $scope.resourceIRI,
                getPath = routeResolver.routeConfig.getPath,
                apiDoc = angular.isArray($scope.apiDoc) ? $scope.apiDoc[0] : $scope.apiDoc,
                suppOp = $scope.suppOp, 
                method = jsonldHelper.getLiteralValue(suppOp, hydraNs.method),
                formData = null,
                saveFormId, formURL, routePath;

            if (method === "GET") {
                // HTTP GET
                routePath = getPath(suppClass, suppOp["@id"]);
                if (routePath != null) {
                    // User defined view for this SupportedClass and SupportedOp
                    // Bit of a hack to insert target IRI
                    // ToDo: move this up to HydraViewCtrl
                    console.log("Only have custom routes at the moment. Need to make custom views instead.")
                    $window.location.href = "#" + routePath.replace(":iri*", encodeURIComponent(resourceIRI));
                } else if (apiDocHelper.supportedOperationReturnsCollection(apiDoc, suppOp)) {
                    $scope.$emit('changeView', "collection", resourceIRI);
                } else {
                    $scope.$emit('changeView', "item", resourceIRI);
                }
            } else if (method === "POST" || method === "PUT") {
                formURL = resourceIRI;
                saveFormId = pageBuilder.saveForm(apiDoc, suppOp, method, formURL, resourceIRI, formData);
                $scope.$emit('changeFormView', "form", saveFormId);
            } else {
                throw "Unsupported SupportedOperation method: " + String(method);
            }
        };
    }])


    // ----------
    // Item view
    // ----------

    .directive('duHydraItem', ['rdfNs', 'rdfsNs', 'hydraNs', 
        function (rdfNs, rdfsNs, hydraNs) {
        return {
            restrict: 'E',
            controller: "ItemViewCtrl",
            template: '<div ng-init="load()"> \
                    <h2>{{title}}</h2> \
                    <du-item ng-repeat="item in pageItems"></du-item> \
                </div>'
        };
    }])

    .controller('ItemViewCtrl', ['$scope', '$routeParams', 'apiResources', 'jsonldLib', 'jsonldHelper', 
        'rdfsNs', 'hydraNs', 'hydraHelper', 'apiDocHelper', 'pageBuilder',
        function($scope, $routeParams, apiResources, jsonldLib, jsonldHelper, 
            rdfsNs, hydraNs, hydraHelper, apiDocHelper, pageBuilder) {

        $scope.pageData = null;
        $scope.apiDoc = null;
        $scope.title = "";
        $scope.pageItems = [];

        $scope.resetView = function () {
            $scope.pageData = null;
            $scope.apiDoc = null;
            $scope.title = "";
            $scope.pageItems = [];
        };

        $scope.load = function () {
            $scope.resetView();
            apiResources.getResource($scope.iri)
                .then(function (results) { 
                    $scope.pageData = results.data;
                    return apiResources.getAPIDoc(results.apiDocURL); 
                })
                .then(function (results) {
                    $scope.apiDoc = results;
                    $scope.updatePage();
                })
                .catch(function (reason) {
                    throw "Error getting resource: " + reason;
                });
        };

        $scope.$on("loadResource", function (evnt) {
            $scope.load();
        });

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
        };

        $scope.getLiteralValue = function (subject, predicate) {
            return jsonldHelper.getLiteralValue(subject, predicate);
        };

        $scope.getSupportedPropertyLabel = function (suppProp) {
            return apiDocHelper.getSupportedPropertyLabel(suppProp);
        };
    }])


    // ----------------
    // Collection view
    // ----------------

    .directive('duHydraCollection', ['rdfNs', 'rdfsNs', 'hydraNs', 
        function (rdfNs, rdfsNs, hydraNs) {
        return {
            restrict: 'E',
            controller: "CollectionCtrl",
            template: '<div ng-init="load()"> \
                    <h2>{{title}}</h2> \
                    <du-supp-op ng-repeat="suppOp in suppOps" \
                        suppop="suppOp" \
                        suppclass="suppClass" \
                        resourceiri="iri" \
                        apidoc="apiDoc" \
                        cssclass="suppOp._cssClass"> \
                    </du-supp-op> \
                    <div ng-repeat="member in members" class="du-member"> \
                        <du-item ng-repeat="item in member.pageItems"></du-item> \
                    </div> \
                </div>'
        };
    }])

    .controller('CollectionCtrl', ['$scope', '$routeParams', 'apiResources', 'jsonldLib', 'jsonldHelper', 
        'rdfsNs', 'hydraNs', 'hydraHelper', 'apiDocHelper', 'pageBuilder',
        function($scope, $routeParams, apiResources, jsonldLib, jsonldHelper, 
            rdfsNs, hydraNs, hydraHelper, apiDocHelper, pageBuilder) {

        // $scope.iri = decodeURIComponent($routeParams.iri);

        $scope.pageData = null;
        $scope.apiDoc = null;
        $scope.title = "";
        $scope.members = [];
        $scope.suppOps = [];
        $scope.suppClass = "";

        $scope.load = function () {
            apiResources.getResource($scope.iri)
                .then(function (results) { 
                    $scope.pageData = results.data;
                    return apiResources.getAPIDoc(results.apiDocURL); })
                .then(function (results) {
                    $scope.apiDoc = results;
                    $scope.updatePage();
                })
                .catch(function (reason) {
                    throw "Error getting resource: " + reason;
                });
        };

        $scope.updatePage = function () {
            var pageData = angular.isArray($scope.pageData) ? $scope.pageData[0] : $scope.pageData,
                membersData = jsonldLib.getValues(pageData, hydraNs.member),
                apiDoc = angular.isArray($scope.apiDoc) ? $scope.apiDoc[0] : $scope.apiDoc,
                pageTypes = jsonldLib.getValues(pageData, "@type"),
                hydraCls = apiDocHelper.findSupportedClass(apiDoc, pageTypes),
                suppOps, pageItemValue;

            $scope.title = apiDocHelper.getLabel(hydraCls, "Collection");

            // Find any SupportedOperations for this class
            suppOps = jsonldHelper.getValue(hydraCls, hydraNs.supportedOperation);
            // Store the hydra class for SuppOp
            if (typeof hydraCls["@id"] !== 'string') {
                throw "ToDo: get page Hydra Class IRI as string."
            }
            $scope.suppClass = hydraCls["@id"];
            if (suppOps && angular.isArray(suppOps)) {
                angular.forEach(suppOps, function (suppOp, indx) {
                    // Multiple SupportedProperties
                    $scope.suppOps.push(suppOp);
                });
            } else if (suppOps && !angular.isArray(suppOps)) {
                // Single SupportedProperty
                $scope.suppOps.push(suppOps);
            }
            
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
                $scope.members.push(member);
            });
        };

        $scope.getLiteralValue = function (subject, predicate) {
            return jsonldHelper.getLiteralValue(subject, predicate);
        };

        $scope.getSupportedPropertyLabel = function (suppProp) {
            return apiDocHelper.getSupportedPropertyLabel(suppProp);
        };
    }])


    // -----------------------
    // Resource Shapes - OSLC
    // -----------------------

    .factory('oslcHelper', ['oslcNs', 'jsonldHelper',
        function (oslcNs, jsonldHelper) {

                // Finds the OSLC Property in resource shape (by matching 
                // propertyDefinition IRI)
            var findProperty = function (resourceShape, propIRI) {
                    var oslcProp = null,
                        oslcProps = null,
                        tmpProp, tmpPropDef, tmpPropIRI, i;

                    if (jsonldHelper.isNullOrUndefined(resourceShape)) {
                        return oslcProp;
                    }
                    oslcProps = resourceShape[oslcNs.property];
                    if (jsonldHelper.isNullOrUndefined(oslcProps) || oslcProps.length === 0) {
                        return oslcProp;
                    }
                    for (i = 0; i < oslcProps.length; i++) {
                        tmpProp = oslcProps[i];
                        tmpPropDef = tmpProp[oslcNs.propertyDefinition];
                        if (!jsonldHelper.hasId(tmpPropDef)) {
                            continue;
                        }
                        tmpPropIRI = jsonldHelper.getIdValue(tmpPropDef);
                        if (tmpPropIRI === propIRI) {
                            oslcProp = tmpProp;
                            break;
                        }
                    }
                    return oslcProp;
                },
                hasAllowedValue = function (resourceShape, propIRI) {
                    var oslcProp = findProperty(resourceShape, propIRI);
                    if (oslcProp == null) {
                        return false;
                    }
                    return jsonldHelper.isNotNullOrUndefined(oslcProp[oslcNs.allowedValue]);
                },
                getAllowedValueList = function (resourceShape, propIRI) {
                    var oslcProp = findProperty(resourceShape, propIRI),
                        allowedValueList = [];
                    if (oslcProp == null) {
                        return allowedValueList;
                    }
                    allowedValueList = oslcProp[oslcNs.allowedValue];
                    return allowedValueList;
                };
            return {
                findProperty: findProperty,
                hasAllowedValue: hasAllowedValue,
                getAllowedValueList: getAllowedValueList
            }
    }])


    // ----------
    // Form view
    // ----------

    .directive('duForm', ['hydraNs', 
        function (hydraNs) {

        return {
            restrict: 'E',
            // scope: {
            //     suppOp: "=suppop",
            //     suppClass: "=suppclass",
            //     resourceIRI: "=resourceiri",
            //     apiDoc: "=apidoc",
            //     formURL: "=formurl",
            //     formMethod: "=formmethod"
            // },
            template: '<div ng-init="load()"> \
                    <h2>{{title}}</h2> \
                    <ng-form name="du-form-hydra" action="{{formURL}}" method="{{formMethod}}"> \
                    <div ng-repeat="suppProp in suppProps"> \
                        <!-- Hidden input --> \
                        <input ng-if="suppProp._hidden" \
                            name="{{getSupportedPropertyPropertyId(suppProp)}}" \
                            type="hidden" \
                            data-ng-model="suppProp.data"> \
                        <!-- Visible input --> \
                        <div ng-if="!suppProp._hidden"> \
                            <label for="{{getSupportedPropertyPropertyId(suppProp)}}"> \
                                {{getSupportedPropertyLabel(suppProp)}} \
                            </label> \
                            <!-- Text input --> \
                            <input ng-if="!suppProp._hasChoice" \
                                name="{{getSupportedPropertyPropertyId(suppProp)}}" \
                                type="text" \
                                data-ng-model="suppProp.data"> \
                            <!-- Drop down input --> \
                            <select ng-if="suppProp._hasChoice" \
                                name="{{getSupportedPropertyPropertyId(suppProp)}}" \
                                type="text" \
                                data-ng-model="suppProp.data" \
                                ng-options="choice.name for choice in suppProp._choices"> \
                            </select> \
                        </div> \
                    </div> \
                    <du-item ng-repeat="item in formItems"></du-item> \
                    <div><button ng-click="submitForm()">Add</button></div> \
                    <div du-form-feedback></div> \
                </ng-form> \
                </div>',
            controller: 'FormCtrl',
            //controller: "SuppOpCtrl",
            link: function(scope, element) {
                // var template = getTemplate(scope.item.type);
                // element.html(template);
                // $compile(element.contents())(scope);
            }
        };
    }])

    .controller('FormCtrl', ['$scope', '$routeParams', '$http', 'jsonldLib', 'jsonldHelper', 
        'rdfsNs', 'hydraNs', 'hydraExtNs', 'oslcNs', 'hydraHelper', 'apiDocHelper', 'oslcHelper', 
        'formStore', 'pageBuilder', '$sce', 'apiResources',
        function($scope, $routeParams, $http, jsonldLib, jsonldHelper, 
            rdfsNs, hydraNs, hydraExtNs, oslcNs, hydraHelper, apiDocHelper, oslcHelper,
            formStore, pageBuilder, $sce, apiResources) {

        //$scope.formId = $routeParams.formId;

        $scope.formData = null;
        $scope.formMethod = null;
        $scope.formURL = null;
        $scope.suppClass = null;
        $scope.instanceShape = null;

        $scope.title = "";
        $scope.formItems = [];

        $scope.suppProps = [];

        $scope.resetAll = function () {
            // Reset data
            $scope.formData = null;
            $scope.formMethod = null;
            $scope.formURL = null;
            $scope.suppClass = null;
            $scope.instanceShape = null;

            // Reset display items
            $scope.title = "";
            //$scope.suppClass = null;
            $scope.formItems = [];
            $scope.suppProps = [];
        };

        $scope.load = function () {
            console.log("Loading form")
            $scope.resetAll();
            var formId = $scope.formId,
            formData = formStore.getFormData(formId);

            $scope.formData = formData.data;
            $scope.formMethod = formData.method;
            console.log("Form ResourceIRI:", formData.resourceIRI)
            $scope.resourceIRI = formData.resourceIRI;
            $scope.formURL = $sce.trustAsResourceUrl(formData.url);
            $scope.suppClass = formData.suppClass;

            console.log("looking for resource iri")
            // If there's no form data and a resource IRI, try to fetch form data from server
            if (jsonldHelper.isNullOrUndefined($scope.formData) && 
                jsonldHelper.isNotNullOrUndefined($scope.resourceIRI)) {
                console.log("found resource iri", $scope.resourceIRI)
                // Fetch resource state
                // ToDo: check whether the form operation is an
                // 'add' operation, in which case no data will be
                // available (?)
                apiResources
                    .getResource($scope.resourceIRI)
                    .then(function (data) {
                        console.log("got form resource")
                        console.log(data)
                        $scope.formData = data.data;
                        $scope.updatePage();
                    })
                    .catch(function (reason) {
                        // throw "Error getting form resource: " + reason;
                        // Resource data unavailable - continue without
                        // form data
                        // ToDo: ideally catch 404 here and continue if
                        // it's encountered. Otherwise let user know about
                        // error.
                        $scope.updatePage();
                    });
            } else {
                $scope.updatePage();
            }
        };

        // DEPRECATED (in favour of OSLC)
        populateChoices = function (suppProp, selectedValue) {
            var valuesConstraint = suppProp[hydraExtNs.valuesConstraint],
                collectionIRI, memberValueProperty, memberLabelProperty, isId;

            valuesConstraint = jsonldHelper.removeJSONArray(valuesConstraint);

            if (valuesConstraint[hydraExtNs.possibleValue]) {
                // Hard coded values for values list.
                // Values to use as hydra-ext:value and rdfs:label pairs
                var collection = valuesConstraint[hydraExtNs.possibleValue];
                angular.forEach(collection, function (member, index) {
                    var name = jsonldHelper.getLiteralValue(member, rdfsNs.label),
                        value = jsonldHelper.getLiteralValue(member, hydraExtNs.value);
                    suppProp._choices.push({name: name, value: value});
                    if (value === selectedValue) {
                        suppProp.data = suppProp._choices[suppProp._choices.length - 1];
                    }
                });

            } else if (valuesConstraint[hydraExtNs.valuesPagedCollection]) {
                // Use a Hydra PageCollection for values
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

                // ToDo: find better way of identifying whether the value should be an
                // @id (i.e. a pointer to a resource). E.g. look up info in Hydra doc 
                // and check if @type = @id
                isId = memberValueProperty === '@id';
                if (isId) {
                    suppProp._convertValueToId = true;
                }

                apiResources.getResource(collectionIRI)
                    .then(function (data) {
                        var collection = jsonldHelper.removeJSONArray(data.data);
                        angular.forEach(collection[hydraNs.member], function (member, index) {
                            var name = jsonldHelper.getLiteralValue(member, memberLabelProperty),
                                value = member[memberValueProperty];
                            suppProp._choices.push({name: name, value: value});
                            if (value === selectedValue) {
                                suppProp.data = suppProp._choices[suppProp._choices.length - 1];
                            }
                        });
                    })
                    .catch(function (reason) {
                        throw "Error getting choice options: " + reason;
                    });
                
            } else {
                throw "Don't know how to retrieve values for value constraint.";
            }
        }

        $scope.updatePage = function () {
            var suppProps, 
                rdfType = $scope.suppClass["@id"],
                typeSuppProp = {}, 
                typeProp,
                existingData = jsonldHelper.removeJSONArray($scope.formData);

            $scope.title = apiDocHelper.getLabel($scope.suppClass, "Untitled");

            // Find out if the data has OSLC constaints (like allowed values)
            if (existingData && jsonldHelper.isNotNullOrUndefined(existingData[oslcNs.instanceShape])) {
                $scope.resourceShape = existingData[oslcNs.instanceShape];
                $scope.resourceShape = angular.isArray($scope.resourceShape) ? $scope.resourceShape[0] : $scope.resourceShape;
            }

            suppProps = jsonldLib.getValues($scope.suppClass, hydraNs.supportedProperty);

            // Note: used following as basis for dynamic form elements:
            // http://jsfiddle.net/langdonx/6H8Xx/2/
            angular.forEach(suppProps, function (suppProp, key) {
                var prop, propIRI, existingValue, displayValue;

                // Get existing data value
                prop = apiDocHelper.getProperty(suppProp);
                propIRI = jsonldHelper.getIdValue(prop);
                if (existingData) {
                    existingValue = jsonldHelper.getValue(existingData, propIRI);
                }

                // Set curent value (if available)
                if (existingValue) {
                    // ToDo: determine what value to display using 
                    // SupportedProperty info?
                    if (jsonldHelper.hasValue(existingValue)) {
                        displayValue = existingValue["@value"];
                    } else if (jsonldHelper.hasId(existingValue)) {
                        displayValue = existingValue["@id"];
                    } else {
                        // Don't know how to extract existing value. Error?
                    }
                }
                suppProp.data = displayValue;

                // Drop down choices
                if (oslcHelper.hasAllowedValue($scope.resourceShape, propIRI)) {
                    suppProp._hasChoice = true;
                    suppProp._choices = [];
                    populateAllowedValue(suppProp, $scope.resourceShape, propIRI, displayValue);
                } else if ($scope.hasValueConstraint(suppProp)) {
                    // DEPRECATED
                    // Drop down choices (OLD VERSION)
                    suppProp._hasChoice = true;
                    suppProp._choices = [];
                    populateChoices(suppProp, displayValue);
                } else {
                    suppProp._hasChoice = false;
                }

                $scope.suppProps.push(suppProp);
            });

            // Add a SupportedProperty for the @type
            typeSuppProp[hydraNs.property] = {"@id": "@type"};
            typeProp = typeSuppProp[hydraNs.property];
            typeProp[rdfsNs.label] = {"@value": "Type"};
            typeProp[rdfsNs.range] = rdfsNs.Literal;
            // Use model binding to attach value
            typeSuppProp.data = rdfType;
            typeSuppProp._hidden = true; // Make this hidden
            $scope.suppProps.push(typeSuppProp);
        };

        $scope.submitForm = function () {
            var formData = {},
                jsonData = {},
                url = $scope.formURL,
                method = $scope.formMethod,
                requestHeaders = {"Content-Type": "application/json"};

            angular.forEach($scope.suppProps, function (suppProp, key) {
                var fieldName = $scope.getSupportedPropertyPropertyId(suppProp),
                    fieldValue = suppProp.data,
                    isSelectField = suppProp._hasChoice,
                    convertValueToId = suppProp._convertValueToId;
                if (typeof fieldValue !== 'undefined') {
                    if (isSelectField) {
                        // HTML select field
                        formData[fieldName] = fieldValue.value;
                    } else {
                        // Regular input like HTML input
                        formData[fieldName] = fieldValue;
                    }
                    if (convertValueToId) {
                        formData[fieldName] = {"@id": formData[fieldName]}
                    }
                }                    
            });
            // console.log("formData");
            // console.log(formData);

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
                                                    // Assume resource to be edited is the same as form post url
                                                    resourceIRI = formURL,
                                                    formData = null;
                                                $scope.formId = pageBuilder.saveForm(apiDoc, op, method, formURL, resourceIRI, formData);
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

            //$scope.load();
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

        // Add page drop down options from OSLC allowedValue list
        populateAllowedValue = function (suppProp, resourceShape, propIRI, selectedValue) {
            var allowedValueList = oslcHelper.getAllowedValueList(resourceShape, propIRI);
            if (jsonldHelper.isNullOrUndefined(allowedValueList)) {
                throw "Expected value list for allowed values.";
            }
            angular.forEach(allowedValueList, function (member, index) {
                var name, value;
                // ToDo: support id objects
                if (!jsonldHelper.hasValue(member)) {
                    throw "Expected allowed value to have @value attribute."
                }
                value = jsonldHelper.getLiteralValue(member, "@value", "-- Missing --");
                // ToDo: support labels for values
                name = value;
                suppProp._choices.push({name: name, value: value});
                if (value === selectedValue) {
                    suppProp.data = suppProp._choices[suppProp._choices.length - 1];
                }
            });
        }

        // DEPRECATED (in favour of OSLC)
        $scope.hasValueConstraint = function (suppProp) {
            // Note: this uses custom DU extensions - switch to 
            // RDF Shapes implementation
            // Whether the input method has a list of predefined choices
            if (suppProp[hydraExtNs.valuesConstraint]) {
                return true;
            } else {
                return false;
            }
        };

    }]);
