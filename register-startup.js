import fs from "fs";
import os from "os";
import path from "path";

const appName = 'Sonoya NFC Reader';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const plistFilePath = path.join(__dirname, 'assets', 'Info.plist');

export default function createBackgroundService() {
	if (os.platform() === 'darwin') {

		var appPath = path.resolve(os.homedir(), 'Applications', `${appName}.app`, 'Contents', 'MacOS', appName);
		
		fs.readFile(plistFilePath, 'utf8', (err, data) => {
			if (err) return;
		  
				// Remplacer __APP_PATH__ par Sonoya
				var plistContent = data.replace(/__APP_PATH__/g, appPath);
				plistContent = plistContent.replace(/__APP_NAME__/g, appName);

				const plistPath = path.resolve(os.homedir(), 'Library', 'LaunchAgents', `${appName}.plist`);
				fs.writeFileSync(plistPath, plistContent, 'utf-8');

				console.log(`Le fichier de lancement automatique a été créé : ${plistPath}`);
		  });
		
	} else if (os.platform() === 'win32') {
		// Configuration spécifique pour Windows
		const registryKeyPath = '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
		const appPath = path.resolve(os.homedir(), 'Sonoya NFC Reader.exe');
	
		const regeditContent = `[HKEY_CURRENT_USER${registryKeyPath}]"${appName}"="${appPath}"`;
	
		const regeditPath = path.resolve(os.homedir(), 'register-startup.reg');
	
		fs.writeFileSync(regeditPath, regeditContent, 'utf-8');
		//console.log(`Le fichier de lancement automatique a été créé : ${regeditPath}`);
	}
}

