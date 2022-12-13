const LOG_LEVEL = 1;

export const log = (...args: Parameters<typeof console.log>) => {
  if (LOG_LEVEL < 2) {
    console.log(...args);
  }
};

export const logDebug = (...args: Parameters<typeof console.debug>) => {
  if (LOG_LEVEL < 1) {
    console.debug(...args);
  }
};

export const logError = (...args: Parameters<typeof console.error>) => {
  console.error(...args);
};
