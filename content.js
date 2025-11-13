// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
        // Respond to ping to confirm content script is loaded
        sendResponse({ status: 'ready' });
        return true;
    }
    
    if (request.action === 'fillForm') {
        fillForm(request.data, request.entryIndex).then(() => {
            sendResponse({ status: 'completed' });
        }).catch((error) => {
            sendResponse({ status: 'error', error: error.message });
        });
        return true; // Keep the message channel open for async response
    }
    
    if (request.action === 'clickAddIpr') {
        clickAddIprButton();
        sendResponse({ status: 'clicked' });
        return true;
    }
    
    if (request.action === 'checkPage') {
        const pageType = getPageType();
        sendResponse({ pageType: pageType });
        return true;
    }
    
    if (request.action === 'stop') {
        // Stop auto processing
        chrome.storage.local.set({ 
            autoProcess: false,
            currentEntryIndex: undefined
        });
        sendResponse({ status: 'stopped' });
        return true;
    }
    
    return false;
});

// Get page type based on URL
function getPageType() {
    const url = window.location.href;
    if (url.includes('/profile/ipradd')) {
        return 'ipradd';
    } else if (url.includes('/profile/iprs')) {
        return 'iprs';
    }
    return 'unknown';
}

// Click Add IPR button on IPR list page
async function clickAddIprButton() {
    try {
        console.log('Looking for Add IPR button...');
        
        // Find Add IPR button
        let addButton = document.querySelector('a[href*="/profile/ipradd"]');
        
        if (!addButton) {
            // Try to find by text content
            const links = document.querySelectorAll('a.btn-primary, a.btn');
            links.forEach(link => {
                if (link.textContent.includes('Add IPR') || link.textContent.includes('add IPR')) {
                    addButton = link;
                }
            });
        }
        
        if (addButton) {
            console.log('Add IPR button found, clicking...');
            // Wait a bit before clicking
            await sleep(1000);
            addButton.click();
            console.log('Add IPR button clicked');
            
            // After clicking, wait for navigation and let autoDetectAndProcess handle the rest
            // The URL monitor will detect the change and trigger autoDetectAndProcess
        } else {
            console.error('Add IPR button not found');
        }
    } catch (error) {
        console.error('Error clicking Add IPR button:', error);
    }
}

// Flag to prevent multiple executions
let isProcessing = false;

