const util = require('util');

// very simple logging helper with levels
// format: [LEVEL:service:method:requestId:data] message

const levels = ['ERROR', 'WARN', 'ALERT', 'INFO', 'DEBUG'];

function _format(level, info, msg) {
  const parts = [
    level,
    info.service || 'unknown',
    info.method || 'unknown',
    info.requestId || '',
  ];
  if (info.data !== undefined) {
    try {
      parts.push(typeof info.data === 'string' ? info.data : JSON.stringify(info.data));
    } catch (e) {
      parts.push(String(info.data));
    }
  }
  const header = `[${parts.join(':')}]`;
  return `${header} ${msg}`;
}

function log(level, info = {}, msg = '') {
  if (!levels.includes(level)) level = 'INFO';
  const text = _format(level, info, msg);
  // simple console output; could be replaced with a more sophisticated logger
  console.log(text);
}

module.exports = {
  error: (info, msg) => log('ERROR', info, msg),
  warn: (info, msg) => log('WARN', info, msg),
  alert: (info, msg) => log('ALERT', info, msg),
  info: (info, msg) => log('INFO', info, msg),
  debug: (info, msg) => log('DEBUG', info, msg),
};
