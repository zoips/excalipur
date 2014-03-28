"use strict";

const assert = require("assert");
const Model = require("../src/model");
const validations = require("../src/validations");

describe("base model", function() {

    it("can define a model", function() {
        const TestA = Model.define({
            name: { type: String },
            createdDate: { type: Date },
            modifiedDate: { type: Date }
        });

        assert.ok(typeof TestA === "function", "should be defined");
    });

    it("can instantiate a model", function() {
        const TestA = Model.define({
            name: { type: String },
            createdDate: { type: Date },
            modifiedDate: { type: Date }
        });
        const t = new TestA();

        assert.ok(typeof t === "object", "should be instantiated");
    });

    it("can get the model definition from a model instance", function() {
        const TestA = Model.define({
            name: { type: String },
            createdDate: { type: Date },
            modifiedDate: { type: Date }
        });
        const t = new TestA();

        assert.ok(typeof t.__model__ === "object", "should be the model definition");
    });

    it("instantiates models with default values", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            createdDate: { type: Date, defaultOfType: true },
            modifiedDate: { type: Date, default: function() { return new Date(); } }
        });
        const t = new TestA();

        assert.strictEqual(t.name, null, "name should be null");
        assert.strictEqual(t.description, "", "description should be an empty string");
        assert.ok(t.createdDate instanceof Date, "createdDate should be a date");
        assert.ok(t.modifiedDate instanceof Date, "modifiedDate should be a date");
    });

    it("picks out the id attribute", function() {
        const TestA = Model.define({
            name: { type: String, id: true },
            description: { type: String, default: "" },
            createdDate: { type: Date, defaultOfType: true },
            modifiedDate: { type: Date, default: function() { return new Date(); } }
        });
        const t = new TestA({ name: "foo", description: "bar" });

        assert.strictEqual(t.id, "foo", "id should be returned");
        assert.strictEqual(t.id, t.name, "id should be the same as the attribute");

        t.id = "not foo";

        assert.strictEqual(t.id, "not foo", "id should have changed");
        assert.strictEqual(t.id, t.name, "id should be the same as the attribute");
    });

    it("instantiates models with mixed defaults and supplied values", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            createdDate: { type: Date, defaultOfType: true },
            modifiedDate: { type: Date, defaultOfType: true }
        });
        const t = new TestA({ name: "foo", description: "bar" });

        assert.strictEqual(t.name, "foo", "name should be set");
        assert.strictEqual(t.description, "bar", "description should be set");
        assert.ok(t.createdDate instanceof Date, "createdDate should be a date");
        assert.ok(t.modifiedDate instanceof Date, "modifiedDate should be a date");
    });

    it("tracks changed values", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            createdDate: { type: Date },
            modifiedDate: { type: Date }
        });
        const t = new TestA({ name: "foo", description: "bar" });

        t.name = "not foo";

        assert.strictEqual(t.name, "not foo", "name should have changed");
        assert.ok(t.hasChanged("name"), "should indicate name has changed");
        assert.strictEqual(t.original("name"), "foo", "should have returned the original value");

        t.name = "still not foo";

        assert.strictEqual(t.name, "still not foo", "name should have changed");
        assert.ok(t.hasChanged("name"), "should indicate name has changed");
        assert.strictEqual(t.original("name"), "foo", "should have returned the original value");
    });

    it("gives you the current values for changed attributes", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            createdDate: { type: Date },
            modifiedDate: { type: Date }
        });
        const t = new TestA({ name: "foo" });

        t.name = "not foo";
        t.description = "not bar";

        const changed = t.changed();

        assert.strictEqual(2, Object.keys(changed).length, "should have two changed attributes");
        assert.strictEqual(changed.name, "not foo", "should have new value");
        assert.strictEqual(changed.description, "not bar", "should have new value");
    });

    it("all values are changed on a new model", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            createdDate: { type: Date },
            modifiedDate: { type: Date }
        });
        const t = new TestA();

        t.name = "foo";
        t.description = "bar";

        const changed = t.original();

        assert.ok(typeof changed === "object" && changed !== null, "should have returned changed object");
        assert.equal(Object.keys(changed).length, 2, "should have two changed keys");
        assert.ok(changed.hasOwnProperty("name"), "should have name");
        assert.ok(changed.hasOwnProperty("description"), "should have description");
    });

    it("marks changed value as unchanged if set back to the original value", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            createdDate: { type: Date },
            modifiedDate: { type: Date }
        });
        const t = new TestA({ name: "foo", description: "bar" });

        t.name = "not foo";

        assert.strictEqual(t.name, "not foo", "name should have changed");
        assert.ok(t.hasChanged("name"), "should indicate name has changed");
        assert.strictEqual(t.original("name"), "foo", "should have returned the original value");

        t.name = "foo";

        assert.strictEqual(t.name, "foo", "name should have changed");
        assert.ok(!t.hasChanged("name"), "should indicate name hasn't changed");
        assert.ok(typeof t.original("name") === "undefined", "should have returned undefined for the original value");
    });

    it("returns all changed when no attribute specified", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            createdDate: { type: Date },
            modifiedDate: { type: Date }
        });
        const t = new TestA();

        t.name = "foo";
        t.description = "bar";

        const changed = t.original();

        assert.ok(typeof changed === "object" && changed !== null, "should have returned changed object");
        assert.equal(Object.keys(changed).length, 2, "should only have two changed keys");
        assert.ok(changed.hasOwnProperty("name"), "should have name");
        assert.ok(changed.hasOwnProperty("description"), "should have description");
    });

    it("returns only changed in specified list of attributes", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            createdDate: { type: Date },
            modifiedDate: { type: Date }
        });
        const t = new TestA();

        t.name = "foo";
        t.description = "bar";
        t.modifiedDate = new Date();

        const changed = t.original(["name", "description"]);

        assert.ok(typeof changed === "object" && changed !== null, "should have returned changed object");
        assert.equal(Object.keys(changed).length, 2, "should only have two changed keys");
        assert.ok(changed.hasOwnProperty("name"), "should have name");
        assert.ok(changed.hasOwnProperty("description"), "should have description");
    });

    it("resets original state when told a checkpoint has been hit", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            createdDate: { type: Date },
            modifiedDate: { type: Date }
        });
        const t = new TestA();

        t.name = "foo";
        t.description = "bar";

        const changed = t.original();

        assert.ok(typeof changed === "object" && changed !== null, "should have returned changed object");
        assert.equal(Object.keys(changed).length, 2, "should only have two changed keys");

        t.checkpoint();

        const changed2 = t.original();

        assert.ok(typeof changed2 === "object" && changed2 !== null, "should have returned changed object");
        assert.equal(Object.keys(changed2).length, 0, "should have zero changed keys");
    });

    it("doesn't let you set properties that aren't specified attributes", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            createdDate: { type: Date },
            modifiedDate: { type: Date }
        });
        const t = new TestA();

        assert.ok(typeof t.foo === "undefined", "foo should be undefined");

        t.foo = "stuff";

        assert.ok(typeof t.foo === "undefined", "foo should be undefined");
    });

    it("puts methods on the model instances", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            createdDate: { type: Date },
            modifiedDate: { type: Date }
        }, {
            methods: {
                capName: function() {
                    return this.values.current.name.toUpperCase();
                }
            }
        });
        const t = new TestA({ name: "foo" });

        assert.strictEqual(t.capName(), "FOO", "should capitalize name");
    });

    it("throws on simple validation error", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            createdDate: { type: Date }
        }, {
            validations: {
                name: [validations.isString],
                description: [validations.isString],
                createdDate: [validations.isDate]
            }
        });
        const t = new TestA({ createdDate: new Date() });

        try {
            t.validate();

            assert.fail("validation should have failed");
        } catch (ex) {
            assert.equal(ex.failed.length, 1);
            assert.equal(ex.failed[0][0], "name");
        }
    });

    it("throws on validation error with validation args", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            rating: { type: Number },
            createdDate: { type: Date }
        }, {
            validations: {
                name: [validations.isString],
                description: [validations.isString],
                rating: [[validations.isInRange, 0, 10]],
                createdDate: [validations.isDate]
            }
        });
        const t = new TestA({ name: "test", rating: 11, createdDate: new Date() });

        try {
            t.validate();

            assert.fail("validation should have failed");
        } catch (ex) {
            assert.equal(ex.failed.length, 1);
            assert.equal(ex.failed[0][0], "rating");
        }
    });

    it("throws on validation error when passes on validation but fails other", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            rating: { type: Number },
            createdDate: { type: Date }
        }, {
            validations: {
                name: [validations.isNotNull, validations.isString],
                description: [validations.isString],
                createdDate: [validations.isDate]
            }
        });
        const t = new TestA({ name: 55, createdDate: new Date() });

        try {
            t.validate();

            assert.fail("validation should have failed");
        } catch (ex) {
            assert.equal(ex.failed.length, 1);
            assert.equal(ex.failed[0][0], "name");
            assert.equal(ex.failed[0][1], "expected string");
        }
    });

    it("throws on validation error for multiple validation failures", function() {
        const TestA = Model.define({
            name: { type: String },
            description: { type: String, default: "" },
            rating: { type: Number },
            createdDate: { type: Date }
        }, {
            validations: {
                name: [validations.isNotNull, validations.isString],
                description: [validations.isString],
                rating: [[validations.isInRange, 0, 10]],
                createdDate: [validations.isDate]
            }
        });
        const t = new TestA({ name: 55, rating: 11, createdDate: new Date() });

        try {
            t.validate();

            assert.fail("validation should have failed");
        } catch (ex) {
            let found = 0;
            let shouldHave = {name: 1, rating: 1};

            assert.equal(ex.failed.length, 2);

            for (let i = 0; i < ex.failed.length; i++) {
                if (ex.failed[i][0] in shouldHave) {
                    found++;
                }
            }

            assert.equal(found, 2);
        }
    });
});
