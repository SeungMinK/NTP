const logger = require("./logger.js");
const log_replace = require("./log_replace.js");

function exec_sql(connection, sql, param) {
    return new Promise((resolve, reject) => {
        if (!param) {
            connection.query(sql, function (err, res) {
                if (err) {
                    logger.error(err);
                    //logger.error(sql).sql;
                    reject(err);
                } else {
                    logger.info(sql);
                    resolve(res);
                }
            });
        } else {
            connection.query(sql, param, function (err, res) {
                if (err) {
                    logger.error(log_replace(sql, param)).sql;
                    reject(err);
                } else {
                    logger.info(log_replace(sql, param));
                    resolve(res);
                }
            });
        }
    });
}

module.exports = exec_sql;
