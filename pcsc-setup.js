import pcsc from "pcsclite";
import { sendCommande, reconnectReader } from './reader-commands.js';
import { getCurrentStatus, setCurrentStatus } from './status.js';

export function setupPCSC(dbPath) {
    var pcscs = pcsc();

    pcscs.on('reader', function(reader) {
        console.log('Nouveau lecteur détecté:', reader.name);

        reader.on('status', function(status) {
            const cardInserted = status.state & reader.SCARD_STATE_PRESENT;
            var changes = this.state ^ status.state;

            if ((changes & this.SCARD_STATE_EMPTY) && (status.state & this.SCARD_STATE_EMPTY)) {
                reader.disconnect(reader.SCARD_LEAVE_CARD, function(err) {
                    if (err) console.log(err);
                });
                return;
            }

            if (getCurrentStatus()) return;

            if (cardInserted) {
                setCurrentStatus(true);
                if (reader.connected) {
                    sendCommande(reader, 2);
                } else {
                    reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, function(err, protocol) {
                        if (err) {
                            console.error('Erreur lors de la connexion au lecteur:', err.message);
                        } else {
                            sendCommande(reader, protocol || 2);
                        }
                    });
                }
            } else {
                setCurrentStatus(false);
            }
        });

        reader.on('end', function() {
            console.log('Lecteur', this.name, 'retiré');
        });
    });

    pcscs.on('error', function(err) {
        console.log('Erreur PCSC:', err.message);
    });
}
