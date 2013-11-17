"use strict";

const squel = require("squel");
const Q = require("q");
const _ = require("underscore");

squel.useFlavour("postgres");

function DAO(model) {
    const self = this;

    self.model = model;
}

DAO.prototype = {
    model: null,

    save: Q.async(function*(conn, obj, opts) {
        const self = this;

        const model = obj.__model__;
        const preCreate = model.hooks.preCreate;
        const postCreate = model.hooks.postCreate;

        if (_.isArray(preCreate)) {
            for (let i = 0; i < preCreate.length; i++) {
                preCreate[i].call(obj.__self__);
            }
        }

        obj.validate();

        const attrs = obj.attr();
        const attrNames = Object.keys(attrs);
        const attrValues = [];
        const q = squel.insert({ usingValuePlaceholders: true })
            .into(opts && opts.schema ? opts.schema + "." + model.table : model.table);

        for (let i = 0, p = 0; i < attrNames.length; i++) {
            const attrName = attrNames[i];
            const columnName = model.attrs[attrNames[i]].column || attrName;
            const attrValue = attrs[attrName];

            if (attrName === model.id && (typeof attrValue === "undefined" || attrValue === null)) {
                continue;
            }

            q.set(columnName, "$" + (++p));
            attrValues.push(attrValue);
        }

        q.returning("*");

        const res = yield Q.ninvoke(conn, "query", q.toString(), attrValues);

        if (res.rows[0]) {
            const resAttrs = Object.keys(res.rows[0]);

            for (let i = 0; i < resAttrs.length; i++) {
                const attrName = resAttrs[i];

                obj[attrName] = res.rows[0][attrName];
            }
        }

        obj.checkpoint();

        if (_.isArray(postCreate)) {
            for (let i = 0; i < postCreate.length; i++) {
                postCreate[i].call(obj.__self__);
            }
        }

        return obj;
    }),

    update: Q.async(function*(conn, obj, opts) {
        const self = this;

        const model = obj.__model__;
        const preUpdate = model.hooks.preUpdate;
        const postUpdate = model.hooks.postUpdate;

        if (_.isArray(preUpdate)) {
            for (let i = 0; i < preUpdate.length; i++) {
                preUpdate[i].call(obj.__self__);
            }
        }

        obj.validate();

        const attrs = obj.changed();
        const attrNames = Object.keys(attrs);
        const values = [obj.id];
        const q = squel.update({ usingValuePlaceholders: true })
            .table(opts && opts.schema ? opts.schema + "." + model.table : model.table)
            .where(model.id + " = $1");

        for (let i = 0, p = 1; i < attrNames.length; i++) {
            const attrName = attrNames[i];
            const columnName = model.attrs[attrNames[i]].column || attrName;
            const attrValue = attrs[attrName];

            q.set(columnName, "$" + (++p));
            values.push(attrValue);
        }

        q.returning("*");

        const res = yield Q.ninvoke(conn, "query", q.toString(), values);

        if (res.rows[0]) {
            const resAttrs = Object.keys(res.rows[0]);

            for (let i = 0; i < resAttrs.length; i++) {
                const attrName = resAttrs[i];

                obj[attrName] = res.rows[0][attrName];
            }
        }

        obj.checkpoint();

        if (_.isArray(postUpdate)) {
            for (let i = 0; i < postUpdate.length; i++) {
                postUpdate[i].call(obj.__self__);
            }
        }
    }),

    destroy: Q.async(function*(conn, id, opts) {
        const self = this;
        const model = self.model;
        const q = squel.delete()
            .from(opts && opts.schema ? opts.schema + "." + model.table : model.table)
            .where(model.id + " = $1");
        const preDestroy = model.hooks.preDestroy;
        const postDestroy = model.hooks.postDestroy;

        if (_.isArray(preDestroy)) {
            for (let i = 0; i < preDestroy.length; i++) {
                preDestroy[i].call(obj.__self__);
            }
        }

        yield Q.ninvoke(conn, "query", q.toString(), [id]);

        if (_.isArray(postDestroy)) {
            for (let i = 0; i < postDestroy.length; i++) {
                postDestroy[i].call(obj.__self__);
            }
        }
    }),

    get: Q.async(function*(conn, id, opts) {
        const self = this;
        const model = self.model;
        const q = squel.select()
            .from(opts && opts.schema ? opts.schema + "." + model.table : model.table)
            .where(model.id + " = $1");
        const res = yield Q.ninvoke(conn, "query", q.toString(), [id]);

        if (res.rows.length === 1) {
            return new model.modelConstructor(res.rows[0]);
        } else {
            return null;
        }
    }),

    list: function(conn, opts) {
        const self = this;
        const model = self.model;
        const q = squel.select()
            .from(opts && opts.schema ? opts.schema + "." + model.table : model.table)
            .order(model.id);

        if (opts) {
            if (opts.limit) {
                q.limit(opts.limit);
            }

            if (opts.offset) {
                q.offset(opts.offset);
            }
        }

        return self.query(conn, q);
    },

    count: Q.async(function*(conn, opts) {
        const self = this;
        const model = self.model;
        const q = squel.select()
            .from(opts && opts.schema ? opts.schema + "." + model.table : model.table)
            .field("count(*)");
        const res = yield Q.ninvoke(conn, "query", q.toString());

        if (res.rows.length === 1) {
            return parseInt(res.rows[0].count, 10);
        } else {
            throw new Error("Expected row count");
        }
    }),

    query: function(conn, q) {
        const self = this;
        const d = Q.defer();
        const query = conn.query(q.toString(), _.toArray(arguments).slice(2));
        let uniqueResult = false;
        let collectResults = false;
        let res = null;

        query.on("row", function(row) {
            let m = new self.model.modelConstructor(row);

            if (uniqueResult) {
                if (res === null) {
                    res = m;
                } else {
                    return d.reject(new Error("multiple results"));
                }
            } else if (collectResults) {
                res.push(m);
            }

            d.notify(m);
        });
        query.on("end", function() {
            if (uniqueResult || collectResults) {
                d.resolve(res);
            } else {
                d.resolve();
            }
        });
        query.on("error", function(err) {
            d.reject(err);
        });

        d.promise.uniqueResult = function() {
            uniqueResult = true;

            return d.promise;
        };

        d.promise.collectResults = function() {
            collectResults = true;
            res = [];

            return d.promise;
        };

        return d.promise;
    }
};

DAO.inTransaction = Q.async(function*(conn, fn, opts) {
    try {
        yield Q.ninvoke(conn, "query", "BEGIN;");
        yield fn();

        if (opts && opts.readOnly) {
            yield Q.ninvoke(conn, "query", "ROLLBACK;");
        } else {
            yield Q.ninvoke(conn, "query", "COMMIT;");
        }
    } catch (ex) {
        yield Q.ninvoke(conn, "query", "ROLLBACK;");

        throw ex;
    }
});

module.exports = DAO;