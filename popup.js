let selectedEntry = null;
let jsonData = [];
let isRunning = false;

// Load JSON data from storage or default file
async function loadJsonData() {
    try {
        // Try to load from storage first
        const result = await chrome.storage.local.get(['pdkiJsonData', 'autoProcess', 'selectedKategori']);
        
        // Check if auto processing is running
        if (result.autoProcess) {
            isRunning = true;
            await updateRunningStatus();
        }
        
        // Load selected kategori if exists
        if (result.selectedKategori) {
            document.getElementById('kategoriSelect').value = result.selectedKategori;
        }
        
        if (result.pdkiJsonData && Array.isArray(result.pdkiJsonData) && result.pdkiJsonData.length > 0) {
            // Use data from storage
            jsonData = result.pdkiJsonData;
            displayEntries();
            updateFileInfo(`Loaded ${jsonData.length} entries from storage`);
            await updateProgressInfo();
        } else {
            // Try to load from default file
            try {
                const response = await fetch(chrome.runtime.getURL('pdki.json'));
                jsonData = await response.json();
                displayEntries();
                updateFileInfo(`Loaded ${jsonData.length} entries from default file`);
                await updateProgressInfo();
            } catch (fileError) {
                // No default file or error loading
                showStatus('Please upload a JSON file to get started', 'info');
                document.getElementById('entryList').innerHTML = '<p>No JSON file loaded. Please upload a JSON file.</p>';
            }
        }
    } catch (error) {
        showStatus('Error loading JSON data: ' + error.message, 'error');
        document.getElementById('entryList').innerHTML = '<p>Error loading data. Please upload a JSON file.</p>';
    }
}

// Update file info display
function updateFileInfo(text) {
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) {
        fileInfo.textContent = text;
    }
}

// Update running status
async function updateRunningStatus() {
    const statusIndicator = document.getElementById('statusIndicator');
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const kategoriSelect = document.getElementById('kategoriSelect');
    
    // Get current status from storage
    const result = await chrome.storage.local.get(['autoProcess', 'pdkiJsonData']);
    const currentRunning = result.autoProcess || false;
    isRunning = currentRunning;
    
    if (isRunning) {
        statusIndicator.className = 'status-indicator running';
        statusIndicator.textContent = '🟢 Status: Running';
        startButton.style.display = 'none';
        stopButton.style.display = 'block';
        kategoriSelect.disabled = true;
        await updateProgressInfo();
    } else {
        statusIndicator.className = 'status-indicator idle';
        statusIndicator.textContent = '⚪ Status: Idle';
        startButton.style.display = 'block';
        stopButton.style.display = 'none';
        kategoriSelect.disabled = false;
        await updateProgressInfo();
    }
}

// Update progress info
async function updateProgressInfo() {
    const progressInfo = document.getElementById('progressInfo');
    
    // Get current data from storage
    const result = await chrome.storage.local.get(['pdkiJsonData', 'autoProcess']);
    const totalEntries = result.pdkiJsonData ? result.pdkiJsonData.length : jsonData.length;
    const isRunning = result.autoProcess || false;
    
    if (totalEntries > 0) {
        if (isRunning) {
            progressInfo.textContent = `🔄 Processing: ${totalEntries} entries remaining`;
            progressInfo.style.color = '#155724';
            progressInfo.style.fontWeight = 'bold';
            progressInfo.style.background = 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)';
            progressInfo.style.borderColor = '#28a745';
        } else {
            progressInfo.textContent = `📊 Total: ${totalEntries} entries`;
            progressInfo.style.color = '#495057';
            progressInfo.style.fontWeight = '600';
            progressInfo.style.background = 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)';
            progressInfo.style.borderColor = '#dee2e6';
        }
    } else {
        progressInfo.textContent = '';
    }
}

// Display entries in the popup
function displayEntries() {
    const entryList = document.getElementById('entryList');
    entryList.innerHTML = '';

    if (jsonData.length === 0) {
        entryList.innerHTML = '<p>No entries found in JSON file</p>';
        document.getElementById('startButton').disabled = true;
        return;
    }

    // Enable start button if we have data and not running
    if (!isRunning) {
        document.getElementById('startButton').disabled = false;
    }

    jsonData.forEach((entry, index) => {
        const entryItem = document.createElement('div');
        entryItem.className = 'entry-item';
        entryItem.innerHTML = `
            <div class="entry-title">${entry.judul || 'No Title'}</div>
            <div class="entry-details">
                Nomor: ${entry.nomorPermohonan || 'N/A'}<br>
                Kode: ${entry.kode || 'N/A'}
            </div>
        `;
        entryItem.addEventListener('click', () => {
            if (!isRunning) {
                document.querySelectorAll('.entry-item').forEach(item => {
                    item.classList.remove('selected');
                });
                entryItem.classList.add('selected');
                selectedEntry = entry;
                document.getElementById('fillButton').disabled = false;
            }
        });
        entryList.appendChild(entryItem);
    });
}

