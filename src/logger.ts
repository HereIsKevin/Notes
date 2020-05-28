export { loggerLog, loggerWarn, loggerError, log, warn, error, level };

let loggerLog = true;
let loggerWarn = true;
let loggerError = true;

function log(text: string): void {
  if (loggerLog) {
    console.log(`[log] ${text}`);
  }
}

function warn(text: string): void {
  if (loggerWarn) {
    console.warn(`[warn] ${text}`);
  }
}

function error(text: string): void {
  if (loggerError) {
    console.error(`[error] ${text}`);
  }
}

function level(value: number): void {
  if (value < 0 || value > 3) {
    error("invalid logging level");
  } else {
    loggerLog = false;
    loggerWarn = false;
    loggerError = false;

    if (value >= 1) {
      loggerError = true;
    }

    if (value >= 2) {
      loggerWarn = true;
    }

    if (value >= 3) {
      loggerLog = true;
    }
  }
}
