

angular.module('dataunity-hydra', [])

    .factory('hydraNs', function() {
        var hydraBase = 'http://www.w3.org/ns/hydra/core#'
        return {
            supportedClass: hydraBase + "supportedClass",
            supportedProperty: hydraBase + "supportedProperty",
            supportedOperation: hydraBase + "supportedOperation",
            property: hydraBase + "property",
            method: hydraBase + "method",
            expects: hydraBase + "expects"
        }
    })

    .factory('rdfsNs', function() {
        var rdfsBase = 'http://www.w3.org/2000/01/rdf-schema#'
        return {
            label: rdfsBase + "label"
        }
    })

    .factory('jsonldHelper', function() {
        // Dependency
        var jsonLd = jsonld,

            getValue = function (subject, property, defaultVal) {

                var vals = jsonLd.getValues(subject, property),
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

            getLiteralValue = function (subject, property, defaultVal) {
                var val = getValue(subject, property, defaultVal);
                if (val && jsonld.hasProperty(val, "@value")) {
                    val = val["@value"]
                }
                return val;
            },

            getIdValue = function (idObj) {
                var idObject = angular.isArray(idObj) ? idObj[0] : idObj,
                    vals = jsonLd.getValues(idObject, "@id");
                if (vals.length !== 1) {
                    throw "Expected one value for id object."
                }
                return vals[0];
            };
        return {
            getValue: getValue,
            getLiteralValue: getLiteralValue,
            getIdValue: getIdValue
        }
    })
     
    .controller('HydraCtrl', function($scope, $sce, $http, jsonldHelper, rdfsNs, hydraNs) {
        // Dependencies
        var jsonLd = jsonld,
            jsonldPromises = jsonld.promises();

        // Helper for HTML form action url
        //$scope.trustSrc = function(src) {
        //    return $sce.trustAsResourceUrl(src);
        //};

        //var projectUrl = fbURL + $routeParams.projectId;
        $scope.currentData = null;
        $scope.apiDoc = null;
        $scope.supportedPropertiesLookup = {};
        $scope.hydraClassesLookup = {};
        $scope.areLinksVisible = true;
        $scope.isFormVisible = false;
        $scope.links = [];
        $scope.title = "";

        $scope.formURL = "";
        $scope.formMethod = "GET";
        //$scope.formInputs = [];
        $scope.hydraForm = {};
        $scope.hydraForm.data = {};
        $scope.hydraForm.data.fields = [];  

        $scope.indexAPIDoc = function () {
            // Produces indexes for the current API doc
            var apiDoc = angular.isArray($scope.apiDoc) ? $scope.apiDoc[0] : $scope.apiDoc,
                supportedClass = apiDoc[hydraNs.supportedClass],
                classIndex = 0,
                propIndex = 0,
                cls = null,
                supportProps = [],
                supportProp = null,
                numSupportProps = 0,
                prop = null,
                propId = null;

            // Reset existing settings
            $scope.hydraClassesLookup = {};
            $scope.supportedPropertiesLookup = {};

            for (classIndex = 0; classIndex < supportedClass.length; classIndex++) {
                cls = supportedClass[classIndex];
                $scope.hydraClassesLookup[cls["@id"]] = cls;
                supportProps = cls[hydraNs.supportedProperty];
                numSupportProps = typeof supportProps === "undefined" ? 0 : supportProps.length
                for (propIndex = 0; propIndex < numSupportProps; propIndex++) {
                    supportProp = supportProps[propIndex];
                    prop = getProperty(supportProp);
                    if (prop && prop["@id"]) {
                        propId = prop["@id"];
                        $scope.supportedPropertiesLookup[propId] = supportProp;
                    }
                }
            }
        };

        $scope.resetPage = function () {
            $scope.links = [];
            $scope.title = "";
        };
         
        $scope.loadPage = function (url) {
            $scope.content = "Going to load " + url;
            $scope.resetPage();
            
            $http.get(url)
                .success(function (data, status, headers, config) {
                    //console.log(data);

                    // Expand the context
                    jsonldPromises.expand(data)
                        .then(function (expanded) {
                            console.log("Expanded entry point");
                            console.log(expanded);
                            // Save 
                            $scope.currentData = expanded;

                            // ToDo: find API Doc from entry point context
                            // See: http://lists.w3.org/Archives/Public/public-hydra/2014May/0003.html
                            // "you would reference the API documentation via an HTTP Link header"
                            var apiDocURL = 'http://0.0.0.0:6543/hydra/api-doc';
                            $scope.loadAPIDoc(apiDocURL);
                        }, 
                        function (err) {
                            throw "There was an error expanding the entry point data";
                        });
                    
                })
                .error(function(data, status, headers, config) {
                    throw "There was an error getting Entry Point";
                });
        };

        $scope.loadAPIDoc = function (apiDocURL) {
            $http.get(apiDocURL)
                .success(function (data, status, headers, config) {
                    
                    //console.log(data);

                    // Expand the context
                    jsonldPromises.expand(data)
                        .then(function (expanded) {
                            console.log("Expanded API doc");
                            console.log(expanded);
                            // Save and index
                            $scope.apiDoc = expanded;
                            $scope.indexAPIDoc();

                            // Load the page
                            $scope.showPage();
                        }, 
                        function (err) {
                            throw "There was an error expanding API Doc";
                        });
                })
                .error(function(data, status, headers, config) {
                    throw "There was an error getting API Doc";
                });
        };

        $scope.showPage = function () {
            // Load page from current data
            var currentData = angular.isArray($scope.currentData) ? $scope.currentData[0] : $scope.currentData,
                pageTypes = [],
                hydraCls = null,
                index = 0,
                prop = null,
                linkVal = "";
            $scope.areLinksVisible = true;
            $scope.isFormVisible = false;

            console.log("currentData");
            console.log(currentData);

            pageTypes = jsonLd.getValues(currentData, "@type");
            hydraCls = $scope.lookupHydraClass(pageTypes);
            console.log("class");
            console.log(hydraCls);
            $scope.title = jsonldHelper.getLiteralValue(hydraCls, rdfsNs.label);
            
            angular.forEach(currentData, function (value, key) {
                console.log(key);
                if (key.indexOf("@") === 0) {
                    return;
                } else {
                    // Check if item is a SupportedProperty
                    prop = $scope.lookupProperty(key);
                    // ToDo: check type of SupportedProperty
                    linkVal = jsonldHelper.getIdValue(value);
                    $scope.$apply($scope.links.push({url: linkVal, prop: prop}));
                }
            });

        };

        // Form
        $scope.showForm = function (url, prop, method) {
            // Load page from current data
            var currentData = angular.isArray($scope.currentData) ? $scope.currentData[0] : $scope.currentData,
                //pageTypes = [],
                payloadTypes = [],
                formCls = null,
                index = 0,
                // Find the operation in the property
                suppOp = getSupportedOperation(prop, method),
                formSuppProps = [],
                linkVal = "";

            if (suppOp == null) {
                throw "Can't build form, no supported operation in property with the method '" + method + "'";
            }

            $scope.areLinksVisible = false;
            $scope.isFormVisible = true;
            $scope.title = jsonldHelper.getLiteralValue(suppOp, rdfsNs.label);

            console.log("form property");
            console.log(prop);
            console.log("form op");
            console.log(suppOp);

            // Lookup the hydra:Class which provides the form details
            payloadTypes = jsonLd.getValues(suppOp, hydraNs.expects);
            if (payloadTypes) {
                for (index = 0; index < payloadTypes.length; index++) {
                    //console.log("Before");
                    //console.log(payloadTypes[index]);
                    payloadTypes[index] = jsonldHelper.getIdValue(payloadTypes[index]);
                    //console.log("After");
                    //console.log(payloadTypes[index]);
                }
            }
            

            //console.log("payloadTypes");
            //console.log(payloadTypes);

            //pageTypes = jsonLd.getValues(currentData, "@type");
            formCls = $scope.lookupHydraClass(payloadTypes);

            console.log("form class");
            console.log(formCls);

            console.log("form url");
            console.log(url);

            formSuppProps = jsonLd.getValues(formCls, hydraNs.supportedProperty);
            console.log("form items");
            console.log(formSuppProps);

            //$scope.formURL = url;
            $scope.formURL = $sce.trustAsResourceUrl(url);
            $scope.formMethod = method;

            // Note: used following as basis for dynamic form elements:
            // http://jsfiddle.net/langdonx/6H8Xx/2/
            angular.forEach(formSuppProps, function (value, key) {
                $scope.hydraForm.data.fields.push(value);
            });
        };

        $scope.submitForm = function () {
            var formData = {},
                jsonData = {},
                url = $scope.formURL,
                method = $scope.formMethod,
                requestHeaders = {"Content-Type": "application/json"};
            //console.log("Form test");
            //console.log($scope.hydraForm.data);
            angular.forEach($scope.hydraForm.data.fields, function (suppProp, key) {
                var fieldName = $scope.getSupportedPropertyPropertyId(suppProp)
                    fieldValue = suppProp.data;
                if (typeof fieldValue !== 'undefined') {
                    formData[fieldName] = fieldValue;
                }                    
                //console.log(suppProp);
            });
            console.log("formData");
            console.log(formData);

            jsonData = JSON.stringify(formData);
            $http({
                method: method, 
                url: url, 
                data: jsonData, 
                headers: requestHeaders})
                .success(function(data, status, headers, config) {
                    console.log("Got data back");
                    console.log(data);
                })
                .error(function(data, status, headers, config) {
                    console.log("Error");
                    console.log(status);
                });
        };

        $scope.lookupHydraClass = function (types) {
            // Finds a hydra class
            var hydraCls = null,
                tmpHydraCls = null;
            if (types) {
                for (index = 0; index < types.length; index++) {
                    tmpHydraCls = $scope.hydraClassesLookup[types[index]];
                    if (typeof hydraCls !== "undefined") {
                        hydraCls = tmpHydraCls;
                        break;
                    }
                }
            }
            return hydraCls;
        };

        $scope.lookupSupportedProperty = function (iri) {
            // Find the API Property with the given expanded IRI
            return $scope.supportedPropertiesLookup[iri] || null;
        };

        $scope.lookupProperty = function (suppPropIRI) {
            // Find the API Property with the given expanded IRI
            var supportProp = $scope.lookupSupportedProperty(suppPropIRI),
                prop = null;
            if (supportProp != null) {
                prop = getProperty(supportProp);
            }
            return prop;
        };

        // Helper functions for display
        $scope.rdfsNs = rdfsNs;

        var getProperty = function (supportProp) {
            return angular.isArray(supportProp[hydraNs.property]) ? supportProp[hydraNs.property][0] : supportProp[hydraNs.property];
        };

        $scope.getSupportedPropertyLabel = function (suppProp) {
            var prop = getProperty(suppProp);
            if (prop == null) {
                return "Unknown";
            }
            return jsonldHelper.getLiteralValue(prop, rdfsNs.label)
        };

        $scope.getSupportedPropertyPropertyId = function (suppProp) {
            // Gets the id of the property belonging to the SupportedProperty
            var prop = getProperty(suppProp);
            if (prop == null) {
                throw "SupportedProperty doesn't have a property so unable to fetch id."
            }
            return jsonldHelper.getIdValue(prop, "@id")
        };

        $scope.getLiteralValue = function (subject, predicate) {
            return jsonldHelper.getLiteralValue(subject, predicate);
        };

        var getSupportedOperation = function (prop, method) {
            var suppOps = jsonLd.getValues(prop, hydraNs.supportedOperation),
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

        var hasOperationMethod = function (prop, method) {
            // Whether the hydra:property has the operation method
            //var suppOps = jsonldHelper.getValue(prop, hydraNs.supportedOperation),
            var suppOp = getSupportedOperation(prop, method);
            return suppOp ? true : false;
        };

        $scope.hasGET = function (prop) {
            // Whether the hydra:property has a GET operation
            return hasOperationMethod(prop, "GET");
        };
        $scope.hasPOST = function (prop) {
            // Whether the hydra:property has a POST operation
            return hasOperationMethod(prop, "POST");
        };
    });

