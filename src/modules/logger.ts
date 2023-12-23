import { addColors, createLogger, format, transports } from "winston";

addColors({
    error: "red",
    warn: "yellow",
    info: "white",
    debug: "gray",
});

const logger = createLogger({
    level:
        process.env.LOG_LEVEL || process.env.NODE_ENV === "production"
            ? "info"
            : "debug",
    format: format.combine(
        format.timestamp({
            format: "DD-MM-YYYY HH:mm:ss",
        }),
        format.printf(
            (info) =>
                `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`
        )
    ),
    transports: [
        new transports.Console({
            format: format.combine(format.colorize({ all: true })),
        }),
        new transports.File({ filename: "log.txt" }),
    ],
});

export default logger;