// Auto-detect page type and perform action
async function autoDetectAndProcess() {
    // Prevent multiple executions
    if (isProcessing) {
        console.log('Already processing, skipping...');
        return;
    }
    
    // Check if auto processing is enabled
    const checkResult = await chrome.storage.local.get(['autoProcess']);
    if (!checkResult.autoProcess) {
        console.log('Auto processing is disabled');
        isProcessing = false;
        return;
    }
    
    const pageType = getPageType();
    console.log('Page type detected:', pageType);
    
    if (pageType === 'iprs') {
        // Check if we need to click Add IPR
        const result = await chrome.storage.local.get(['autoProcess', 'pdkiJsonData']);
        
        if (result.autoProcess) {
            const jsonData = result.pdkiJsonData || [];
            
            if (jsonData.length > 0) {
                isProcessing = true;
                console.log('Auto processing enabled, clicking Add IPR...');
                console.log(`Remaining entries: ${jsonData.length}`);
                
                try {
                    // Wait for page to fully load
                    await sleep(3000);
                    
                    // Click Add IPR button
                    await clickAddIprButton();
                    
                    // After clicking, the URL monitor will detect navigation to ipradd
                    // and trigger autoDetectAndProcess which will fill the form
                    // We don't need to wait here as the URL monitor handles it
                } catch (error) {
                    console.error('Error in autoDetectAndProcess (iprs):', error);
                    isProcessing = false;
                }
            } else {
                console.log('All entries processed!');
                // Clear auto process flag
                await chrome.storage.local.set({ 
                    autoProcess: false,
                    currentEntryIndex: undefined
                });
                alert('All entries have been processed successfully!');
                isProcessing = false;
            }
        }
    } else if (pageType === 'ipradd') {
        // We're on ipradd page, check if we need to fill form
        const result = await chrome.storage.local.get(['autoProcess', 'pdkiJsonData', 'shouldFillForm']);
        
        if (result.autoProcess) {
            const jsonData = result.pdkiJsonData || [];
            const shouldFill = result.shouldFillForm !== false; // Default to true if not set
            
            if (jsonData.length > 0 && shouldFill && !isProcessing) {
                isProcessing = true;
                console.log('Auto processing enabled on ipradd page');
                console.log(`Remaining entries: ${jsonData.length}`);
                
                try {
                    // Wait for page to fully load
                    await sleep(4000);
                    
                    // Check again if auto processing is still enabled
                    const checkAgain = await chrome.storage.local.get(['autoProcess']);
                    if (!checkAgain.autoProcess) {
                        console.log('Auto processing stopped');
                        isProcessing = false;
                        return;
                    }
                    
                    // Check if form fields are ready
                    const nomorPermohonanField = document.getElementById('nomor_permohonan');
                    if (!nomorPermohonanField) {
                        console.log('Form not ready yet, retrying...');
                        isProcessing = false;
                        // Retry after delay
                        setTimeout(() => {
                            autoDetectAndProcess();
                        }, 2000);
                        return;
                    }
                    
                    // Get first entry (index 0)
                    const firstEntry = jsonData[0];
                    if (firstEntry) {
                        // Mark that we're filling form to prevent duplicate
                        await chrome.storage.local.set({ shouldFillForm: false });
                        
                        // Wait a bit more for form to be fully ready
                        await sleep(2000);
                        
                        // Check again if auto processing is still enabled
                        const checkFinal = await chrome.storage.local.get(['autoProcess']);
                        if (!checkFinal.autoProcess) {
                            console.log('Auto processing stopped before filling form');
                            isProcessing = false;
                            await chrome.storage.local.set({ shouldFillForm: true });
                            return;
                        }
                        
                        // Fill form with first entry
                        console.log(`Processing entry (1/${jsonData.length})...`);
                        await fillForm(firstEntry, 0);
                    }
                } catch (error) {
                    console.error('Error in autoDetectAndProcess (ipradd):', error);
                    isProcessing = false;
                    // Reset flag on error so it can retry
                    await chrome.storage.local.set({ shouldFillForm: true });
                }
            } else if (jsonData.length === 0) {
                console.log('All entries processed!');
                await chrome.storage.local.set({ 
                    autoProcess: false,
                    currentEntryIndex: undefined,
                    shouldFillForm: true
                });
                alert('All entries have been processed successfully!');
                isProcessing = false;
            } else if (!shouldFill) {
                console.log('Form already being processed, skipping...');
            }
        } else {
            // Reset processing flag when auto processing is disabled
            isProcessing = false;
        }
    }
}

// Monitor URL changes for redirect detection
let lastUrl = window.location.href;
let urlCheckInterval = null;

// Check URL periodically
const checkUrl = async () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('URL changed to:', currentUrl);
        
        // Reset processing flag on URL change
        isProcessing = false;
        
        // Check if we're on IPR page (iprs or ipradd)
        if (currentUrl.includes('/profile/iprs') || currentUrl.includes('/profile/ipradd')) {
            // Set flag to fill form when navigating to ipradd
            if (currentUrl.includes('/profile/ipradd')) {
                await chrome.storage.local.set({ shouldFillForm: true });
            }
            
            // Small delay to ensure page is loaded
            setTimeout(() => {
                autoDetectAndProcess();
            }, 3000);
        }
    }
};

// Start monitoring URL changes
urlCheckInterval = setInterval(checkUrl, 1000);

// Also listen for popstate event (back/forward navigation)
window.addEventListener('popstate', () => {
    setTimeout(() => {
        checkUrl();
    }, 1000);
});

// Run auto-detect when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoDetectAndProcess);
} else {
    autoDetectAndProcess();
}

