"use strict";

const _ = require("underscore");
const EventEmitter = require("events").EventEmitter;
const validations = require("./validations");


function Model(attrs, opts) {
    const self = this;

    self.attrs = attrs;
    self.modelMethods = opts && opts.methods || {};
    self.validations = opts && opts.validations || {};
    self.initializer = opts && opts.initializer;
    self.hooks = opts && opts.hooks || {};
    self.table = opts && opts.table || null;

    Object.keys(attrs).forEach(function(attrName) {
        const attr = attrs[attrName];

        if (!attr.hasOwnProperty("column")) {
            attr.column = attrName;
        }

        if (attr.id) {
            self.id = attrName;
        }
    });

    self.modelConstructor = function(attrs) {
        const self = this;

        ModelInstance.call(self, attrs, _.toArray(arguments).slice(1));

        return self.proxy;
    };

    self.modelConstructor.prototype = self;
}

Model.prototype = {
    attrs: null,
    modelMethods: null,
    validations: null,
    initializer: null,
    hooks: null,
    table: null,
    id: null,
    modelConstructor: null,

    baseMethods: {
        checkpoint: function() {
            const self = this;

            self.values.original = {};
        },

        hasChanged: function(name) {
            const self = this;

            return self.values.original.hasOwnProperty(name);
        },

        attr: function(name) {
            const self = this;

            if (typeof name === "string") {
                return self.values.current[name];
            } else if (_.isArray(name)) {
                return name.reduce(function(o, name) {
                    if (self.values.current.hasOwnProperty(name)) {
                        o[name] = self.values.current[name];
                    }

                    return o;
                }, {});
            } else {
                return _.extend({}, self.values.current);
            }
        },

        changed: function(name) {
            const self = this;

            if (typeof name === "string") {
                if (self.values.original.hasOwnProperty(name)) {
                    return self.values.current[name];
                }
            } else if (_.isArray(name)) {
                return name.reduce(function(o, name) {
                    if (self.values.original.hasOwnProperty(name)) {
                        o[name] = self.values.current[name];
                    }

                    return o;
                }, {});
            } else {
                return Object.keys(self.values.original).reduce(function(o, name) {
                    o[name] = self.values.current[name];

                    return o;
                }, {});
            }
        },

        original: function(name) {
            const self = this;

            if (typeof name === "string") {
                return self.values.original[name];
            } else if (_.isArray(name)) {
                return name.reduce(function(o, name) {
                    if (self.values.original.hasOwnProperty(name)) {
                        o[name] = self.values.original[name];
                    }

                    return o;
                }, {});
            } else {
                return _.extend({}, self.values.original);
            }
        },

        validate: function() {
            const self = this;
            const failed = [];

            if (self.validations) {
                Object.keys(self.validations).forEach(function(prop) {
                    for (let i = 0; i < self.validations[prop].length; i++) {
                        const validation = self.validations[prop][i];
                        let fn;
                        let args = [self.values.current[prop]];

                        if (_.isArray(validation)) {
                            fn = validation[0];
                            args = args.concat(validation.slice(1));
                        } else if (typeof validation === "function") {
                            fn = validation;
                        } else {
                            throw new Error("Expected validation function, got " + validation);
                        }

                        const res = fn.apply(self, args);

                        if (!res[0]) {
                            failed.push([prop, res[1]]);
                        }
                    }
                });

            }

            if (failed.length > 0) {
                throw new validations.ValidationError(failed);
            }
        }
    }
};

