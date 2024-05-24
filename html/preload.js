import { ipcRenderer } from "electron";

window.addEventListener('DOMContentLoaded', () => {
	
	const statusText = document.getElementById('status-text');
	const button = document.getElementById('toggle-button');
  
	button.addEventListener('click', () => {
	  	ipcRenderer.send('toggle-status');
	});
  
	ipcRenderer.on('status-changed', (event, status) => {
	  	statusText.textContent = status ? 'Allumer' : 'Éteint';
	});
});
  