// Function to fill the form
async function fillForm(data, entryIndex = null) {
    try {
        // Check if auto processing is still enabled
        const checkResult = await chrome.storage.local.get(['autoProcess']);
        if (!checkResult.autoProcess) {
            console.log('Auto processing stopped, aborting form fill');
            isProcessing = false;
            return;
        }
        
        console.log('Starting form fill with data:', data);
        console.log('Entry index:', entryIndex);

        // Fill nomor_permohonan
        const nomorPermohonanField = document.getElementById('nomor_permohonan');
        if (!nomorPermohonanField) {
            console.error('Form field not found. Please make sure you are on the IPR claim page.');
            return;
        }

        nomorPermohonanField.value = data.nomorPermohonan || '';
        
        // Trigger input event to ensure the field is recognized
        nomorPermohonanField.dispatchEvent(new Event('input', { bubbles: true }));
        nomorPermohonanField.dispatchEvent(new Event('change', { bubbles: true }));

        // Wait a bit for the field to be ready
        await sleep(500);
        
        // Check again if auto processing is still enabled
        const checkAgain = await chrome.storage.local.get(['autoProcess']);
        if (!checkAgain.autoProcess) {
            console.log('Auto processing stopped before clicking Check IPR');
            isProcessing = false;
            return;
        }

        // Click the Check IPR button
        const checkButton = document.getElementById('checkipr');
        if (!checkButton) {
            console.error('Check IPR button not found.');
            return;
        }

        // Check if button is disabled
        if (checkButton.disabled) {
            checkButton.disabled = false;
            checkButton.removeAttribute('disabled');
        }

        // Click the button
        checkButton.click();

        // Wait for the AJAX response
        await waitForAjaxResponse(data, entryIndex);

    } catch (error) {
        console.error('Error filling form:', error);
        isProcessing = false;
    }
}

// Wait for AJAX response and fill form if needed
async function waitForAjaxResponse(jsonData, entryIndex = null) {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 30; // Wait up to 30 seconds
        
        const checkInterval = setInterval(() => {
            attempts++;
            
            // Check if button text changed back (AJAX completed)
            const checkButton = document.getElementById('checkipr');
            if (!checkButton) {
                clearInterval(checkInterval);
                resolve();
                return;
            }
            
            const buttonText = checkButton.textContent.trim();
            const buttonHtml = checkButton.innerHTML;
            
            // Check if button is in loading state
            // Button is loading if it contains spinner or "Checking..."
            const isLoading = buttonHtml.includes('spinner') || 
                             buttonText.includes('Checking...') ||
                             buttonHtml.includes('spinner-border');
            
            // Check if AJAX is complete (button text is "Check IPR" and not loading)
            // Button may be disabled after successful response, so check text not loading state
            const isComplete = !isLoading && buttonText === 'Check IPR';
            
            // Also check if form fields have been populated (secondary check)
            const titleField = document.getElementById('title');
            const hasDataPopulated = titleField && titleField.value && titleField.value.trim() !== '';
            
            // If button is not loading and either button text is correct OR form has data
            if (isComplete || (attempts > 3 && hasDataPopulated)) {
                clearInterval(checkInterval);
                
                // Wait a bit more for the form fields to be populated by AJAX
                setTimeout(() => {
                    checkFormAndFill(jsonData, entryIndex);
                    resolve();
                }, 1500);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.log('Timeout waiting for AJAX response');
                // Try to fill anyway
                setTimeout(() => {
                    checkFormAndFill(jsonData, entryIndex);
                    resolve();
                }, 1000);
            }
        }, 800);
    });
}

