import { Injectable } from '@angular/core';

export interface LogInfo {
  service?: string;
  method?: string;
  requestId?: string;
  data?: any;
}

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private format(level: string, info: LogInfo): string {
    const parts: string[] = [level];
    if (info.service) parts.push(info.service);
    if (info.method) parts.push(info.method);
    // ensure there is always some request identifier (timestamp fallback)
    const rid = info.requestId || new Date().toISOString();
    parts.push(rid);
    if (info.data !== undefined) {
      try {
        parts.push(
          typeof info.data === 'string' ? info.data : JSON.stringify(info.data)
        );
      } catch {
        parts.push(String(info.data));
      }
    }
    return `[${parts.join(':')}]`;
  }

  private log(level: string, info: LogInfo, msg: string) {
    console.log(`${this.format(level, info)} ${msg}`);
  }

  error(info: LogInfo, msg: string) {
    this.log('ERROR', info, msg);
  }
  warn(info: LogInfo, msg: string) {
    this.log('WARN', info, msg);
  }
  alert(info: LogInfo, msg: string) {
    this.log('ALERT', info, msg);
  }
  info(info: LogInfo, msg: string) {
    this.log('INFO', info, msg);
  }
  debug(info: LogInfo, msg: string) {
    this.log('DEBUG', info, msg);
  }
}
