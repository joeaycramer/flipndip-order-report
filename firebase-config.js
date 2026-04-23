// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCg6Bg-fg2RfDGLVqFxyK1uiUaV5ltI11s",
  authDomain: "flipndiptest-88d31.firebaseapp.com",
  projectId: "flipndiptest-88d31",
  storageBucket: "flipndiptest-88d31.firebasestorage.app",
  messagingSenderId: "149752829146",
  appId: "1:149752829146:web:5f9b31202e1820415e01e3",
  measurementId: "G-KJJRD2GLF4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('✓ Firebase initialized successfully');

// Function to save CSV file metadata to Firebase
async function saveCSVMetadata(fileName, timestamp, csvContent) {
  try {
    console.log('Starting to save CSV to Firebase...');
    console.log('  File name:', fileName);
    console.log('  CSV Content length:', csvContent ? csvContent.length : 'null');
    
    const docData = {
      fileName: fileName,
      timestamp: timestamp || new Date(),
      uploadedAt: new Date().toISOString(),
      content: csvContent,  // Store the complete CSV content
      size: new Blob([csvContent]).size
    };
    
    console.log('Document data:', {
      fileName: docData.fileName,
      uploadedAt: docData.uploadedAt,
      size: docData.size,
      contentLength: docData.content.length
    });
    
    const docRef = await addDoc(collection(db, 'csvFiles'), docData);
    
    console.log('✅ CSV metadata and content saved to Firebase');
    console.log('  Document ID:', docRef.id);
    
    // Reload recent files list immediately
    console.log('Reloading recent files after save...');
    await loadRecentFilesData();
  } catch (error) {
    console.error('❌ Error saving CSV metadata:', error);
    console.error('  Error code:', error.code);
    console.error('  Error message:', error.message);
    alert(`Error saving file to Firebase: ${error.message}`);
  }
}

// Function to load recent files from Firebase
async function loadRecentFilesData() {
  try {
    console.log('Loading recent files from Firebase...');
    const q = query(
      collection(db, 'csvFiles'),
      orderBy('uploadedAt', 'desc'),
      limit(5)
    );
    
    console.log('Query created, fetching documents...');
    const querySnapshot = await getDocs(q);
    
    console.log('✅ Query completed, found', querySnapshot.size, 'files');
    const files = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('  - File:', data.fileName, '(', (data.size / 1024).toFixed(1), 'KB )');
      files.push({
        id: doc.id,
        ...data
      });
    });
    
    displayRecentFiles(files);
  } catch (error) {
    console.error('❌ Error loading recent files:', error);
    console.error('  Error code:', error.code);
    console.error('  Error message:', error.message);
  }
}