// Check if form fields are empty and fill them
async function checkFormAndFill(jsonData, entryIndex = null) {
    // Check if auto processing is still enabled
    const checkResult = await chrome.storage.local.get(['autoProcess']);
    if (!checkResult.autoProcess) {
        console.log('Auto processing stopped, aborting form fill');
        isProcessing = false;
        return;
    }
    
    console.log('Checking form fields and filling if needed');
    console.log('Entry index:', entryIndex);
    
    // Get all form fields
    const kategori = document.getElementById('kategori');
    const tahunPermohonan = document.getElementById('tahun_permohonan');
    const pemegangPaten = document.getElementById('pemegang_paten');
    const inventor = document.getElementById('inventor');
    const title = document.getElementById('title');
    const statusIpr = document.getElementById('status_ipr');
    const noPublikasi = document.getElementById('no_publikasi');
    const tglPublikasi = document.getElementById('tgl_publikasi');
    const fillingDate = document.getElementById('filling_date');
    const receptionDate = document.getElementById('reception_date');
    const noRegistrasi = document.getElementById('no_registrasi');
    const tglRegistrasi = document.getElementById('tgl_registrasi');

    // Count empty fields (check if value exists and is not empty)
    let emptyCount = 0;
    const fieldsToCheck = [
        { field: kategori, name: 'kategori' },
        { field: tahunPermohonan, name: 'tahun_permohonan' },
        { field: pemegangPaten, name: 'pemegang_paten' },
        { field: inventor, name: 'inventor' },
        { field: title, name: 'title' },
        { field: statusIpr, name: 'status_ipr' },
        { field: noPublikasi, name: 'no_publikasi' },
        { field: tglPublikasi, name: 'tgl_publikasi' },
        { field: fillingDate, name: 'filling_date' },
        { field: receptionDate, name: 'reception_date' },
        { field: noRegistrasi, name: 'no_registrasi' },
        { field: tglRegistrasi, name: 'tgl_registrasi' }
    ];

    fieldsToCheck.forEach(({ field, name }) => {
        if (!field) {
            emptyCount++;
            console.log(`Field ${name} not found`);
        } else if (!field.value || field.value.trim() === '' || field.value === '0') {
            emptyCount++;
            console.log(`Field ${name} is empty`);
        } else {
            console.log(`Field ${name} has value: ${field.value}`);
        }
    });

    console.log(`Empty fields count: ${emptyCount} out of ${fieldsToCheck.length}`);

    // Check again if auto processing is still enabled
    const checkAgain = await chrome.storage.local.get(['autoProcess']);
    if (!checkAgain.autoProcess) {
        console.log('Auto processing stopped before filling form');
        isProcessing = false;
        return;
    }

    // If more than 6 fields are empty, fill with JSON data
    // This means the API response didn't have enough data
    if (emptyCount > 6) {
        console.log('Many fields are empty. Filling with JSON data...');
        await fillFormWithJsonData(jsonData, entryIndex);
    } else {
        console.log('Form already has sufficient data from API. Leaving as is.');
        // Submit form after a short delay to ensure form is ready
        await sleep(1500);
        
        // Check one more time before submitting
        const checkFinal = await chrome.storage.local.get(['autoProcess']);
        if (checkFinal.autoProcess) {
            await submitForm(entryIndex);
        } else {
            console.log('Auto processing stopped before submitting form');
            isProcessing = false;
        }
    }
}

