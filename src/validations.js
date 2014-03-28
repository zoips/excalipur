"use strict";

function ValidationError(failed) {
    const self = this;

    self.failed = failed;
}

ValidationError.prototype = {
    failed: null
};

const isString = function(value) {
    if (typeof value !== "string") {
        return [false, "expected string"];
    } else {
        return [true];
    }
};

const isNumber = function(value) {
    if (typeof value !== "number") {
        return [false, "expected number"];
    } else {
        return [true];
    }
};

const isBoolean = function(value) {
    if (value !== true && value !== false) {
        return [false, "expected boolean"];
    } else {
        return [true];
    }
};

const isDate = function(value) {
    if (!(value instanceof Date)) {
        return [false, "expected Date"];
    } else {
        return [true];
    }
};

const isNotNull = function(value) {
    if (value === null) {
        return [false, "expected not null"];
    } else {
        return [true];
    }
};

const isInRange = function(value, min, max) {
    if (value < min || value > max) {
        return [false, "expected " + min + " <= x <= " + max];
    } else {
        return [true];
    }
};

module.exports = {
    ValidationError: ValidationError,
    isString: isString,
    isNumber: isNumber,
    isBoolean: isBoolean,
    isDate: isDate,
    isNotNull: isNotNull,
    isInRange: isInRange
};