// Show status message
function showStatus(message, type = 'info') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }
}

// Start button click handler - Start auto processing from first entry
document.getElementById('startButton').addEventListener('click', async () => {
    if (jsonData.length === 0) {
        showStatus('No entries found. Please upload JSON file first.', 'error');
        return;
    }

    // Get selected kategori
    const selectedKategori = document.getElementById('kategoriSelect').value;
    if (!selectedKategori) {
        showStatus('Please select a kategori first', 'error');
        return;
    }

    try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Check if URL is a SINTA IPR page (ipradd or iprs)
        const isSintaIprPage = tab.url.includes('sinta.kemdiktisaintek.go.id/profile/ipr');
        if (!isSintaIprPage) {
            showStatus('Please navigate to SINTA IPR page first (ipradd or iprs)', 'error');
            return;
        }

        // Enable auto processing mode and save kategori
        await chrome.storage.local.set({ 
            autoProcess: true,
            currentEntryIndex: 0,
            selectedKategori: selectedKategori
        });

        // Update UI
        isRunning = true;
        await updateRunningStatus();

        // Get first entry
        const firstEntry = jsonData[0];
        if (!firstEntry) {
            showStatus('No entries available', 'error');
            isRunning = false;
            updateRunningStatus();
            await chrome.storage.local.set({ autoProcess: false });
            return;
        }

        // Check page type
        const pageType = tab.url.includes('/profile/ipradd') ? 'ipradd' : 'iprs';
        
        if (pageType === 'ipradd') {
            // We're already on ipradd page, fill form directly
            // Ensure content script is loaded
            let contentScriptReady = false;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (!contentScriptReady && retryCount < maxRetries) {
                try {
                    const response = await chrome.tabs.sendMessage(tab.id, {
                        action: 'ping'
                    });
                    
                    if (response && response.status === 'ready') {
                        contentScriptReady = true;
                    }
                } catch (error) {
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['content.js']
                        });
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        retryCount++;
                    } catch (injectError) {
                        retryCount++;
                        if (retryCount >= maxRetries) {
                            throw new Error('Could not inject content script.');
                        }
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }
            
            if (contentScriptReady) {
                // Send message to fill form with first entry
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'fillForm',
                    data: firstEntry,
                    entryIndex: 0
                });
                
                showStatus(`Starting auto fill: ${jsonData.length} entries remaining...`, 'info');
            }
        } else {
            // We're on iprs page, click Add IPR first
            let contentScriptReady = false;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (!contentScriptReady && retryCount < maxRetries) {
                try {
                    const response = await chrome.tabs.sendMessage(tab.id, {
                        action: 'ping'
                    });
                    
                    if (response && response.status === 'ready') {
                        contentScriptReady = true;
                    }
                } catch (error) {
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['content.js']
                        });
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        retryCount++;
                    } catch (injectError) {
                        retryCount++;
                        if (retryCount >= maxRetries) {
                            throw new Error('Could not inject content script.');
                        }
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }
            
            if (contentScriptReady) {
                // Click Add IPR button - autoDetectAndProcess will handle the rest
                showStatus(`Starting auto fill: ${jsonData.length} entries...`, 'info');
            }
        }
        
        // Close popup after a short delay
        setTimeout(() => {
            window.close();
        }, 500);
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error: ' + error.message, 'error');
        isRunning = false;
        await updateRunningStatus();
        await chrome.storage.local.set({ autoProcess: false });
    }
});

// Stop button click handler
document.getElementById('stopButton').addEventListener('click', async () => {
    try {
        // Disable auto processing
        await chrome.storage.local.set({ 
            autoProcess: false,
            currentEntryIndex: undefined
        });

        // Update UI
        isRunning = false;
        await updateRunningStatus();

        showStatus('Auto fill stopped', 'info');
        
        // Get active tab and send stop message
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url.includes('sinta.kemdiktisaintek.go.id/profile/ipr')) {
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'stop'
                });
            } catch (error) {
                console.log('Could not send stop message to content script');
            }
        }
        
    } catch (error) {
        console.error('Error stopping:', error);
        showStatus('Error stopping: ' + error.message, 'error');
    }
});