// Fill form with JSON data
async function fillFormWithJsonData(data, entryIndex = null) {
    try {
        console.log('Filling form with JSON data, entryIndex:', entryIndex);
        
        // Check if auto processing is still enabled
        const result = await chrome.storage.local.get(['autoProcess', 'selectedKategori']);
        if (!result.autoProcess) {
            console.log('Auto processing stopped, aborting form fill');
            return;
        }
        
        // Get selected kategori from storage
        const selectedKategori = result.selectedKategori || 'hak cipta';
        console.log('Using kategori:', selectedKategori);
        
        // Fill kategori - use selected kategori from storage
        const kategori = document.getElementById('kategori');
        if (kategori) {
            kategori.value = selectedKategori;
            kategori.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Fill tahun_permohonan - extract year from tanggalPermohonan
        const tahunPermohonan = document.getElementById('tahun_permohonan');
        if (tahunPermohonan && data.tanggalPermohonan) {
            // Extract year from YYYY-MM-DD format (first 4 characters)
            const year = data.tanggalPermohonan.substring(0, 4);
            tahunPermohonan.value = year;
            tahunPermohonan.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Fill pemegang_paten - get first pemegang name
        const pemegangPaten = document.getElementById('pemegang_paten');
        if (pemegangPaten && data.pemegang && data.pemegang.length > 0) {
            pemegangPaten.value = data.pemegang[0].nama || '';
            pemegangPaten.dispatchEvent(new Event('input', { bubbles: true }));
            pemegangPaten.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Fill inventor - combine all pencipta names
        const inventor = document.getElementById('inventor');
        if (inventor && data.pencipta && data.pencipta.length > 0) {
            const inventorNames = data.pencipta.map(p => p.nama).join(', ');
            inventor.value = inventorNames;
            inventor.dispatchEvent(new Event('input', { bubbles: true }));
            inventor.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Fill title
        const title = document.getElementById('title');
        if (title && data.judul) {
            title.value = data.judul;
            title.dispatchEvent(new Event('input', { bubbles: true }));
            title.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Fill status_ipr
        const statusIpr = document.getElementById('status_ipr');
        if (statusIpr) {
            statusIpr.value = 'Diterima';
            statusIpr.dispatchEvent(new Event('input', { bubbles: true }));
            statusIpr.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Fill no_publikasi
        const noPublikasi = document.getElementById('no_publikasi');
        if (noPublikasi && data.kode) {
            noPublikasi.value = data.kode;
            noPublikasi.dispatchEvent(new Event('input', { bubbles: true }));
            noPublikasi.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Fill tgl_publikasi - format date to YYYY-MM-DD
        const tglPublikasi = document.getElementById('tgl_publikasi');
        if (tglPublikasi && data.tanggalPencatatan) {
            const date = formatDate(data.tanggalPencatatan);
            tglPublikasi.value = date;
            tglPublikasi.dispatchEvent(new Event('input', { bubbles: true }));
            tglPublikasi.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Fill filling_date
        const fillingDate = document.getElementById('filling_date');
        if (fillingDate && data.tanggalPermohonan) {
            const date = formatDate(data.tanggalPermohonan);
            fillingDate.value = date;
            fillingDate.dispatchEvent(new Event('input', { bubbles: true }));
            fillingDate.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Fill reception_date
        const receptionDate = document.getElementById('reception_date');
        if (receptionDate && data.tanggalPencatatan) {
            const date = formatDate(data.tanggalPencatatan);
            receptionDate.value = date;
            receptionDate.dispatchEvent(new Event('input', { bubbles: true }));
            receptionDate.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Fill no_registrasi
        const noRegistrasi = document.getElementById('no_registrasi');
        if (noRegistrasi && data.kode) {
            noRegistrasi.value = data.kode;
            noRegistrasi.dispatchEvent(new Event('input', { bubbles: true }));
            noRegistrasi.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Fill tgl_registrasi
        const tglRegistrasi = document.getElementById('tgl_registrasi');
        if (tglRegistrasi && data.tanggalPencatatan) {
            const date = formatDate(data.tanggalPencatatan);
            tglRegistrasi.value = date;
            tglRegistrasi.dispatchEvent(new Event('input', { bubbles: true }));
            tglRegistrasi.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Make fields editable if they are readonly
        // Remove readonly attribute and disable-click class
        const fieldsToMakeEditable = [
            { field: kategori, isSelect: true },
            { field: tahunPermohonan, isSelect: false },
            { field: pemegangPaten, isSelect: false },
            { field: inventor, isSelect: false },
            { field: title, isSelect: false },
            { field: statusIpr, isSelect: false },
            { field: noPublikasi, isSelect: false },
            { field: tglPublikasi, isSelect: false },
            { field: fillingDate, isSelect: false },
            { field: receptionDate, isSelect: false },
            { field: noRegistrasi, isSelect: false },
            { field: tglRegistrasi, isSelect: false }
        ];

        fieldsToMakeEditable.forEach(({ field, isSelect }) => {
            if (field) {
                field.removeAttribute('readonly');
                field.readOnly = false;
                // Remove disable-click class if it exists (for select fields)
                if (isSelect && field.classList) {
                    field.classList.remove('disable-click');
                }
            }
        });

        // Initialize datepickers if needed
        if (typeof $ !== 'undefined' && $.fn.datepicker) {
            // Reinitialize datepickers
            if (tglPublikasi) {
                $(tglPublikasi).datepicker({
                    format: "yyyy-mm-dd"
                });
            }
            if (fillingDate) {
                $(fillingDate).datepicker({
                    format: "yyyy-mm-dd"
                });
            }
            if (receptionDate) {
                $(receptionDate).datepicker({
                    format: "yyyy-mm-dd"
                });
            }
            if (tglRegistrasi) {
                $(tglRegistrasi).datepicker({
                    format: "yyyy-mm-dd"
                });
            }
            if (tahunPermohonan) {
                $(tahunPermohonan).datepicker({
                    format: "yyyy",
                    viewMode: "years",
                    minViewMode: "years"
                });
            }
        }

        console.log('Form filled successfully with JSON data');
        
        // Check again if auto processing is still enabled
        const checkSubmit = await chrome.storage.local.get(['autoProcess']);
        if (!checkSubmit.autoProcess) {
            console.log('Auto processing stopped before submitting form');
            isProcessing = false;
            return;
        }
        
        // Wait a bit to ensure all fields are properly set and datepickers are initialized
        await sleep(1000);
        
        // Check one more time before submitting
        const checkFinal = await chrome.storage.local.get(['autoProcess']);
        if (checkFinal.autoProcess) {
            // Submit form after fields are filled
            await submitForm(entryIndex);
        } else {
            console.log('Auto processing stopped before submitting form');
            isProcessing = false;
        }

    } catch (error) {
        console.error('Error filling form with JSON data:', error);
        console.error('Error details:', error);
        isProcessing = false;
        // Don't show alert, just log error
    }
}

// Format date to YYYY-MM-DD
function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            // If date is invalid, try to parse it differently
            return dateString.split('T')[0]; // Take only date part
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
    }
}

// Mark entry as processed in storage
async function markEntryAsProcessed(entryIndex) {
    try {
        // Check if auto processing is still enabled
        const checkResult = await chrome.storage.local.get(['autoProcess']);
        if (!checkResult.autoProcess) {
            console.log('Auto processing stopped, not marking entry as processed');
            return;
        }
        
        const result = await chrome.storage.local.get(['pdkiJsonData', 'processedEntries']);
        const jsonData = result.pdkiJsonData || [];
        const processedEntries = result.processedEntries || [];
        
        // Add entry index to processed list
        if (!processedEntries.includes(entryIndex)) {
            processedEntries.push(entryIndex);
        }
        
        // Remove processed entry from JSON data
        if (entryIndex >= 0 && entryIndex < jsonData.length) {
            jsonData.splice(entryIndex, 1);
            
            // Update processed entries indices (decrease by 1 for entries after the removed one)
            for (let i = 0; i < processedEntries.length; i++) {
                if (processedEntries[i] > entryIndex) {
                    processedEntries[i]--;
                }
            }
            
            // Save updated data
            await chrome.storage.local.set({
                pdkiJsonData: jsonData,
                processedEntries: processedEntries
            });
            
            console.log(`Entry ${entryIndex} marked as processed and removed from data`);
            console.log(`Remaining entries: ${jsonData.length}`);
        }
    } catch (error) {
        console.error('Error marking entry as processed:', error);
    }
}


// Sleep utility function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Submit form function
async function submitForm(entryIndex = null) {
    try {
        console.log('Attempting to submit form...');
        console.log('Entry index:', entryIndex);
        
        // Try to find submit button by name="claim-ipr" or type="submit"
        // The button has: type="submit" name="claim-ipr" value="1"
        let submitButton = null;
        
        // Method 1: Find by name attribute
        submitButton = document.querySelector('button[name="claim-ipr"]');
        
        // Method 2: Find by type submit in the form
        if (!submitButton) {
            const form = document.querySelector('form[method="POST"]');
            if (form) {
                submitButton = form.querySelector('button[type="submit"]');
            }
        }
        
        // Method 3: Find by text content containing "Claim IPR"
        if (!submitButton) {
            const buttons = document.querySelectorAll('button[type="submit"]');
            buttons.forEach(button => {
                if (button.textContent.includes('Claim IPR') || button.textContent.includes('claim-ipr')) {
                    submitButton = button;
                }
            });
        }
        
        // Method 4: Find by value attribute
        if (!submitButton) {
            submitButton = document.querySelector('button[value="1"][type="submit"]');
        }
        
        if (submitButton) {
            console.log('Submit button found, clicking...');
            
            // Check if button is disabled
            if (submitButton.disabled) {
                console.log('Submit button is disabled, trying to enable it...');
                submitButton.disabled = false;
                submitButton.removeAttribute('disabled');
            }
            
            // Scroll to button to make sure it's visible
            submitButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Wait a bit before clicking
            await new Promise((resolve) => {
                setTimeout(async () => {
                    // Try different methods to click the button
                    try {
                        // Method 1: Direct click
                        submitButton.click();
                        console.log('Submit button clicked');
                        
                        // Mark entry as processed immediately
                        if (entryIndex !== null) {
                            await markEntryAsProcessed(entryIndex);
                            
                            // Reset shouldFillForm flag for next entry
                            await chrome.storage.local.set({ shouldFillForm: true });
                        }
                        
                        resolve();
                        
                        // The redirect will be handled by autoDetectAndProcess
                        // when the page navigates to /profile/iprs
                    } catch (clickError) {
                        console.error('Error clicking submit button:', clickError);
                        // Method 2: Trigger click event
                        try {
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            submitButton.dispatchEvent(clickEvent);
                            console.log('Submit button clicked via event');
                            
                            if (entryIndex !== null) {
                                await markEntryAsProcessed(entryIndex);
                                await chrome.storage.local.set({ shouldFillForm: true });
                            }
                            
                            resolve();
                            
                            // The redirect will be handled by autoDetectAndProcess
                        } catch (eventError) {
                            console.error('Error dispatching click event:', eventError);
                            // Method 3: Submit form directly
                            try {
                                const form = submitButton.closest('form');
                                if (form) {
                                    form.submit();
                                    console.log('Form submitted directly');
                                    
                                    if (entryIndex !== null) {
                                        await markEntryAsProcessed(entryIndex);
                                        await chrome.storage.local.set({ shouldFillForm: true });
                                    }
                                    
                                    resolve();
                                    
                                    // The redirect will be handled by autoDetectAndProcess
                                } else {
                                    resolve();
                                }
                            } catch (submitError) {
                                console.error('Error submitting form:', submitError);
                                console.warn('Could not submit form automatically. Please click the submit button manually.');
                                resolve();
                            }
                        }
                    }
                }, 500);
            });
        } else {
            console.error('Submit button not found');
            // Try to find form and submit it
            const form = document.querySelector('form[method="POST"]');
            if (form) {
                console.log('Form found, submitting directly...');
                setTimeout(() => {
                    try {
                        // Create a submit event and dispatch it
                        const submitEvent = new Event('submit', {
                            bubbles: true,
                            cancelable: true
                        });
                        
                        // Try to trigger form submit event first
                        if (form.dispatchEvent(submitEvent)) {
                            form.submit();
                            console.log('Form submitted directly');
                        } else {
                            console.log('Form submit was cancelled');
                        }
                    } catch (submitError) {
                        console.error('Error submitting form:', submitError);
                        console.warn('Could not submit form automatically. Please click the submit button manually.');
                    }
                }, 500);
            } else {
                console.error('Could not find submit button or form. Please submit manually.');
            }
        }
    } catch (error) {
        console.error('Error in submitForm:', error);
        console.error('Error details:', error);
    }
}