function ModelInstance(attrs, argv) {
    const self = this;

    self.values = {
        current: {},
        original: {}
    };
    self.methods = _.extend({}, EventEmitter.prototype);

    Object.keys(self.baseMethods).forEach(function(k) {
        self.methods[k] = self.baseMethods[k].bind(self);
    });

    Object.keys(self.modelMethods).forEach(function(k) {
        self.methods[k] = self.modelMethods[k].bind(self);
    });

    EventEmitter.apply(self.methods);

    if (typeof self.initializer === "function") {
        self.initializer.apply(self, [attrs].concat(argv));
    }

    Object.keys(self.attrs).forEach(function(attrName) {
        let attr = self.attrs[attrName];
        let value = null;

        if (attrs && attrs.hasOwnProperty(attrName)) {
            value = attrs[attrName];
        } else if (attr.column && attrs && attrs.hasOwnProperty(attr.column)) {
            value = attrs[attr.column];
        } else if (typeof attr.default === "function") {
            value = attr.default();
        } else if (attr.defaultOfType) {
            value = new attr.type();
        } else if (attr.hasOwnProperty("default")) {
            value = attr.default;
        }

        self.values.current[attrName] = value;
    });

    /**
     * Creates a basic Proxy. This is an expansion on the basic no-op forwarding Proxy defined here:
     *
     * http://wiki.ecmascript.org/doku.php?id=harmony:proxies#examplea_no-op_forwarding_proxy
     */
    self.proxy = Proxy.create({
        getOwnPropertyDescriptor: function(name) {
            let desc = Object.getOwnPropertyDescriptor(self.values.current, name);

            if (typeof desc === "undefined") {
                desc = Object.getOwnPropertyDescriptor(self.methods, name);
            }

            // a trapping proxy's properties must always be configurable
            if (typeof desc !== "undefined") {
                desc.configurable = true;
            }

            return desc;
        },

        getPropertyDescriptor: function(name) {
            let desc = Object.getPropertyDescriptor(self.values.current, name); // not in ES5

            if (typeof desc === "undefined") {
                desc = Object.getPropertyDescriptor(self.methods, name);
            }

            // a trapping proxy's properties must always be configurable
            if (typeof desc !== "undefined") {
                desc.configurable = true;
            }

            return desc;
        },

        getOwnPropertyNames: function() {
            return Object.getOwnPropertyNames(self.values.current)
                .concat(Object.getOwnPropertyNames(self.methods));
        },

        getPropertyNames: function() {
            return Object.getPropertyNames(self.values.current)
                .concat(Object.getPropertyNames(self.methods)); // not in ES5
        },

        defineProperty: function(name, desc) {

        },

        "delete": function(name) {
            return true;
        },

        fix: function() {
        },

        has: function(name) {
            return name in self.values.current || name in self.methods;
        },

        hasOwn: function(name) {
            return self.values.current.hasOwnProperty(name) ||
                self.methods.hasOwnProperty(name);
        },

        get: function(receiver, name) {
            if (name === "__model__") {
                return self.__proto__;
            }

            if (name === "__self__") {
                return self;
            }

            if (name === "id" && self.id) {
                name = self.id;
            }

            if (name in self.values.current) {
                return self.values.current[name];
            } else if (name in self.methods) {
                return self.methods[name];
            }
        },

        set: function(receiver, name, val) {
            if (name === "id" && self.id) {
                name = self.id;
            }

            if (name in self.values.current) {
                if (!self.values.original.hasOwnProperty(name)) {
                    self.values.original[name] = self.values.current[name];
                } else if (val === self.values.original[name]) {
                    delete self.values.original[name];
                }

                self.values.current[name] = val;

                self.methods.emit("change:all", name, self.values.original[name], val);
                self.methods.emit("change:" + name, self.values.original[name], val);
            }

            return true; // bad behavior when set fails in non-strict mode
        },

        enumerate: function() {
            var result = [];

            for (var name in self.values.current) {
                result.push(name);
            }

            return result;
        },

        keys: function() {
            return Object.keys(self.values.current);
        }
    });
}

ModelInstance.prototype = {
    instance: null
};

function define(attrs, opts) {
    const m = new Model(attrs, opts);

    return m.modelConstructor;
}

const Types = {
    Serial: {},
    UUID: {}
};

module.exports = {
    define: define,
    Types: Types
};