// Function to delete all recent files from Firebase
async function deleteAllRecentFiles() {
  try {
    console.log('Starting to delete all recent files...');
    const q = query(
      collection(db, 'csvFiles')
    );
    
    const querySnapshot = await getDocs(q);
    let deletedCount = 0;
    
    console.log('Found', querySnapshot.size, 'documents to delete');
    
    for (const doc of querySnapshot.docs) {
      try {
        await deleteDoc(doc.ref);
        deletedCount++;
        console.log('  Deleted:', doc.data().fileName);
      } catch (err) {
        console.error('  Error deleting document:', err);
      }
    }
    
    console.log('✅ Deleted', deletedCount, 'files from Firebase');
    alert(`✅ Deleted ${deletedCount} recent files`);
    
    // Refresh the display
    await loadRecentFilesData();
  } catch (error) {
    console.error('❌ Error deleting recent files:', error);
    alert('Error deleting files: ' + error.message);
  }
}
function displayRecentFiles(files) {
  const recentFilesSection = document.getElementById('recent-files-section');
  const recentFilesList = document.getElementById('recent-files-list');
  
  if (!recentFilesSection || !recentFilesList) return;
  
  if (files.length === 0) {
    recentFilesSection.style.display = 'none';
    return;
  }
  
  recentFilesSection.style.display = 'block';
  recentFilesList.innerHTML = '';
  
  // Add reset button
  const resetBtn = document.createElement('button');
  resetBtn.textContent = '🔄 Reset All';
  resetBtn.style.cssText = `
    padding: 0.5rem 0.75rem;
    background: #e74c3c;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: bold;
    transition: background 0.2s ease;
    white-space: nowrap;
    line-height: 1.2;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  `;
  resetBtn.onmouseover = () => resetBtn.style.background = '#c0392b';
  resetBtn.onmouseout = () => resetBtn.style.background = '#e74c3c';
  resetBtn.onclick = () => {
    if (confirm('Delete all recent files? This cannot be undone.')) {
      deleteAllRecentFiles();
    }
  };
  recentFilesList.appendChild(resetBtn);
  
  // Use compact display if more than 3 files
  const useCompactDisplay = files.length > 3;
  
  files.forEach((file, index) => {
    const date = new Date(file.uploadedAt);
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    const fileSize = file.size ? (file.size / 1024).toFixed(1) + ' KB' : 'N/A';
    
    // Compact display: show only first 3 letters of filename if more than 3 files
    let displayName = file.fileName;
    if (useCompactDisplay) {
      displayName = file.fileName.substring(0, 3).toUpperCase();
    }
    
    const button = document.createElement('button');
    
    if (useCompactDisplay) {
      // Compact version: show only date/time
      button.textContent = `${dateStr}`;
      button.title = `${file.fileName}\n${fileSize}`;
      button.style.cssText = `
        padding: 0.5rem 0.75rem;
        background: #3498db;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: bold;
        transition: background 0.2s ease;
        white-space: nowrap;
        line-height: 1.2;
        height: 100%;
        display: flex;
        align-items: center;
      `;
    } else {
      // Full display version: show only date/time
      button.textContent = `${dateStr}`;
      button.style.cssText = `
        padding: 0.5rem 0.75rem;
        background: #3498db;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: bold;
        transition: background 0.2s ease;
        white-space: nowrap;
        line-height: 1.2;
        height: 100%;
        display: flex;
        align-items: center;
      `;
    }
    
    button.onmouseover = () => button.style.background = '#2980b9';
    button.onmouseout = () => button.style.background = '#3498db';
    button.onclick = () => {
      console.log('Recent file button clicked:', file.fileName);
      loadRecentFile(file);
    };
    
    recentFilesList.appendChild(button);
  });
}

// Function to load a recent file
async function loadRecentFile(file) {
  try {
    console.log('Loading recent file:', file.fileName);
    
    if (!file.content) {
      alert('Error: No content found for this file');
      console.error('No content in file object');
      return;
    }
    
    console.log('Setting csvContent, length:', file.content.length);
    // Set both window.csvContent and window.csvContentData for compatibility
    window.csvContent = file.content;
    window.csvContentData = file.content;
    
    const supplierSelect = document.getElementById('supplier-select');
    if (supplierSelect) {
      supplierSelect.value = '';
      console.log('Reset supplier select');
    }
    
    console.log('Checking functions availability:');
    console.log('  initializeFilter:', typeof window.initializeFilter);
    console.log('  generateReport:', typeof window.generateReport);
    
    // Wait for functions to be available if they're not yet
    let attempts = 0;
    while ((typeof window.initializeFilter !== 'function' || typeof window.generateReport !== 'function') && attempts < 50) {
      console.log('Functions not ready yet, waiting... (attempt ' + (attempts + 1) + '/50)');
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (typeof window.initializeFilter === 'function' && typeof window.generateReport === 'function') {
      console.log('Functions available, initializing...');
      await window.initializeFilter();
      console.log('initializeFilter completed');
      
      await window.generateReport();
      console.log('generateReport completed');
      
      alert(`✅ Loaded: ${file.fileName}`);
      
      const contentEl = document.getElementById('content');
      if (contentEl) {
        contentEl.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      alert('Error: Application functions not loaded. Please refresh the page.');
      console.error('Functions not available after waiting:', {
        initializeFilter: typeof window.initializeFilter,
        generateReport: typeof window.generateReport
      });
    }
  } catch (error) {
    console.error('Error loading recent file:', error);
    alert('Error loading file. Please try again. Check console for details.');
  }
}

// Make functions available globally
window.saveCSVMetadata = saveCSVMetadata;
window.loadRecentFilesNow = loadRecentFilesData;

// Load recent files after a delay to ensure DOM is ready
setTimeout(() => {
  loadRecentFilesData();
}, 1000);
