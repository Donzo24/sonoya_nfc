import { makePostRequest } from './requests.js';
import { setCurrentStatus } from './status.js';

var LED_ROUGE = [0xFF, 0x00, 0x40, 0x50, 0x04, 0x02, 0x0A, 0x02, 0x00];
var BEEP_LONG = [0xFF, 0x00, 0x40, 0x00, 0x4C, 0x6, 0x00, 0x01, 0x01];
var READ_UID = [0xFF, 0xCA, 0x00, 0x00, 0x00];

export function sendCommande(reader, protocol) {
    console.log("Commande envoyée");

    reader.transmit(Buffer.from(READ_UID), 100, protocol, async (err, data) => {
        if (err) {
            console.error('Erreur lors de la lecture de l\'UID:', err.message);
            reconnectReader(reader);
        } else {
            const uid = data.slice(0, -2).toString('hex');
            await makePostRequest(uid, reader, async (status) => {
                if (status == false) {
                    reader.transmit(Buffer.from(BEEP_LONG), 40, protocol, (err, data) => {
                        if (err) console.error('Erreur lors de l\'envoi du beep:', err.message);
                    });
                    // reader.transmit(Buffer.from(LED_ROUGE), 40, protocol, (err, data) => {
                    //     if (err) console.error('Erreur lors de l\'envoi du signal LED:', err.message);
                    // });
                }
                setCurrentStatus(false);
            });
        }
    });
}

export function reconnectReader(reader) {
    reader.disconnect(reader.SCARD_LEAVE_CARD, function(err) {
        if (err) {
            console.error('Erreur lors de la déconnexion du lecteur:', err.message);
        } else {
            reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, function(err, protocol) {
                if (err) {
                    console.error('Erreur lors de la reconnexion du lecteur:', err.message);
                } else {
                    sendCommande(reader, protocol || 2);
                }
            });
        }
    });
}
