import Pusher from "pusher";
import { checkRecordExists } from './database.js';

export async function makePostRequest(uuid, reader, callback) {
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
                pusher.trigger("nfc-channel-notify", "nfc-event-notify", {
                    status: exists,
                    message: exists ? "Abonnement valide" : "Aucun abonnement"
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
