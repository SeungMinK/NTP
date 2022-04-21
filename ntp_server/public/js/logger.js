const { createLogger } = require("winston");
const winston = require("winston");
const winstonDaily = require("winston-daily-rotate-file");
require("dotenv").config();
const logDir = process.env.LOG_PATH ? process.env.LOG_PATH : "../log";
const { combine, timestamp, printf } = winston.format;

// Define log format
const logFormat = printf((info) => {
    return `${info.timestamp} ${info.level}: ${info.message}`;
});

/*
## Log level
{
    0: error,
    1: warn,
    2: info,
    3: http,
    4: verbose,
    5: debug,
    6: silly
}
*/

const logger = winston.createLogger({
    format: combine(
        timestamp({
            format: "YYYY-MM-DD HH:mm:ss.SSS",
        }),
        logFormat
    ),
    transports: [
        // transports에 인스턴스 2개 설정   (info, error)
        // info 레벨 로그를 저장할 파일 설정
        new winstonDaily({
            level: "info",
            datePattern: "YYYY-MM-DD",
            dirname: logDir,
            filename: `%DATE%.log`,
            maxFiles: 365, // 1,000일치의 로그 파일 저장
            zippedArchive: false,
        }),
    ],
});

// Production 환경이 아닌 경우 (dev 등)
if (process.env.NODE_ENV !== "production") {
    logger.add(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(), // 색깔 넣어서 출력
                winston.format.simple() // `${info.level}: ${info.message} JSON.stringify({ ...rest})` 포맷으로 출력
            ),
        })
    );
}

module.exports = logger;
