import { app, BrowserWindow, ipcMain } from "electron";
import path from 'path';
import { setupPCSC } from './pcsc-setup.js';
import { updateLocalDB, createDbSchema, insertOrUpdateRecord } from './database.js';
import createBackgroundService from "./register-startup.js";
import Store from "electron-store";
import PusherJs from "pusher-js";

const store = new Store();
const userDataPath = app.getPath('userData');
const dbName = 'sonoya_db.db';
const dbPath = path.join(userDataPath, dbName);

app.on('ready', () => {
    if (!store.has('firstRun')) {
        createBackgroundService();
        store.set('firstRun', true);
    }

    console.log('Création du schéma de la base de données...');
    createDbSchema(dbPath);

    if (!store.has('dbUpdate')) {
        console.log('Mise à jour de la base de données locale...');
        updateLocalDB(dbPath);
    }

    const pusher = new PusherJs('fa09b03ab171c8fbc772', {
        cluster: 'us2',
        encrypted: true
    });

    const channel = pusher.subscribe('nfc-channel-message');
    channel.bind('nfc-event-message', function(data) {
        data = data.message.data;
        insertOrUpdateRecord(data.serial_number, data.date_debut, data.date_fin);
    });

    setupPCSC(dbPath);
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

let isOn = false;

ipcMain.on('toggle-status', (event) => {
    isOn = !isOn;
    mainWindow.webContents.send('status-changed', isOn);
});

function createWindow() {
    const win = new BrowserWindow({
        width: 300,
        height: 300,
    });
    win.loadFile('html/index.html');
}