// Fill form button click handler (kept for backward compatibility)
document.getElementById('fillButton').addEventListener('click', async () => {
    if (!selectedEntry) {
        showStatus('Please select an entry', 'error');
        return;
    }

    try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Check if URL is a SINTA IPR page
        const isSintaIprPage = tab.url.includes('sinta.kemdiktisaintek.go.id/profile/ipr');
        if (!isSintaIprPage) {
            showStatus('Please navigate to SINTA IPR page first', 'error');
            return;
        }

        // Ensure content script is loaded
        let contentScriptReady = false;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!contentScriptReady && retryCount < maxRetries) {
            try {
                const response = await chrome.tabs.sendMessage(tab.id, {
                    action: 'ping'
                });
                
                if (response && response.status === 'ready') {
                    contentScriptReady = true;
                }
            } catch (error) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    retryCount++;
                } catch (injectError) {
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        throw new Error('Could not inject content script.');
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }
        
        if (!contentScriptReady) {
            throw new Error('Content script failed to load.');
        }

        // Get current entry index from JSON data
        const entryIndex = jsonData.findIndex(entry => 
            entry.nomorPermohonan === selectedEntry.nomorPermohonan
        );
        
        // Enable auto processing mode
        await chrome.storage.local.set({ 
            autoProcess: true,
            currentEntryIndex: entryIndex
        });
        
        // Send message to fill form
        await chrome.tabs.sendMessage(tab.id, {
            action: 'fillForm',
            data: selectedEntry,
            entryIndex: entryIndex
        });

        showStatus(`Processing entry ${entryIndex + 1}/${jsonData.length}. Auto-processing enabled...`, 'info');
        
        setTimeout(() => {
            window.close();
        }, 500);
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error: ' + error.message, 'error');
        await chrome.storage.local.set({ autoProcess: false });
    }
});

// File upload handler
document.getElementById('uploadButton').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    
    if (!file) {
        return;
    }
    
    // Check if file is JSON
    if (!file.name.endsWith('.json')) {
        showStatus('Please select a JSON file', 'error');
        return;
    }
    
    try {
        // Read file
        const fileText = await file.text();
        const parsedData = JSON.parse(fileText);
        
        // Validate JSON structure (should be an array)
        if (!Array.isArray(parsedData)) {
            showStatus('Invalid JSON format. Expected an array.', 'error');
            return;
        }
        
        // Validate entries have required fields (optional check, just warn)
        const validEntriesCount = parsedData.filter(entry => 
            entry.nomorPermohonan && entry.judul
        ).length;
        
        if (validEntriesCount === 0 && parsedData.length > 0) {
            showStatus('Warning: JSON file may not have valid entries', 'error');
            // Still continue to load the data
        }
        
        // Save to storage
        jsonData = parsedData;
        await chrome.storage.local.set({ pdkiJsonData: parsedData });
        
        // Update UI
        displayEntries();
        updateFileInfo(`Loaded ${parsedData.length} entries from: ${file.name}`);
        await updateProgressInfo();
        
        if (parsedData.length > 0) {
            showStatus(`Successfully loaded ${parsedData.length} entries`, 'success');
        } else {
            showStatus('JSON file is empty', 'error');
        }
        
        // Reset file input
        event.target.value = '';
        
        // Clear selection if any
        selectedEntry = null;
        document.getElementById('fillButton').disabled = true;
        
    } catch (error) {
        if (error instanceof SyntaxError) {
            showStatus('Invalid JSON format: ' + error.message, 'error');
        } else {
            showStatus('Error reading file: ' + error.message, 'error');
        }
        console.error('File upload error:', error);
    }
});

// Clear data button handler
document.getElementById('clearButton').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear the uploaded data?')) {
        try {
            // Clear storage
            await chrome.storage.local.remove('pdkiJsonData');
            
            // Clear UI
            jsonData = [];
            selectedEntry = null;
            document.getElementById('fillButton').disabled = true;
            document.getElementById('entryList').innerHTML = '<p>No JSON file loaded. Please upload a JSON file.</p>';
            updateFileInfo('');
            await updateProgressInfo();
            
            // Try to load from default file
            try {
                const response = await fetch(chrome.runtime.getURL('pdki.json'));
                jsonData = await response.json();
                displayEntries();
                updateFileInfo(`Loaded ${jsonData.length} entries from default file`);
                await updateProgressInfo();
                showStatus('Cleared uploaded data. Loaded default file.', 'success');
            } catch (fileError) {
                showStatus('Data cleared. Please upload a JSON file.', 'info');
            }
        } catch (error) {
            showStatus('Error clearing data: ' + error.message, 'error');
        }
    }
});

// Monitor storage changes to update UI
chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local') {
        // Update progress info when data changes
        if (changes.pdkiJsonData) {
            jsonData = changes.pdkiJsonData.newValue || [];
            await updateProgressInfo();
        }
        
        // Update running status when autoProcess changes
        if (changes.autoProcess) {
            isRunning = changes.autoProcess.newValue || false;
            await updateRunningStatus();
        }
    }
});

// Load data when popup opens
loadJsonData();

