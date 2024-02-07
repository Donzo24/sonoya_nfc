import fs from "fs";
import os from "os";
import path from "path";

const appName = 'sonoya';

if (os.platform() === 'darwin') {
  // Configuration spécifique pour macOS
  const plistContent = `
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${appName}</string>
    <key>ProgramArguments</key>
    <array>
      <string>${path.resolve(os.homedir(), 'Applications', `${appName}.app`, 'Contents', 'MacOS', appName)}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
  </dict>
  </plist>
  `;

  const plistPath = path.resolve(os.homedir(), 'Library', 'LaunchAgents', `${appName}.plist`);

  fs.writeFileSync(plistPath, plistContent, 'utf-8');
  //console.log(`Le fichier de lancement automatique a été créé : ${plistPath}`);
} else if (os.platform() === 'win32') {
  // Configuration spécifique pour Windows
  const registryKeyPath = '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
  const appPath = path.resolve(os.homedir(), 'sonoya.exe');

  const regeditContent = `
  [HKEY_CURRENT_USER${registryKeyPath}]
  "${appName}"="${appPath}"
  `;

  const regeditPath = path.resolve(os.homedir(), 'register-startup.reg');

  fs.writeFileSync(regeditPath, regeditContent, 'utf-8');
  //console.log(`Le fichier de lancement automatique a été créé : ${regeditPath}`);
} else {
  //console.error('OS non pris en charge.');
}

