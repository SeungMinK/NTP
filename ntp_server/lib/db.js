const mysql = require("mysql");
const logger = require("../public/js/logger");
require("dotenv").config();

const config = {
    host: process.env.HOST,
    port: process.env.PORT,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    connectionLimit: process.env.CONNETCIONLIMIT,
};

let pool = mysql.createPool(config);

function getConnection(callback) {
    logger.info(
        `[LIB-DB] CONNECTION LIMIT: ${pool.config.connectionLimit} / CONN IN USE + BEING CREATED: ${pool._allConnections.length} / FREE CONN AWAITING USE: ${pool._freeConnections.length}`
    );
    pool.getConnection(function (err, conn) {
        if (err) {
            logger.error(err);
        } else {
            callback(conn);
        }
    });
}

module.exports = getConnection;
