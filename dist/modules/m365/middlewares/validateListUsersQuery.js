"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateListUsersQuery = void 0;
const filter_1 = require("../utils/filter");
const validateListUsersQuery = (req, _res, next) => {
    try {
        req.m365Query = (0, filter_1.parseListUsersQuery)(req.query);
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.validateListUsersQuery = validateListUsersQuery;
