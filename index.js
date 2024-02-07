import { NFC, CONNECT_MODE_DIRECT } from 'nfc-pcsc';
import Echo from 'laravel-echo';
import fetch from "node-fetch";
import Pusher from "pusher";
import sqlite3 from "sqlite3";
import PusherJs from "pusher-js";
import { app, BrowserWindow } from "electron";
import path from "path";
import os from "os";

const nfc = new NFC();

const userDataPath = app.getPath('userData');
const dbName = 'sonoya_db.db';

// Créez le chemin complet du fichier de base de données
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

async function makePostRequest(uuid, reader) {

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
				if (exists) {
					//await reader.led(0b00101110, [0x01, 0x00, 0x01, 0x01]);
					console.log(`Un enregistrement valide existe avec le numéro de série ${uuid}.`);
					await reader.led(0b00101110, [0x01, 0x00, 0x01, 0x01]);
                    await reader.led(0b01011101, [0x02, 0x01, 0x05, 0x01]);
				} else {
					console.log(`Aucun enregistrement valide trouvé avec le numéro de série ${uuid}.`);
					await reader.led(0b01011101, [0x02, 0x01, 0x05, 0x01]);
				}
			}
		});

		pusher.trigger("nfc-channel", "nfc-event", {
			card: uuid
		});
	
	} catch (error) {
		console.log(error);
	}
}

nfc.on('reader', async reader => {
	
	reader.on('card', async card => {

        const uuid = card.uid;

		try {
			await makePostRequest(uuid, reader);
		} catch (error) {
			console.log(error);
		}

	});

	reader.on('card.off', card => {
		//console.log(`${reader.reader.name}  card removed`, card);
	});

	reader.on('error', err => {
		///console.log(`${reader.reader.name}  an error occurred`, err);
	});

	reader.on('end', () => {
		//console.log(`${reader.reader.name}  device removed`);
	});

});

nfc.on('error', err => {
	//console.log('an error occurred', err);
});