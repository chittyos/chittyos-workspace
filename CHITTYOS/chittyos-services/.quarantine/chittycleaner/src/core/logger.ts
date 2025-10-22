import winston from 'winston';

export function createLogger(level: string = 'info'): winston.Logger {
  return winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'chittycleaner' },
    transports: [
      new winston.transports.File({
        filename: '/var/log/chittycleaner/error.log',
        level: 'error'
      }),
      new winston.transports.File({
        filename: '/var/log/chittycleaner/combined.log'
      }),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ]
  });
}