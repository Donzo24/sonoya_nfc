import pcsc from "pcsclite";
import fetch from "node-fetch";
import Pusher from "pusher";
import Database from 'better-sqlite3';
import PusherJs from "pusher-js";
import { app, BrowserWindow } from "electron";
import path from "path";
import os from "os";
import Store from "electron-store";
import createBackgroundService from "./register-startup.js";

var LED_ROUGE = [0xFF, 0x00, 0x40, 0x50, 0x04, 0x02, 0x0A, 0x02, 0x00];
var BEEP_LONG = [0xFF, 0x00, 0x40, 0x00, 0x4C, 0x6, 0x00, 0x01, 0x01];
var READ_UID = [0xFF, 0xCA, 0x00, 0x00, 0x00];

var CURRENT_STATUS = false;

var pcscs = pcsc();

const store = new Store();

const userDataPath = app.getPath('userData');

const dbName = 'sonoya_db.db';

function sendCommande(reader, protocol) {

    reader.transmit(Buffer.from(READ_UID), 100, protocol, async (err, data) => {
        if (err) {
            console.error('Erreur lors de la lecture de l\'UID:', err.message);
        } else {
            // L'UID est généralement les premiers 4 à 7 octets de la réponse
            const uid = data.slice(0, -2).toString('hex');
            await makePostRequest(uid, reader, async (status) => {

                if (status == false) {
                    reader.transmit(Buffer.from(BEEP_LONG), 40, protocol, (err, data) => {
                        reader.transmit(Buffer.from(LED_ROUGE), 40, protocol, (err, data) => {});
                    });
                } 
            });
        }
    });
}

try {
    
    pcscs.on('reader', function(reader) {

        console.log('New reader detected', reader.name);

        reader.on('status', function(status) {
    
            const cardInserted = status.state & reader.SCARD_STATE_PRESENT;

            var changes = this.state ^ status.state;

            if ((changes & this.SCARD_STATE_EMPTY) && (status.state & this.SCARD_STATE_EMPTY)) {
                reader.disconnect(reader.SCARD_LEAVE_CARD, function(err) {
                    if (err) console.log(err);
                });

                return;
            }
    
            if (cardInserted) {

                if(reader.connected) {
                    //Le lecteur es connecter, envoyer la commande
                    sendCommande(reader, 2);
                } else {
                    //Etablir la connexion avec le lecteur puis envoyer la commande
                    reader.connect({share_mode: reader.SCARD_SHARE_SHARED}, async (err, protocol) => {
                        if(protocol == undefined) protocol = 2;
                        sendCommande(reader, protocol);
                    });
                }
            }
        });
    
        reader.on('end', function() {
            console.log('Reader',  this.name, 'removed');
        });
        
    });

    pcscs.on('error', function(err) {
        console.log('PCSC error', err.message);
    });
} catch (error) {
    console.log(error);
}

function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

const dbPath = path.join(userDataPath, dbName);

app.on('ready', () => {

    if (!store.has('firstRun')) {
        createBackgroundService();
        store.set('firstRun', true);
    }

	createDbSchema();

	const pusher = new PusherJs('fa09b03ab171c8fbc772', {
		cluster: 'us2',
		encrypted: true
	});
	
	const channel = pusher.subscribe('nfc-channel-message');
  
	channel.bind('nfc-event-message', function(data) {
		data = data.message.data;
		insertOrUpdateRecord(data.serial_number, data.date_debut, data.date_fin);
	});
});

function createDbSchema() {
	
	const db = new Database(dbPath);

    db.exec(`CREATE TABLE IF NOT EXISTS souscription (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serial_number TEXT,
        date_debut TEXT,
        date_fin TEXT
    )`);

    // db.prepare('UPDATE souscription SET date_debut = ?, date_fin = ? WHERE serial_number = ?').run();
    //db.prepare('DELETE FROM souscription').run();

    db.close();

    console.log('Base de données SQLite fermée avec succès.');
}

function insertOrUpdateRecord(serialNumber, dateDebut, dateFin) {
    const db = new Database(dbPath);

    // Vérifiez si un enregistrement avec le même serial_number existe déjà
    const existingRecord = db.prepare('SELECT * FROM souscription WHERE serial_number = ?').get(serialNumber);

    if (existingRecord) {
        // Mettre à jour l'enregistrement s'il existe déjà
        db.prepare('UPDATE souscription SET date_debut = ?, date_fin = ? WHERE serial_number = ?').run(dateDebut, dateFin, serialNumber);
        console.log('Enregistrement mis à jour avec succès.');
    } else {
        // Insérer un nouvel enregistrement s'il n'existe pas
        db.prepare('INSERT INTO souscription (serial_number, date_debut, date_fin) VALUES (?, ?, ?)').run(serialNumber, dateDebut, dateFin);
        console.log('Enregistrement inséré avec succès.');
    }

    // Fermeture de la base de données SQLite
    db.close();
    console.log('Base de données SQLite fermée avec succès.');
}

function checkRecordExists(serialNumber, callback) {

    const db = new Database(dbPath);

    const dateFin = new Date().toISOString().split('T')[0];

    // Vérifiez si un enregistrement avec le même numéro de série existe et s'il est valide
    const row = db.prepare('SELECT * FROM souscription WHERE serial_number = ? AND date_fin >= ?').get(serialNumber, dateFin);

    if (row) {
        // Un enregistrement valide existe
        console.log(row);
        callback(null, true);
    } else {
        // Aucun enregistrement valide trouvé
        callback(null, false);
    }

    // Fermeture de la base de données SQLite
    db.close();
}

async function makePostRequest(uuid, reader, callback) {

	try {
		const pusher = new Pusher({
			appId: "1751938",
			key: "fa09b03ab171c8fbc772",
			secret: "0c1176b79ed0048515a5",
			cluster: "us2",
			useTLS: true
		});

		checkRecordExists(uuid, async (err, exists) => {
			if (err) {
				console.error('Une erreur est survenue lors de la vérification de l\'enregistrement :', err);
			} else {
                callback(exists);
			}
		});

		pusher.trigger("nfc-channel", "nfc-event", {
			card: uuid
		});
	
	} catch (error) {
		console.log(error);
	}
}

function disConnetReader(reader) {
    reader.disconnect(reader.SCARD_UNPOWER_CARD, err => {
        if (err) {
            console.error('Erreur lors de la déconnexion du lecteur NFC:', err.message);
        } else {
            console.log('Déconnecté du lecteur NFC');
        }
    });
}

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
});