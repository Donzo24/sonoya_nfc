import Database from 'better-sqlite3';
import axios from "axios";
import Store from "electron-store";

import { getDBPath } from './status.js';


const store = new Store();
var API_URL = "https://www.sonfonia-fitness.com/api/v1";

export function createDbSchema(dbPath) {
    try {
        const db = new Database(dbPath);
        db.exec(`CREATE TABLE IF NOT EXISTS souscription (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            serial_number TEXT,
            date_debut TEXT,
            date_fin TEXT
        )`);
        db.close();
        console.log('Table souscription créée avec succès.');
        console.log(dbPath);
    } catch (error) {
        console.error('Erreur lors de la création de la table souscription :', error.message);
    }
}

export async function updateLocalDB(dbPath) {
    try {
        var endPoint = API_URL + "/e9306ce7-4a38-49ec-af98-df2a1dcf53af";
        const response = await axios.get(endPoint);
        
        if (response.status === 200) {
            const list = response.data.data;
            list.forEach(data => {
                insertOrUpdateRecord(data.serial_number, data.date_debut, data.date_fin);
            });
            store.set('dbUpdate', true);
            console.log('Base de données mise à jour avec succès.');
        }
    } catch (error) {
        console.error('Erreur lors de la récupération de la liste :', error);
    }
}

export function insertOrUpdateRecord(serialNumber, dateDebut, dateFin) {
    try {
        const db = new Database(getDBPath());
        const existingRecord = db.prepare('SELECT * FROM souscription WHERE serial_number = ?').get(serialNumber);

        if (existingRecord) {
            db.prepare('UPDATE souscription SET date_debut = ?, date_fin = ? WHERE serial_number = ?').run(dateDebut, dateFin, serialNumber);
            console.log('Enregistrement mis à jour avec succès.');
        } else {
            db.prepare('INSERT INTO souscription (serial_number, date_debut, date_fin) VALUES (?, ?, ?)').run(serialNumber, dateDebut, dateFin);
            console.log('Enregistrement inséré avec succès.');
        }

        db.close();
        console.log('Base de données SQLite fermée avec succès.');
    } catch (error) {
        console.error('Erreur lors de l\'insertion ou la mise à jour de l\'enregistrement :', error.message);
    }
}

export function checkRecordExists(serialNumber, callback) {
    try {
        const db = new Database(getDBPath());
        const dateFin = new Date().toISOString().split('T')[0];
        const row = db.prepare('SELECT * FROM souscription WHERE serial_number = ? AND date_fin >= ?').get(serialNumber, dateFin);

        if (row) {
            callback(null, true);
        } else {
            callback(null, false);
        }

        db.close();
    } catch (error) {
        console.error('Erreur lors de la vérification de l\'existence de l\'enregistrement :', error.message);
        // console.log(dbPath);
        callback(error);
    }
}
