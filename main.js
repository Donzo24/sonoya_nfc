import pcsc from "pcsclite";
import fetch from "node-fetch";
import Pusher from "pusher";
import sqlite3 from "sqlite3";
import PusherJs from "pusher-js";
import { app, BrowserWindow } from "electron";
import path from "path";
import os from "os";

var LED_ROUGE = [0xFF, 0x00, 0x40, 0x50, 0x04, 0x05, 0x0A, 0x02, 0x00];
var BEEP_LONG = [0xFF, 0x00, 0x40, 0x00, 0x4C, 0x6, 0x00, 0x01, 0x01];
var READ_UID = [0xFF, 0xCA, 0x00, 0x00, 0x00];

var CURRENT_PROTO = null;

var pcscs = pcsc();

const userDataPath = app.getPath('userData');
const dbName = 'sonoya_db.db';

pcscs.on('reader', function(reader) {


    reader.on('status', function(status) {

        const cardInserted = status.state & reader.SCARD_STATE_PRESENT;

        if (cardInserted) {
            reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, (err, protocol) => {
                CURRENT_PROTO = protocol;
                if (err) {
                    console.error('Erreur lors de la connexion au lecteur NFC:', err.message);
                    return;
                }

                reader.transmit(Buffer.from(READ_UID), 10, protocol, async (err, data) => {
                    if (err) {
                        console.error('Erreur lors de la lecture de l\'UID:', err.message);
                    } else {
                        // L'UID est généralement les premiers 4 à 7 octets de la réponse
                        const uid = data.slice(0, -2).toString('hex');
                        await makePostRequest(uid, reader, (status) => {
                            
                            if(status == false) {
                                reader.transmit(Buffer.from(BEEP_LONG), 30, protocol, (err, data) => {
                                    reader.transmit(Buffer.from(LED_ROUGE), 30, protocol, (err, data) => {
                                        disConnetReader(reader);
                                    });
                                });
                            } else {
                                disConnetReader(reader);
                            }

                        });
                    }
                });
             
                
            });
            // Code pour contrôler la LED du lecteur NFC ici
            // Vous devrez trouver la documentation spécifique à votre lecteur NFC pour connaître les commandes à envoyer pour contrôler la LED.
        } else {
            //console.log('Carte retirée');
            // Code pour éteindre la LED du lecteur NFC ici, si nécessaire.
        }
        /* check what has changed */
        //var changes = this.state ^ status.state;
    });

    reader.on('end', function() {
        console.log('Reader',  this.name, 'removed');
    });
});

pcscs.on('error', function(err) {
    console.log('PCSC error', err.message);
});

const dbPath = path.join(userDataPath, dbName);

app.on('ready', () => {

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
	
	const db = new sqlite3.Database(dbPath);
	db.run(`CREATE TABLE IF NOT EXISTS souscription (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		serial_number TEXT,
		date_debut TEXT,
		date_fin TEXT
	)`);

	db.close((err) => {
        if (err) {
            console.error('Erreur lors de la fermeture de la base de données :', err.message);
        } else {
            console.log('Base de données SQLite fermée avec succès.');
        }
    });
}

function insertOrUpdateRecord(serialNumber, dateDebut, dateFin) {
    const db = new sqlite3.Database(dbPath);
    
    // Vérifiez si un enregistrement avec le même serial_number existe déjà
    db.get('SELECT * FROM souscription WHERE serial_number = ?', [serialNumber], (err, row) => {
        if (err) {
            console.error('Erreur lors de la récupération de l\'enregistrement :', err.message);
            return;
        }

        if (row) {
            // Mettre à jour l'enregistrement s'il existe déjà
            db.run('UPDATE souscription SET date_debut = ?, date_fin = ? WHERE serial_number = ?', [dateDebut, dateFin, serialNumber], (err) => {
                if (err) {
                    console.error('Erreur lors de la mise à jour de l\'enregistrement :', err.message);
                } else {
                    console.log('Enregistrement mis à jour avec succès.');
                }
            });
        } else {
            // Insérer un nouvel enregistrement s'il n'existe pas
            db.run('INSERT INTO souscription (serial_number, date_debut, date_fin) VALUES (?, ?, ?)', [serialNumber, dateDebut, dateFin], (err) => {
                if (err) {
                    console.error('Erreur lors de l\'insertion de l\'enregistrement :', err.message);
                } else {
                    console.log('Enregistrement inséré avec succès.');
                }
            });
        }
    });

    // Fermeture de la base de données SQLite
    db.close((err) => {
        if (err) {
            console.error('Erreur lors de la fermeture de la base de données :', err.message);
        } else {
            console.log('Base de données SQLite fermée avec succès.');
        }
    });
}

function checkRecordExists(serialNumber, callback) {
    const db = new sqlite3.Database(dbPath);

    // Vérifiez si un enregistrement avec le même numéro de série existe et s'il est valide
    db.get('SELECT * FROM souscription WHERE serial_number = ? AND date_fin >= date("now")', [serialNumber], async (err, row) => {
        if (err) {
            console.error('Erreur lors de la vérification de l\'enregistrement :', err.message);
            await callback(err, null);
        } else {
            if (row) {
                // Un enregistrement valide existe
                await callback(null, true);
            } else {
                // Aucun enregistrement valide trouvé
                await callback(null, false);
            }
        }
    });

    // Fermeture de la base de données SQLite
    db.close((err) => {
        if (err) {
            console.error('Erreur lors de la fermeture de la base de données :', err.message);
        }
    });
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
    reader.disconnect(reader.SCARD_LEAVE_CARD, err => {
        if (err) {
            console.error('Erreur lors de la déconnexion du lecteur NFC:', err.message);
        } else {
            console.log('Déconnecté du lecteur NFC');
        }
    });
}