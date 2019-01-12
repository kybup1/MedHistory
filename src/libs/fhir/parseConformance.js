"use strict";
exports.__esModule = true;
var _ = require("underscore");
var fhir_1 = require("./fhir");
var ParseConformance = (function () {
    function ParseConformance(loadCached, version) {
        this.parsedStructureDefinitions = loadCached ? require('./profiles/types.json') : {};
        this.parsedValueSets = loadCached ? require('./profiles/valuesets.json') : {};
        this.version = version || fhir_1.Versions.R4;
        this.codeSystems = [];
    }
    ParseConformance.prototype.sortValueSetDependencies = function (valueSets) {
        var ret = [];
        function addValueSet(valueSetUrl) {
            var foundValueSet = _.find(valueSets, function (nextValueSet) {
                return nextValueSet.url === valueSetUrl;
            });
            if (!foundValueSet) {
                return;
            }
            if (foundValueSet.compose) {
                _.each(foundValueSet.compose.include, function (include) {
                    addValueSet(include.valueSet);
                });
            }
            if (ret.indexOf(foundValueSet) < 0) {
                ret.push(foundValueSet);
            }
        }
        _.each(valueSets, function (valueSet) {
            addValueSet(valueSet.url);
        });
        return ret;
    };
    ParseConformance.prototype.loadCodeSystem = function (codeSystem) {
        if (!codeSystem) {
            return;
        }
        var foundCodeSystem = _.find(this.codeSystems, function (nextCodeSystem) {
            return nextCodeSystem.url === codeSystem.url || nextCodeSystem.id === codeSystem.id;
        });
        if (!foundCodeSystem) {
            this.codeSystems.push(codeSystem);
        }
    };
    ;
    ParseConformance.prototype.parseBundle = function (bundle) {
        var _this = this;
        if (!bundle || !bundle.entry) {
            return;
        }
        _.chain(bundle.entry)
            .filter(function (entry) {
            return entry.resource.resourceType === 'CodeSystem';
        })
            .each(function (entry) {
            _this.loadCodeSystem(entry.resource);
        });
        var valueSets = _.chain(bundle.entry)
            .filter(function (entry) {
            return entry.resource.resourceType === 'ValueSet';
        })
            .map(function (entry) {
            return entry.resource;
        })
            .value();
        valueSets = this.sortValueSetDependencies(valueSets);
        _.each(valueSets, function (valueSet) {
            _this.parseValueSet(valueSet);
        });
        _.chain(bundle.entry)
            .filter(function (entry) {
            if (entry.resource.resourceType !== 'StructureDefinition') {
                return false;
            }
            var resource = entry.resource;
            return !(resource.kind != 'resource' && resource.kind != 'complex-type' && resource.kind != 'primitive-type');
        })
            .each(function (entry) {
            _this.parseStructureDefinition(entry.resource);
        });
    };
    ParseConformance.prototype.parseStructureDefinition = function (structureDefinition) {
        var parsedStructureDefinition = {
            _type: 'Resource',
            _kind: structureDefinition.kind,
            _properties: []
        };
        this.parsedStructureDefinitions[structureDefinition.id] = parsedStructureDefinition;
        if (structureDefinition.snapshot && structureDefinition.snapshot.element) {
            for (var x in structureDefinition.snapshot.element) {
                var element = structureDefinition.snapshot.element[x];
                var elementId = structureDefinition.snapshot.element[x].id;
                elementId = elementId.substring(structureDefinition.id.length + 1);
                if (!element.max) {
                    throw 'Expected all base resource elements to have a max value';
                }
                if (!elementId || elementId.indexOf('.') > 0 || !element.type) {
                    continue;
                }
                if (element.type.length === 1) {
                    var newProperty = {
                        _name: elementId,
                        _type: element.type[0].code || 'string',
                        _multiple: element.max !== '1',
                        _required: element.min === 1
                    };
                    parsedStructureDefinition._properties.push(newProperty);
                    this.populateValueSet(element, newProperty);
                    if (element.type[0].code == 'BackboneElement' || element.type[0].code == 'Element') {
                        newProperty._properties = [];
                        this.populateBackboneElement(parsedStructureDefinition, structureDefinition.snapshot.element[x].id, structureDefinition);
                    }
                }
                else if (elementId.endsWith('[x]')) {
                    elementId = elementId.substring(0, elementId.length - 3);
                    for (var y in element.type) {
                        var choiceType = element.type[y].code;
                        choiceType = choiceType.substring(0, 1).toUpperCase() + choiceType.substring(1);
                        var choiceElementId = elementId + choiceType;
                        var newProperty = {
                            _name: choiceElementId,
                            _choice: elementId,
                            _type: element.type[y].code,
                            _multiple: element.max !== '1',
                            _required: element.min === 1
                        };
                        this.populateValueSet(element, newProperty);
                        parsedStructureDefinition._properties.push(newProperty);
                    }
                }
                else {
                    var isReference = true;
                    for (var y in element.type) {
                        if (element.type[y].code !== 'Reference') {
                            isReference = false;
                            break;
                        }
                    }
                    if (isReference) {
                        parsedStructureDefinition._properties.push({
                            _name: elementId,
                            _type: 'Reference',
                            _multiple: element.max !== '1'
                        });
                    }
                    else {
                        console.log(elementId);
                    }
                }
            }
        }
        return parsedStructureDefinition;
    };
    ParseConformance.prototype.parseValueSet = function (valueSet) {
        var newValueSet = {
            systems: []
        };
        if (valueSet.expansion && valueSet.expansion.contains) {
            var _loop_1 = function (i) {
                var contains = valueSet.expansion.contains[i];
                if (contains.inactive || contains.abstract) {
                    return "continue";
                }
                var foundSystem = _.find(newValueSet.systems, function (system) {
                    return system.uri === contains.system;
                });
                if (!foundSystem) {
                    foundSystem = {
                        uri: contains.system,
                        codes: []
                    };
                    newValueSet.systems.push(foundSystem);
                }
                foundSystem.codes.push({
                    code: contains.code,
                    display: contains.display
                });
            };
            for (var i = 0; i < valueSet.expansion.contains.length; i++) {
                _loop_1(i);
            }
        }
        else if (valueSet.compose) {
            var _loop_2 = function (i) {
                var include = valueSet.compose.include[i];
                if (include.system) {
                    var foundSystem = _.find(newValueSet.systems, function (system) {
                        return system.uri === include.system;
                    });
                    if (!foundSystem) {
                        foundSystem = {
                            uri: include.system,
                            codes: []
                        };
                        newValueSet.systems.push(foundSystem);
                    }
                    var foundCodeSystem = _.find(this_1.codeSystems, function (codeSystem) {
                        return codeSystem.url === include.system;
                    });
                    if (foundCodeSystem) {
                        var codes = _.map(foundCodeSystem.concept, function (concept) {
                            return {
                                code: concept.code,
                                display: concept.display
                            };
                        });
                        foundSystem.codes = foundSystem.codes.concat(codes);
                    }
                }
                if (include.valueSet) {
                    var includeValueSet = this_1.parsedValueSets[include.valueSet];
                    if (includeValueSet) {
                        _.each(includeValueSet.systems, function (includeSystem) {
                            var foundSystem = _.find(newValueSet.systems, function (nextSystem) {
                                return nextSystem.uri === includeSystem.uri;
                            });
                            if (!foundSystem) {
                                newValueSet.systems.push({
                                    uri: includeSystem.uri,
                                    codes: [].concat(includeSystem.codes)
                                });
                            }
                            else {
                                foundSystem.codes = foundSystem.codes.concat(includeSystem.codes);
                            }
                        });
                    }
                }
                if (include.concept) {
                    var systemUri_1 = include.system || '';
                    var foundSystem = _.find(newValueSet.systems, function (nextSystem) {
                        return nextSystem.uri === systemUri_1;
                    });
                    if (!foundSystem) {
                        foundSystem = {
                            uri: systemUri_1,
                            codes: []
                        };
                        newValueSet.systems.push(foundSystem);
                    }
                    var codes = _.map(include.concept, function (concept) {
                        return {
                            code: concept.code,
                            display: concept.display
                        };
                    });
                    foundSystem.codes = foundSystem.codes.concat(codes);
                }
            };
            var this_1 = this;
            for (var i = 0; i < valueSet.compose.include.length; i++) {
                _loop_2(i);
            }
        }
        var systemsWithCodes = _.filter(newValueSet.systems, function (system) {
            return system.codes && system.codes.length > 0;
        });
        if (systemsWithCodes.length > 0) {
            this.parsedValueSets[valueSet.url] = newValueSet;
            return newValueSet;
        }
    };
    ParseConformance.prototype.populateValueSet = function (element, property) {
        if (element.binding) {
            var binding = element.binding;
            if (binding.strength) {
                property._valueSetStrength = binding.strength;
            }
            if (this.version === fhir_1.Versions.R4 && binding.valueSet) {
                property._valueSet = binding.valueSet;
            }
            else if (this.version === fhir_1.Versions.STU3 && binding.valueSetReference && binding.valueSetReference.reference) {
                property._valueSet = binding.valueSetReference.reference;
            }
        }
    };
    ParseConformance.prototype.populateBackboneElement = function (resourceType, parentElementId, profile) {
        var _loop_3 = function (y) {
            var backboneElement = profile.snapshot.element[y];
            var backboneElementId = backboneElement.id;
            if (!backboneElementId.startsWith(parentElementId + '.') || backboneElementId.split('.').length !== parentElementId.split('.').length + 1) {
                return "continue";
            }
            backboneElementId = backboneElementId.substring(profile.id.length + 1);
            var parentElementIdSplit = parentElementId.substring(profile.id.length + 1).split('.');
            var parentBackboneElement = null;
            var _loop_4 = function (j) {
                parentBackboneElement = _.find(!parentBackboneElement ? resourceType._properties : parentBackboneElement._properties, function (property) {
                    return property._name == parentElementIdSplit[j];
                });
                if (!parentBackboneElement) {
                    throw 'Parent backbone element not found';
                }
            };
            for (var j = 0; j < parentElementIdSplit.length; j++) {
                _loop_4(j);
            }
            if (parentBackboneElement) {
                if (!backboneElement.type) {
                    var type = 'string';
                    if (backboneElement.contentReference) {
                        type = backboneElement.contentReference;
                    }
                    parentBackboneElement._properties.push({
                        _name: backboneElementId.substring(backboneElementId.lastIndexOf('.') + 1),
                        _type: type,
                        _multiple: backboneElement.max !== '1',
                        _required: backboneElement.min === 1
                    });
                }
                else if (backboneElement.type.length == 1) {
                    var newProperty = {
                        _name: backboneElementId.substring(backboneElementId.lastIndexOf('.') + 1),
                        _type: backboneElement.type[0].code,
                        _multiple: backboneElement.max !== '1',
                        _required: backboneElement.min === 1,
                        _properties: []
                    };
                    parentBackboneElement._properties.push(newProperty);
                    this_2.populateValueSet(backboneElement, newProperty);
                    if (backboneElement.type[0].code === 'BackboneElement' || backboneElement.type[0].code == 'Element') {
                        this_2.populateBackboneElement(resourceType, profile.snapshot.element[y].id, profile);
                    }
                }
                else if (backboneElement.id.endsWith('[x]')) {
                    for (var y_1 in backboneElement.type) {
                        var choiceType = backboneElement.type[y_1].code;
                        choiceType = choiceType.substring(0, 1).toUpperCase() + choiceType.substring(1);
                        var choiceElementId = backboneElement.id.substring(backboneElement.id.lastIndexOf('.') + 1, backboneElement.id.length - 3) + choiceType;
                        var newProperty = {
                            _name: choiceElementId,
                            _choice: backboneElement.id.substring(backboneElement.id.lastIndexOf('.') + 1),
                            _type: backboneElement.type[y_1].code,
                            _multiple: backboneElement.max !== '1',
                            _required: backboneElement.min === 1
                        };
                        parentBackboneElement._properties.push(newProperty);
                        this_2.populateValueSet(backboneElement, newProperty);
                    }
                }
                else {
                    var isReference = true;
                    for (var z in backboneElement.type) {
                        if (backboneElement.type[z].code !== 'Reference') {
                            isReference = false;
                            break;
                        }
                    }
                    if (!isReference) {
                        throw 'Did not find a reference... not sure what to do';
                    }
                    var newProperty = {
                        _name: backboneElementId.substring(backboneElementId.lastIndexOf('.') + 1),
                        _type: 'Reference',
                        _multiple: backboneElement.max !== '1',
                        _required: backboneElement.min === 1
                    };
                    parentBackboneElement._properties.push(newProperty);
                    this_2.populateValueSet(backboneElement, newProperty);
                }
            }
            else {
                throw 'Unexpected backbone parent element id';
            }
        };
        var this_2 = this;
        for (var y in profile.snapshot.element) {
            _loop_3(y);
        }
    };
    return ParseConformance;
}());
exports.ParseConformance = ParseConformance;
//# sourceMappingURL=parseConformance.js.map