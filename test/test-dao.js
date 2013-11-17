"use strict";

const pg = require("pg");
const util = require("util");
const assert = require("assert");
const DAO = require("../src/dao");
const Q = require("q");
const Model = require("../src/model");
const squel = require("squel");

const TestType = Model.define({
    id: { type: Model.Types.Serial, id: true },
    name: { type: String },
    description: { type: String, default: "" }
}, {
    table: "test_types"
});

function TestTypeDAO() {
    const self = this;

    DAO.apply(self, [TestType.prototype].concat(arguments));
}

TestTypeDAO.prototype = Object.create(DAO.prototype);

describe("test type dao", function() {

    const client = new pg.Client(util.format("postgres://%s:%s@localhost/excalipur_test", process.env["DB_USER"], process.env["DB_PASSWORD"]));
    const dao = new TestTypeDAO();

    before(function(done) {
        Q.spawn(function*() {
            try {
                yield Q.ninvoke(client, "connect");
                //yield Q.ninvoke(client, "query", "SET search_path = test,public");

                done(null);
            } catch (ex) {
                done(ex);
            }
        });
    });

    describe("#save", function() {
        it("can save", function(done) {
            Q.spawn(function*() {
                try {
                    let complete = false;

                    yield DAO.inTransaction(client, Q.async(function*() {
                        const m = new TestType({ name: "test thingy", "description": "cool awesome thingy" });
                        const m2 = yield dao.save(client, m, { schema: "test" });

                        assert.strictEqual(m2.name, m.name, "name should be equal");
                        assert.strictEqual(m2.description, m.description, "description should be equal");
                        assert.ok(typeof m.id === "number", "id should be set");

                        complete = true;
                    }), { readOnly: true });

                    assert.ok(complete, "did not complete");
                    done(null);
                } catch (ex) {
                    done(ex);
                }
            });
        });
    });

    describe("#get", function() {

        let model;

        beforeEach(function(done) {
            Q.spawn(function*() {
                try {
                    yield Q.ninvoke(client, "query", "BEGIN;");

                    model = yield dao.save(client, new TestType({
                        name: "test thingy",
                        description: "cool awesome thingy"
                    }), { schema: "test" });

                    done(null);
                } catch (ex) {
                    done(ex);
                }
            });
        });

        afterEach(function(done) {
            client.query("ROLLBACK;", done);
        });

        it("can get by id", function(done) {
            Q.spawn(function*() {
                try {
                    const m = yield dao.get(client, model.id, { schema: "test" });

                    assert.ok(m !== null, "model should be returned");
                    assert.strictEqual(m.id, model.id, "ids should be the same");
                    assert.strictEqual(m.name, model.name, "names should be the same");
                    assert.strictEqual(m.description, model.description, "descriptions should be the same");

                    done(null);
                } catch (ex) {
                    done(ex);
                }
            });
        });
    });

    describe("#update", function() {
        it("can update a model", function(done) {
            Q.spawn(function*() {
                try {
                    let complete = false;

                    yield DAO.inTransaction(client, Q.async(function*() {
                        const m = yield dao.save(client, new TestType({
                            name: "test thingy",
                            description:  "cool awesome thingy"
                        }), { schema: "test" });
                        const m2 = yield dao.get(client, m.id, { schema: "test" });

                        m2.name = "a cool new name";

                        yield dao.update(client, m2, { schema: "test" });

                        const m3 = yield dao.get(client, m.id, { schema: "test" });

                        assert.strictEqual(m3.id, m.id, "ids should be the same");
                        assert.strictEqual(m3.name, "a cool new name", "names should be the same");
                        assert.strictEqual(m3.description, m.description, "descriptions should be the same");

                        complete = true;
                    }), { readOnly: true });

                    assert.ok(complete, "did not complete");
                    done(null);
                } catch (ex) {
                    console.log(ex);
                    done(ex);
                }
            });
        });
    });

    describe("#destroy", function() {
        it("can destroy a model", function(done) {
            Q.spawn(function*() {
                try {
                    let complete = false;

                    yield DAO.inTransaction(client, Q.async(function*() {
                        const m = yield dao.save(client, new TestType({
                            name: "test thingy",
                            description: "cool awesome thingy"
                        }), { schema: "test" });

                        yield dao.destroy(client, m.id, { schema: "test" });

                        const m2 = yield dao.get(client, m.id, { schema: "test" });

                        assert.strictEqual(m2, null, "should be null");

                        complete = true;
                    }), { readOnly: true });

                    assert.ok(complete, "did not complete");
                    done(null);
                } catch (ex) {
                    console.log(ex);
                    done(ex);
                }
            });
        });
    });

    describe("#list", function() {
        const models = [];

        beforeEach(function(done) {
            Q.spawn(function*() {
                try {
                    yield Q.ninvoke(client, "query", "BEGIN;");

                    for (let i = 0; i < 10; i++) {
                        const model = yield dao.save(client, new TestType({
                            name: "test thingy " + (i + 1),
                            "description": "cool awesome thingy"
                        }), { schema: "test" });

                        models.push(model);
                    }

                    done(null);
                } catch (ex) {
                    done(ex);
                }
            });
        });

        afterEach(function(done) {
            client.query("ROLLBACK;", done);
            models.splice(0, models.length);
        });

        it("can list models", function(done) {
            Q.spawn(function*() {
                try {
                    const p = dao.list(client, { schema: "test" });
                    const resModels = [];

                    p.progress(function(m) {
                        resModels.push(m);
                    });

                    yield p;

                    assert.strictEqual(resModels.length, models.length, "should have listed all models");

                    let lookup = {};
                    let seen = {};

                    for (let i = 0; i < models.length; i++) {
                        lookup[models[i].id] = models[i];
                    }

                    for (let i = 0; i < resModels.length; i++) {
                        assert.ok(!seen.hasOwnProperty(resModels[i].id), "should not have duplicate models");
                        assert.ok(lookup.hasOwnProperty(resModels[i].id), "should not have unknown models in list");

                        seen[resModels[i].id] = resModels[i];
                    }

                    done(null);
                } catch (ex) {
                    done(ex);
                }
            });
        });

        it("can list models with offset and limit", function(done) {
            Q.spawn(function*() {
                try {
                    const resModels = [];
                    let offset = 0;
                    const seen = {};

                    while (resModels.length < models.length) {
                        const p = dao.list(client, { offset: offset, limit: 3, schema: "test" });
                        let c = 0;

                        p.progress(function(m) {
                            assert.ok(!seen.hasOwnProperty(m.id), "should not have duplicate models");
                            seen[m.id] = m;
                            resModels.push(m);

                            c++;
                        });

                        yield p;

                        offset += c;
                    }

                    assert.strictEqual(resModels.length, models.length, "should have listed all models");

                    let lookup = {};
                    let seen2 = {};

                    for (let i = 0; i < models.length; i++) {
                        lookup[models[i].id] = models[i];
                    }

                    for (let i = 0; i < resModels.length; i++) {
                        assert.ok(!seen2.hasOwnProperty(resModels[i].id), "should not have duplicate models");
                        assert.ok(lookup.hasOwnProperty(resModels[i].id), "should not have unknown models in list");

                        seen2[resModels[i].id] = resModels[i];
                    }

                    done(null);
                } catch (ex) {
                    done(ex);
                }
            });
        });
    });

    describe("#query", function() {
        const models = [];

        beforeEach(function(done) {
            Q.spawn(function*() {
                try {
                    yield Q.ninvoke(client, "query", "BEGIN;");

                    for (let i = 0; i < 10; i++) {
                        const model = yield dao.save(client, new TestType({
                            name: "test thingy " + (i + 1),
                            "description": "cool awesome thingy"
                        }), { schema: "test" });

                        models.push(model);
                    }

                    done(null);
                } catch (ex) {
                    done(ex);
                }
            });
        });

        afterEach(function(done) {
            client.query("ROLLBACK;", done);
            models.splice(0, models.length);
        });

        it("can query for a unique model", function(done) {
            Q.spawn(function*() {
                try {
                    const q = squel.select()
                        .from("test." + TestType.prototype.table)
                        .where(TestType.prototype.attrs.name.column + " = $1");
                    const m = yield dao.query(client, q, "test thingy 3").uniqueResult();

                    assert.ok(m !== null, "should have found a model");
                    assert.strictEqual(m.id, models[2].id, "should have found the third model");

                    done(null);
                } catch (ex) {
                    done(ex);
                }
            });
        });

        it("can query for multiple models", function(done) {
            Q.spawn(function*() {
                try {
                    const q = squel.select()
                        .from("test." + TestType.prototype.table)
                        .where(TestType.prototype.attrs.name.column + " IN ($1, $2)")
                        .order(TestType.prototype.attrs.name.column);
                    const res = [];

                    yield dao.query(client, q, "test thingy 3", "test thingy 5")
                        .progress(function(m) { res.push(m); });

                    assert.strictEqual(res.length, 2, "should have two models");
                    assert.strictEqual(res[0].name, "test thingy 3", "should have gotten test thingy 3");
                    assert.strictEqual(res[1].name, "test thingy 5", "should have gotten test thingy 5");

                    done(null);
                } catch (ex) {
                    done(ex);
                }
            });
        });

        it("can collect results when querying for multiple models", function(done) {
            Q.spawn(function*() {
                try {
                    const q = squel.select()
                        .from("test." + TestType.prototype.table)
                        .where(TestType.prototype.attrs.name.column + " IN ($1, $2)")
                        .order(TestType.prototype.attrs.name.column);
                    const res = yield dao.query(client, q, "test thingy 3", "test thingy 5")
                        .collectResults();

                    assert.strictEqual(res.length, 2, "should have two models");
                    assert.strictEqual(res[0].name, "test thingy 3", "should have gotten test thingy 3");
                    assert.strictEqual(res[1].name, "test thingy 5", "should have gotten test thingy 5");

                    done(null);
                } catch (ex) {
                    done(ex);
                }
            });
        });
    });
});