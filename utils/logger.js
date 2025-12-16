const DEFAULT_ENABLED = true;

let enabled = DEFAULT_ENABLED;

export const setLoggingEnabled = (v) => { enabled = !!v; };

const prefix = (level) => `[routivity:${level}]`;

const info = (...args) => {
  if (!enabled) return;
  try { console.log(prefix('info'), ...args); } catch (e) {}
};

const warn = (...args) => {
  if (!enabled) return;
  try { console.warn(prefix('warn'), ...args); } catch (e) {}
};

const error = (...args) => {
  if (!enabled) return;
  try { console.error(prefix('error'), ...args); } catch (e) {}
};

const debug = (...args) => {
  if (!enabled) return;
  try { console.debug(prefix('debug'), ...args); } catch (e) {}
};

export default {
  setLoggingEnabled,
  info,
  warn,
  error,
  debug,
};
