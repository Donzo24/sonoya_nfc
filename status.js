import { app} from "electron";
import path from 'path';

let CURRENT_STATUS = false;

export function getCurrentStatus() {
    return CURRENT_STATUS;
}

export function setCurrentStatus(status) {
    CURRENT_STATUS = status;
}

export function getDBPath() {
    const userDataPath = app.getPath('userData');
    const dbName = 'sonoya_db.db';
    const dbPath = path.join(userDataPath, dbName);
    return dbPath;
}
