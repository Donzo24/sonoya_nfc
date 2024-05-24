import pcsc from "pcsclite";
import fetch from "node-fetch";
import Pusher from "pusher";
import Database from 'better-sqlite3';
import PusherJs from "pusher-js";
import { app, BrowserWindow } from "electron";
import path from "path";
import os from "os";
import Store from "electron-store";
import axios from "axios";
import createBackgroundService from "./register-startup.js";

var LED_ROUGE = [0xFF, 0x00, 0x40, 0x50, 0x04, 0x02, 0x0A, 0x02, 0x00];
var BEEP_LONG = [0xFF, 0x00, 0x40, 0x00, 0x4C, 0x6, 0x00, 0x01, 0x01];
var READ_UID = [0xFF, 0xCA, 0x00, 0x00, 0x00];

var API_URL = "https://www.sonfonia-fitness.com/api/v1";

var pcscs = pcsc();

const store = new Store();

const userDataPath = app.getPath('userData');

const dbName = 'sonoya_db.db';

var CURRENT_STATUS = false;


function sendCommande(reader, protocol) {

    console.log("commande envoyer");

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
                CURRENT_STATUS = false;
            });
        }
    });
}

try {
    
    pcscs.on('reader', function(reader) {

        console.log('New reader detected', reader.name);

        console.log('-------1------');

        reader.on('status', function(status) {

            console.log('-------2------');
    
            const cardInserted = status.state & reader.SCARD_STATE_PRESENT;

            var changes = this.state ^ status.state;

            if ((changes & this.SCARD_STATE_EMPTY) && (status.state & this.SCARD_STATE_EMPTY)) {
                reader.disconnect(reader.SCARD_LEAVE_CARD, function(err) {
                    if (err) console.log(err);
                });

                return;
            }

            console.log('-------3------');

            console.log('LOG');

            console.log(CURRENT_STATUS);

            if(CURRENT_STATUS) return;
            
            if (cardInserted) {

                console.log('Carte inserer');

                CURRENT_STATUS = true;

                console.log('Non occuper');

                console.log(reader.connected);

                if(reader.connected) {
                    //Le lecteur es connecter, envoyer la commande
                    sendCommande(reader, 2);
                } else {
                    //Etablir la connexion avec le lecteur puis envoyer la commande
                    reader.connect({share_mode: reader.SCARD_SHARE_SHARED}, async (err, protocol) => {
                        console.log("-----Protocol-----");
                        console.log(protocol);
                        if(protocol == undefined) protocol = 2;
                        sendCommande(reader, protocol);
                    });
                }
            } else {
                CURRENT_STATUS = false;
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

const dbPath = path.join(userDataPath, dbName);

async function updateLocalDB() {
    try {
        var endPoint = API_URL+"/e9306ce7-4a38-49ec-af98-df2a1dcf53af";

        const response = await axios.get(endPoint);
        
        if (response.status === 200) {

            const list = response.data.data; // Supposons que votre API renvoie une liste au format JSON
                        
            // Parcours de la liste
            list.forEach(data => {
                console.log(data); // Vous pouvez faire ce que vous voulez avec chaque élément de la liste
                insertOrUpdateRecord(data.serial_number, data.date_debut, data.date_fin);
            });

            store.set('dbUpdate', true);
        }
    } catch (error) {
        console.error('Erreur lors de la récupération de la liste :', error);
    }
}

app.on('ready', () => {


    console.log('-------4------');

    if (!store.has('firstRun')) {
        createBackgroundService();
        store.set('firstRun', true);
    }

	createDbSchema();

    if(!store.has('dbUpdate')) updateLocalDB();

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

    //db.prepare('UPDATE souscription SET date_debut = ?, date_fin = ? WHERE serial_number = ?').run();
    // db.prepare('DELETE FROM souscription').run();

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
        //console.log(row);
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
                // console.log(uuid);

                pusher.trigger("nfc-channel-notify", "nfc-event-notify", {
                    status: exists,
                    message: exists ? "Abonnement valide":"Aucun abonnement"
                });
			}
		});

		pusher.trigger("nfc-channel", "nfc-event", {
			card: uuid
		});
	
	} catch (error) {
		console.log(error);
	}
}

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
});