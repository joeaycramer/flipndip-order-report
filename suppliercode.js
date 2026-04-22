// ── Paramètres ────────────────────────────────────────────────
let CSV_PATH = "raw_materials with PO.csv";
let DAYS_TO_COVER = 90;
let LEAD_TIME = 42;
const MARKERS = [15, 25, 50, 100, 175, 250];
const SUSPICIOUS_SALES_THRESHOLD = 0.1;
const SUSPICIOUS_STOCK_THRESHOLD = 10;
const COVERAGE_OPTIONS = [15, 30, 45, 60];

// Objet pour stocker les modifications par pièce (clé: "Part Name")
let itemModifications = {};

// Objet pour stocker les sélections par pièce
let selectedItems = {};

// ── Helpers ───────────────────────────────────────────────────
function toFloat(val) {
  const num = parseFloat(val);
  return isNaN(num) ? 0.0 : num;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// ── Fonction pour recalculer la quantité avec les modifications ────
function calculateQuantityWithModifications(row, modifiedCoverage = null, modifiedBuffer = null) {
  const stock = row['Stock'] || 0;
  const dailySales = row['Daily Sales'] || 0;
  
  // Utiliser les modifications s'il y en a, sinon utiliser DAYS_TO_COVER et LEAD_TIME
  const coverage = modifiedCoverage !== null ? modifiedCoverage : DAYS_TO_COVER;
  const buffer = modifiedBuffer !== null ? modifiedBuffer : LEAD_TIME;
  
  const totalDays = coverage + buffer;
  const totalNeed = dailySales * totalDays;
  const qtyToOrder = totalNeed - stock;
  
  if (qtyToOrder <= 0) {
    return null; // Pas besoin de commander
  }
  
  const rawQty = Math.ceil(qtyToOrder);
  const isKomacut = row['_komacut'];
  
  if (isKomacut) {
    return roundToUpperMarker(rawQty);
  }
  
  return rawQty;
}

// ── Fonction pour arrondir aux marqueurs ────
function roundToUpperMarker(qty) {
  for (let marker of MARKERS) {
    if (qty <= marker) return marker;
  }
  return Math.ceil(qty / 50) * 50;
}

// ── Exporter un tableau en CSV ───────────────────────────────────
function exportToCSV(rows, categoryName, isGoodMaterials = false, selectedSupplier = '', isIncomingStock = false, filterMode = 'all') {
  // filterMode peut être: 'all' (tous), 'selected' (seulement sélectionnés), 'unselected' (seulement non-sélectionnés)
  
  let filteredRows = rows;
  
  if (filterMode === 'selected') {
    filteredRows = rows.filter(r => selectedItems[r['Part Name']]);
  } else if (filterMode === 'unselected') {
    filteredRows = rows.filter(r => !selectedItems[r['Part Name']]);
  }
  
  if (filteredRows.length === 0) {
    alert('Aucune donnée à exporter pour cette catégorie.');
    return;
  }

  let headers, csvContent;

  if (isIncomingStock) {
    // Pour Incoming Stock, exporter avec la colonne "Lasting Days After Delivery"
    headers = ['Materials', 'Stock', 'Daily Sales', 'Current Days', 'Incoming Inventory', 'Lasting Days After Delivery'];
  } else if (isGoodMaterials) {
    // Pour Good Materials, exporter seulement Materials
    headers = ['Materials'];
  } else {
    // Pour les autres catégories
    const isKomacut = selectedSupplier && selectedSupplier.toLowerCase() === 'komacut';
    const isAllSuppliers = !selectedSupplier || selectedSupplier === '';
    
    // Si supplier est "All Suppliers", fusionner les colonnes en "Quantity"
    if (isAllSuppliers) {
      headers = ['Materials', 'Quantity'];
    } else if (isKomacut) {
      // Si supplier est "komacut", utiliser "Rounded Order Quantity"
      headers = ['Materials', 'Quantity'];
    } else {
      // Pour les autres suppliers, utiliser "Exact Order Quantity"
      headers = ['Materials', 'Quantity'];
    }
  }

  csvContent = headers.map(h => `"${h}"`).join(',') + '\n';

  filteredRows.forEach(r => {
    const rowData = [];
    if (isIncomingStock) {
      // Pour Incoming Stock, exporter tous les détails
      const totalStock = r['Stock'] + r['Incoming Inventory'];
      const dailySales = r['Daily Sales'] || 0;
      const lastingDaysAfterDelivery = dailySales > 0 ? Math.round((totalStock / dailySales) * 10) / 10 : 'N/A';
      
      rowData.push(`"${r['Part Name']}"`);
      rowData.push(`"${r['Stock']}"`);
      rowData.push(`"${r['Daily Sales']}"`);
      rowData.push(`"${r['Current Days']}"`);
      rowData.push(`"${r['Incoming Inventory']}"`);
      rowData.push(`"${lastingDaysAfterDelivery}"`);
    } else if (isGoodMaterials) {
      rowData.push(`"${r['Part Name']}"`);
    } else {
      rowData.push(`"${r['Part Name']}"`);
      
      const isKomacut = selectedSupplier && selectedSupplier.toLowerCase() === 'komacut';
      const isAllSuppliers = !selectedSupplier || selectedSupplier === '';
      
      // Déterminer la quantité à exporter
      let quantity = '';
      if (isAllSuppliers) {
        // Si "All Suppliers", afficher Rounded si disponible, sinon Exact
        if (r['Rounded Order Quantity'] && r['Rounded Order Quantity'] !== '-') {
          quantity = r['Rounded Order Quantity'];
        } else {
          quantity = r['Exact Order Quantity'];
        }
      } else if (isKomacut) {
        // Si "komacut", afficher Rounded
        quantity = r['Rounded Order Quantity'] !== null && r['Rounded Order Quantity'] !== '-' ? r['Rounded Order Quantity'] : '';
      } else {
        // Pour les autres suppliers, afficher Exact
        quantity = r['Exact Order Quantity'];
      }
      
      rowData.push(`"${quantity}"`);
    }
    
    csvContent += rowData.join(',') + '\n';
  });

  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
  element.setAttribute('download', `${categoryName}_${new Date().toISOString().slice(0, 10)}.csv`);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

// ── Exporter tous les items sélectionnés (peu importe la catégorie) ────
function exportAllSelected(selectedSupplier = '') {
  // Collecter tous les items sélectionnés de toutes les catégories
  const allSelectedRows = [];
  
  if (currentData) {
    [currentData.negativeStock, currentData.lowStock, currentData.insufficient, currentData.goodMaterials, currentData.incomingStock]
      .forEach(category => {
        if (category) {
          category.forEach(row => {
            if (selectedItems[row['Part Name']]) {
              allSelectedRows.push(row);
            }
          });
        }
      });
  }

  if (allSelectedRows.length === 0) {
    alert('Aucun élément sélectionné à exporter.');
    return;
  }

  // Lire les valeurs actuelles du DOM (Coverage et Buffer Time)
  const currentCoverage = parseInt(document.getElementById('days-after-delivery').value) || DAYS_TO_COVER;
  const currentBuffer = parseInt(document.getElementById('lead-time').value) || LEAD_TIME;

  // Créer le CSV avec tous les items sélectionnés - SEULEMENT Materials et Quantity
  const headers = ['Materials', 'Quantity'];
  let csvContent = headers.map(h => `"${h}"`).join(',') + '\n';

  allSelectedRows.forEach(r => {
    const rowData = [];
    rowData.push(`"${r['Part Name']}"`);
    
    // Obtenir les modifications pour cette pièce s'il y en a
    const modifications = itemModifications[r['Part Name']] || {};
    const modifiedCoverage = modifications.coverage !== undefined ? modifications.coverage : currentCoverage;
    const modifiedBuffer = modifications.buffer !== undefined ? modifications.buffer : currentBuffer;
    
    // Recalculer la quantité avec les modifications et les valeurs actuelles
    const stock = toFloat(r['Stock']) || 0;
    const dailySales = toFloat(r['Daily Sales']) || 0;
    const totalDays = modifiedCoverage + modifiedBuffer;
    const totalNeed = dailySales * totalDays;
    const qtyToOrder = totalNeed - stock;
    
    let quantity = 0;
    if (qtyToOrder > 0) {
      const rawQty = Math.ceil(qtyToOrder);
      const isKomacut = r['_komacut'];
      quantity = isKomacut ? roundToUpperMarker(rawQty) : rawQty;
    }
    
    rowData.push(`"${quantity}"`);
    csvContent += rowData.join(',') + '\n';
  });

  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
  element.setAttribute('download', `All_Selected_${new Date().toISOString().slice(0, 10)}.csv`);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

// Gérer l'upload d'un fichier CSV
let csvContent = null;
let currentData = null;

async function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    csvContent = e.target.result;
    document.getElementById('supplier-select').value = '';
    
    // Save CSV metadata to Firebase
    if (window.saveCSVMetadata) {
      try {
        const fileName = file.name;
        const timestamp = new Date();
        await window.saveCSVMetadata(fileName, timestamp, csvContent);
      } catch (error) {
        console.error('Error saving to Firebase:', error);
      }
    }
    
    await initializeFilter();
    await generateReport();
  };
  reader.readAsText(file);
}

// Charger le CSV (depuis file ou depuis le serveur)
async function loadCSVContent() {
  // IMPORTANT: Always sync with window.csvContent (used by Firebase for recent files)
  if (window.csvContent) {
    csvContent = window.csvContent;
    console.log('Loaded CSV from window.csvContent, length:', csvContent.length);
    return csvContent;
  }
  
  // Fallback: use local csvContent if available
  if (csvContent) {
    console.log('Using local csvContent, length:', csvContent.length);
    return csvContent;
  }
  
  // Fallback: try to load from server
  console.log('Loading CSV from server:', CSV_PATH);
  const response = await fetch(CSV_PATH);
  return await response.text();
}

// Charger et traiter les données CSV
async function loadAndProcessData(selectedSupplier = null, daysAfterDelivery = DAYS_TO_COVER) {
  try {
    const csvText = await loadCSVContent();
    const lines = csvText.split('\n');
    
    const headers = parseCSVLine(lines[0]);
    const supplierIdx = headers.indexOf('Supplier');
    const nameIdx = headers.indexOf('Name');
    const quantityIdx = headers.indexOf('Quantity');
    const dailySalesIdx = headers.indexOf('Daily Sales (60-day average)');
    const incomingInventoryIdx = headers.indexOf('Incoming Inventory');

    console.log('Indices:', { nameIdx, quantityIdx, supplierIdx, dailySalesIdx, incomingInventoryIdx });

    const negativeStock = [];
    const lowStock = [];
    const insufficient = [];
    const goodMaterials = [];
    const incomingStock = [];
    const addedParts = new Set();

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = parseCSVLine(lines[i]);
      const supplier = values[supplierIdx] || '';
      
      if (selectedSupplier && selectedSupplier !== '0' && supplier.toLowerCase() !== selectedSupplier.toLowerCase()) {
        continue;
      }

      const name = values[nameIdx] || '';
      const stock = toFloat(values[quantityIdx]);
      const dailySales = toFloat(values[dailySalesIdx]);
      const incomingInventory = toFloat(values[incomingInventoryIdx]);
      
      if (!name) continue;
      
      const uniqueKey = `${name}|${supplier}`;
      if (addedParts.has(uniqueKey)) continue;

      const daysInv = dailySales > 0 ? Math.round((stock / dailySales) * 10) / 10 : null;

      // ÉTAPE 1 : VÉRIFIER "INCOMING INVENTORY" EN PREMIER
      if (incomingInventory >= 1) {
        const entry = {
          'Part Name': name,
          'Stock': Math.round(stock * 100) / 100,
          'Daily Sales': Math.round(dailySales * 10000) / 10000,
          'Current Days': daysInv !== null ? daysInv : 'N/A',
          'Incoming Inventory': Math.round(incomingInventory * 100) / 100,
          'Supplier': supplier,
          '_komacut': supplier.toLowerCase().includes('komacut'),
        };
        incomingStock.push(entry);
        addedParts.add(uniqueKey);
        continue; // STOP ici, ne pas vérifier les autres catégories
      }

      // ÉTAPE 2 : SEULEMENT SI INCOMING INVENTORY < 1, CALCULER LES AUTRES CATÉGORIES
      const rowKomacut = supplier.toLowerCase().includes('komacut');
      const totalDays = daysAfterDelivery + LEAD_TIME;
      const totalNeed = dailySales * totalDays;
      const qtyToOrder = totalNeed - stock;

      const entry = {
        'Part Name': name,
        'Stock': Math.round(stock * 100) / 100,
        'Daily Sales': Math.round(dailySales * 10000) / 10000,
        'Current Days': daysInv !== null ? daysInv : 'N/A',
        'Incoming Inventory': Math.round(incomingInventory * 100) / 100,
        'Supplier': supplier,
        '_komacut': rowKomacut,
      };

      if (qtyToOrder > 0) {
        const rawQty = Math.ceil(qtyToOrder);
        let finalQty = null;
        if (rowKomacut) {
          finalQty = roundToUpperMarker(rawQty);
        }

        const qtyForDelivery = finalQty !== null ? finalQty : rawQty;
        const stockAfter = stock + qtyForDelivery - (dailySales * LEAD_TIME);
        const daysInvAfter = dailySales > 0 ? Math.round((stockAfter / dailySales) * 10) / 10 : null;

        entry['After Delivery'] = daysInvAfter !== null ? daysInvAfter : 'N/A';
        entry['Exact Order Quantity'] = rawQty;
        entry['Rounded Order Quantity'] = finalQty !== null ? finalQty : '-';

        if (stock <= 0) {
          negativeStock.push(entry);
        } else if (daysInv !== null && daysInv < daysAfterDelivery) {
          lowStock.push(entry);
        } else if (qtyToOrder > 0) {
          insufficient.push(entry);
        }
      } else {
        goodMaterials.push(entry);
      }
      
      addedParts.add(uniqueKey);
    }

    const sortByDays = (a, b) => {
      const aDays = typeof a['Current Days'] === 'number' ? a['Current Days'] : 0;
      const bDays = typeof b['Current Days'] === 'number' ? b['Current Days'] : 0;
      return aDays - bDays;
    };

    negativeStock.sort(sortByDays);
    lowStock.sort(sortByDays);
    insufficient.sort(sortByDays);
    goodMaterials.sort(sortByDays);
    incomingStock.sort(sortByDays);

    return {
      negativeStock,
      lowStock,
      insufficient,
      goodMaterials,
      incomingStock,
      showArrondi: [negativeStock, lowStock, insufficient]
        .flat()
        .some(r => r._komacut),
      hasProblems: negativeStock.length > 0 || lowStock.length > 0 || insufficient.length > 0,
    };
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
    return null;
  }
}

// Récupérer les fournisseurs disponibles
async function getSuppliers() {
  try {
    const csvText = await loadCSVContent();
    const lines = csvText.split('\n');
    const headers = parseCSVLine(lines[0]);
    const supplierIdx = headers.indexOf('Supplier');
    
    const suppliers = new Set();
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseCSVLine(lines[i]);
      const supplier = values[supplierIdx];
      if (supplier && supplier.length > 0 && !supplier.match(/^\d+$/)) {
        suppliers.add(supplier);
      }
    }
    return Array.from(suppliers).sort();
  } catch (error) {
    console.error('Erreur lors du chargement des fournisseurs:', error);
    return [];
  }
}

// Construire un tableau HTML
function buildTable(rows, showArrondi, isGoodMaterials = false, isIncomingStock = false, enableEdit = false, showSupplier = false) {
  if (rows.length === 0) {
    return '<p><em>Aucune pièce dans cette catégorie.</em></p>';
  }

  let headers, html;

  if (isIncomingStock) {
    headers = ['Part Name', 'Stock', 'Daily Sales', 'Current Days', 'Incoming Inventory', 'Lasting Days After Delivery'];
    if (showSupplier) {
      headers.push('Supplier');
    }
    
    html = '<table>\n<thead><tr>';
    headers.forEach(h => {
      html += `<th>${h}</th>`;
    });
    html += '</tr></thead>\n<tbody>\n';

    rows.forEach((r, index) => {
      // Calculer les jours de couverture après livraison
      const totalStock = r['Stock'] + r['Incoming Inventory'];
      const dailySales = r['Daily Sales'] || 0;
      const lastingDaysAfterDelivery = dailySales > 0 ? Math.round((totalStock / dailySales) * 10) / 10 : 'N/A';
      
      html += `<tr>`;
      html += `<td>${r['Part Name']}</td>`;
      html += `<td>${r['Stock']}</td>`;
      html += `<td>${r['Daily Sales']}</td>`;
      html += `<td>${r['Current Days']}</td>`;
      html += `<td>${r['Incoming Inventory']}</td>`;
      html += `<td>${lastingDaysAfterDelivery}</td>`;
      if (showSupplier) {
        html += `<td>${r['Supplier'] || 'N/A'}</td>`;
      }
      html += '</tr>\n';
    });
  } else if (isGoodMaterials) {
    headers = ['Part Name', 'Stock', 'Daily Sales', 'Current Days', 'Incoming Inventory'];
    if (showSupplier) {
      headers.push('Supplier');
    }
    
    html = '<table>\n<thead><tr>';
    headers.forEach(h => {
      html += `<th>${h}</th>`;
    });
    html += '</tr></thead>\n<tbody>\n';

    rows.forEach(r => {
      html += '<tr>';
      html += `<td>${r['Part Name']}</td>`;
      html += `<td>${r['Stock']}</td>`;
      html += `<td>${r['Daily Sales']}</td>`;
      html += `<td>${r['Current Days']}</td>`;
      html += `<td>${r['Incoming Inventory']}</td>`;
      if (showSupplier) {
        html += `<td>${r['Supplier'] || 'N/A'}</td>`;
      }
      html += '</tr>\n';
    });
  } else {
    headers = ['Part Name', 'Stock', 'Daily Sales', 'Current Days', 'After Delivery', 'Exact Order Quantity'];
    if (showArrondi) {
      headers.push('Rounded Order Quantity');
    }
    if (showSupplier) {
      headers.push('Supplier');
    }

    html = '<table>\n<thead><tr>';
    headers.forEach(h => {
      html += `<th>${h}</th>`;
    });
    html += '</tr></thead>\n<tbody>\n';

    rows.forEach(r => {
      const rowId = `row_${Math.random().toString(36).substr(2, 9)}`;
      
      html += `<tr ${enableEdit ? `id="${rowId}" class="editable-row"` : ''}>`;
      if (enableEdit) {
        html += `<td class="part-name-cell">
          <button class="select-btn" data-row-id="${rowId}" data-part-name="${r['Part Name']}">☐</button>
          <span>${r['Part Name']}</span> 
          <button class="edit-btn" data-row-id="${rowId}" data-part-name="${r['Part Name']}">Edit</button>
        </td>`;
      } else {
        html += `<td>${r['Part Name']}</td>`;
      }
      html += `<td>${r['Stock']}</td>`;
      html += `<td>${r['Daily Sales']}</td>`;
      html += `<td>${r['Current Days']}</td>`;
      html += `<td>${r['After Delivery']}</td>`;
      html += `<td><strong>${r['Exact Order Quantity']}</strong></td>`;
      if (showArrondi) {
        const arrondi = r['Rounded Order Quantity'] !== null && r['Rounded Order Quantity'] !== '-' ? r['Rounded Order Quantity'] : '-';
        html += `<td><strong>${arrondi}</strong></td>`;
      }
      if (showSupplier) {
        html += `<td>${r['Supplier'] || 'N/A'}</td>`;
      }
      html += '</tr>\n';
      
      // Rangée d'édition cachée (seulement si enableEdit est true)
      if (enableEdit) {
        const storedModifications = itemModifications[r['Part Name']] || {};
        html += `<tr class="edit-row" id="edit_${rowId}" style="display: none;">`;
        html += `<td colspan="${showArrondi ? 7 : 6}" style="padding: 1rem; background: #3a3a3a; border-radius: 6px;">`;
        html += `<div style="display: flex; gap: 2rem;">`;
        html += `<div><label style="color: #ddd;">Coverage:</label><br><select class="coverage-input" style="width: 120px; padding: 5px; background: #2d2d2d; color: #ddd; border: 1px solid #666; border-radius: 3px; cursor: pointer;">
          <option value="14" ${(storedModifications.coverage || DAYS_TO_COVER) == 14 ? 'selected' : ''}>2 weeks</option>
          <option value="28" ${(storedModifications.coverage || DAYS_TO_COVER) == 28 ? 'selected' : ''}>4 weeks</option>
          <option value="42" ${(storedModifications.coverage || DAYS_TO_COVER) == 42 ? 'selected' : ''}>6 weeks</option>
          <option value="56" ${(storedModifications.coverage || DAYS_TO_COVER) == 56 ? 'selected' : ''}>8 weeks</option>
          <option value="90" ${(storedModifications.coverage || DAYS_TO_COVER) == 90 ? 'selected' : ''}>3 months</option>
          <option value="120" ${(storedModifications.coverage || DAYS_TO_COVER) == 120 ? 'selected' : ''}>4 months</option>
        </select></div>`;
        html += `<div><label style="color: #ddd;">Buffer Time:</label><br><select class="buffer-input" style="width: 120px; padding: 5px; background: #2d2d2d; color: #ddd; border: 1px solid #666; border-radius: 3px; cursor: pointer;">
          <option value="7" ${(storedModifications.buffer || LEAD_TIME) == 7 ? 'selected' : ''}>1 week</option>
          <option value="14" ${(storedModifications.buffer || LEAD_TIME) == 14 ? 'selected' : ''}>2 weeks</option>
          <option value="21" ${(storedModifications.buffer || LEAD_TIME) == 21 ? 'selected' : ''}>3 weeks</option>
          <option value="28" ${(storedModifications.buffer || LEAD_TIME) == 28 ? 'selected' : ''}>4 weeks</option>
          <option value="35" ${(storedModifications.buffer || LEAD_TIME) == 35 ? 'selected' : ''}>5 weeks</option>
          <option value="42" ${(storedModifications.buffer || LEAD_TIME) == 42 ? 'selected' : ''}>6 weeks</option>
        </select></div>`;
        html += `<div style="display: flex; align-items: flex-end; gap: 1rem;">`;
        html += `<button class="save-btn" data-row-id="${rowId}" data-part-name="${r['Part Name']}" style="padding: 5px 15px; background: #27ae60; color: white; border: none; border-radius: 3px; cursor: pointer;">Save</button>`;
        html += `<button class="cancel-btn" data-row-id="${rowId}" style="padding: 5px 15px; background: #c0392b; color: white; border: none; border-radius: 3px; cursor: pointer;">Cancel</button>`;
        html += `</div></div></td>`;
        html += `</tr>\n`;
      }
    });
  }

  html += '</tbody>\n</table>';
  return html;
}

// Générer et afficher le rapport
async function generateReport(selectedSupplier = null, daysAfterDelivery = DAYS_TO_COVER, leadTime = LEAD_TIME) {
  LEAD_TIME = leadTime;
  
  const data = await loadAndProcessData(selectedSupplier, daysAfterDelivery);

  if (!data) {
    document.getElementById('content').innerHTML = '<p>Erreur lors du chargement des données.</p>';
    return;
  }

  currentData = data;

  // Déterminer si on affiche tous les suppliers
  const showSupplier = !selectedSupplier || selectedSupplier === '0';

  const reportHtml = `
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
    <div>
      <h1>Order Report — ${selectedSupplier || 'All Suppliers'}</h1>
      <div class="meta">
        Coverage Period: <strong>${daysAfterDelivery} days</strong> &nbsp;|&nbsp;
        Lead Time: <strong>${LEAD_TIME} days</strong> &nbsp;|&nbsp;
        Total Parts to Order: <strong>${data.negativeStock.length + data.lowStock.length + data.insufficient.length}</strong>
        ${data.showArrondi ? `&nbsp;|&nbsp; Markers: <strong>${MARKERS.join(', ')}, then ×50</strong>` : ''}
      </div>
    </div>
    <button id="export-all-selected-btn" style="display: none; padding: 0.75rem 1.5rem; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.95rem; font-weight: 600; white-space: nowrap; margin-left: 1rem;">⬇️ Export All Selected</button>
  </div>

  ${data.negativeStock.length > 0 ? `
    <details open>
      <summary><h2><span class="red">🔴 Critical Stock</span> <button class="export-btn" data-category="negativeStock" data-filter="all" style="margin-left: 1rem; padding: 0.5rem 1rem; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export</button><button class="export-unselected-btn" data-category="negativeStock" style="display: none; margin-left: 0.5rem; padding: 0.5rem 1rem; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export Unselected</button><button class="export-selected-btn" data-category="negativeStock" style="display: none; margin-left: 0.5rem; padding: 0.5rem 1rem; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export Selected</button></h2></summary>
      ${buildTable(data.negativeStock, data.showArrondi, false, false, true, showSupplier)}
    </details>
  ` : ''}

  ${data.lowStock.length > 0 ? `
    <details open>
      <summary><h2><span class="orange">🟠 Low Stock</span> <button class="export-btn" data-category="lowStock" data-filter="all" style="margin-left: 1rem; padding: 0.5rem 1rem; background: #e67e22; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export</button><button class="export-unselected-btn" data-category="lowStock" style="display: none; margin-left: 0.5rem; padding: 0.5rem 1rem; background: #e67e22; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export Unselected</button><button class="export-selected-btn" data-category="lowStock" style="display: none; margin-left: 0.5rem; padding: 0.5rem 1rem; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export Selected</button></h2></summary>
      ${buildTable(data.lowStock, data.showArrondi, false, false, true, showSupplier)}
    </details>
  ` : ''}

  ${data.insufficient.length > 0 ? `
    <details open>
      <summary><h2><span class="yellow">🟡 Ok Stock</span> <button class="export-btn" data-category="insufficient" data-filter="all" style="margin-left: 1rem; padding: 0.5rem 1rem; background: #b8860b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export</button><button class="export-unselected-btn" data-category="insufficient" style="display: none; margin-left: 0.5rem; padding: 0.5rem 1rem; background: #b8860b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export Unselected</button><button class="export-selected-btn" data-category="insufficient" style="display: none; margin-left: 0.5rem; padding: 0.5rem 1rem; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export Selected</button></h2></summary>
      ${buildTable(data.insufficient, data.showArrondi, false, false, true, showSupplier)}
    </details>
  ` : ''}

  ${data.goodMaterials.length > 0 ? `
    <details ${data.hasProblems ? '' : 'open'}>
      <summary><h2><span class="green">✅ Good stock</span> <button class="export-btn" data-category="goodMaterials" data-filter="all" style="margin-left: 1rem; padding: 0.5rem 1rem; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export</button><button class="export-unselected-btn" data-category="goodMaterials" style="display: none; margin-left: 0.5rem; padding: 0.5rem 1rem; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export Unselected</button><button class="export-selected-btn" data-category="goodMaterials" style="display: none; margin-left: 0.5rem; padding: 0.5rem 1rem; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export Selected</button></h2></summary>
      ${buildTable(data.goodMaterials, data.showArrondi, true, false, false, showSupplier)}
    </details>
  ` : ''}

  ${data.incomingStock.length > 0 ? `
    <details>
      <summary><h2><span class="blue">📦 Incoming Stock</span> <button class="export-btn" data-category="incomingStock" data-filter="all" style="margin-left: 1rem; padding: 0.5rem 1rem; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export</button><button class="export-unselected-btn" data-category="incomingStock" style="display: none; margin-left: 0.5rem; padding: 0.5rem 1rem; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export Unselected</button><button class="export-selected-btn" data-category="incomingStock" style="display: none; margin-left: 0.5rem; padding: 0.5rem 1rem; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export Selected</button></h2></summary>
      ${buildTable(data.incomingStock, data.showArrondi, false, true, false, showSupplier)}
    </details>
  ` : ''}
  `;

  document.getElementById('content').innerHTML = reportHtml;
  
  // Event listener pour le bouton "Export All Selected"
  const exportAllBtn = document.getElementById('export-all-selected-btn');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', function() {
      exportAllSelected(selectedSupplier);
    });
  }
  
  // Event listeners pour les boutons Select
  document.querySelectorAll('.select-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const partName = this.getAttribute('data-part-name');
      const rowId = this.getAttribute('data-row-id');
      const dataRow = document.getElementById(rowId);
      
      // Basculer l'état de sélection
      if (selectedItems[partName]) {
        delete selectedItems[partName];
        this.textContent = '☐'; // Décoché
        this.style.background = '#f39c12';
        dataRow.classList.remove('selected');
      } else {
        selectedItems[partName] = true;
        this.textContent = '☑'; // Coché
        this.style.background = '#27ae60';
        dataRow.classList.add('selected');
      }
      
      // Mettre à jour la visibilité des boutons export
      updateExportButtonsVisibility();
    });
  });
  
  // Event listeners pour les boutons Edit
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const rowId = this.getAttribute('data-row-id');
      const editRow = document.getElementById(`edit_${rowId}`);
      if (editRow.style.display === 'none') {
        editRow.style.display = 'table-row';
      } else {
        editRow.style.display = 'none';
      }
    });
  });

  // Event listeners pour les boutons Save
  document.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const rowId = this.getAttribute('data-row-id');
      const partName = this.getAttribute('data-part-name');
      const coverageInput = document.querySelector(`#edit_${rowId} .coverage-input`);
      const bufferInput = document.querySelector(`#edit_${rowId} .buffer-input`);
      
      const newCoverage = parseInt(coverageInput.value);
      const newBuffer = parseInt(bufferInput.value);
      
      // Stocker les modifications pour cette pièce spécifique
      itemModifications[partName] = {
        coverage: newCoverage,
        buffer: newBuffer
      };
      
      // Fermer la rangée d'édition
      document.getElementById(`edit_${rowId}`).style.display = 'none';
      
      // Recalculer seulement cette ligne avec les nouvelles valeurs
      const dataRow = document.getElementById(rowId);
      if (dataRow) {
        // Obtenir la ligne de données correspondante depuis currentData
        let targetRow = null;
        const allRows = [
          ...currentData.negativeStock,
          ...currentData.lowStock,
          ...currentData.insufficient,
          ...currentData.goodMaterials,
          ...currentData.incomingStock
        ];
        
        targetRow = allRows.find(r => r['Part Name'] === partName);
        
        if (targetRow) {
          // Recalculer avec les valeurs modifiées
          const stock = targetRow['Stock'];
          const dailySales = targetRow['Daily Sales'];
          const isKomacut = targetRow._komacut;
          
          // Recalculer Current Days (affichage seulement, ne change pas vraiment)
          const currentDays = dailySales > 0 ? Math.round((stock / dailySales) * 10) / 10 : 'N/A';
          
          // Recalculer les quantités avec les nouvelles valeurs
          const totalDays = newCoverage + newBuffer;
          const totalNeed = dailySales * totalDays;
          const qtyToOrder = totalNeed - stock;
          
          let afterDelivery = 'N/A';
          let exactOrderQty = 0;
          let roundedOrderQty = '-';
          
          if (qtyToOrder > 0) {
            // Exact Order Quantity
            const rawQty = Math.ceil(qtyToOrder);
            exactOrderQty = rawQty;
            
            // Déterminer la quantité pour la livraison
            let qtyForDelivery = rawQty;
            if (isKomacut) {
              qtyForDelivery = roundToUpperMarker(rawQty);
              roundedOrderQty = qtyForDelivery;
            } else {
              roundedOrderQty = '-';
            }
            
            // Calculer After Delivery
            const stockAfter = stock + qtyForDelivery - (dailySales * newBuffer);
            afterDelivery = dailySales > 0 ? Math.round((stockAfter / dailySales) * 10) / 10 : 'N/A';
          } else {
            // qtyToOrder <= 0, donc pas de commande
            afterDelivery = 'N/A';
            exactOrderQty = 0;
            roundedOrderQty = '-';
          }
          
          // Mettre à jour les cellules de la ligne
          const cells = dataRow.querySelectorAll('td');
          if (cells.length >= 6) {
            // cells[0] = Part Name (ne pas modifier)
            // cells[1] = Stock (ne pas modifier)
            // cells[2] = Daily Sales (ne pas modifier)
            cells[3].textContent = currentDays;  // Current Days
            cells[4].textContent = afterDelivery; // After Delivery
            cells[5].innerHTML = `<strong>${exactOrderQty}</strong>`; // Exact Order Quantity
            
            // Rounded Order Quantity (si present)
            if (cells.length >= 7) {
              cells[6].innerHTML = `<strong>${roundedOrderQty}</strong>`; // Rounded Order Quantity
            }
          }
        }
      }
    });
  });

  // Event listeners pour les boutons Cancel
  document.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const rowId = this.getAttribute('data-row-id');
      document.getElementById(`edit_${rowId}`).style.display = 'none';
    });
  });
  
  // Fonction pour mettre à jour la visibilité des boutons export
  function updateExportButtonsVisibility() {
    document.querySelectorAll('.export-btn').forEach(btn => {
      const category = btn.getAttribute('data-category');
      const exportUnselectedBtn = btn.parentElement.querySelector(`.export-unselected-btn[data-category="${category}"]`);
      const exportSelectedBtn = btn.parentElement.querySelector(`.export-selected-btn[data-category="${category}"]`);
      
      let hasSelectedItems = false;
      if (category === 'negativeStock') {
        hasSelectedItems = currentData.negativeStock.some(r => selectedItems[r['Part Name']]);
      } else if (category === 'lowStock') {
        hasSelectedItems = currentData.lowStock.some(r => selectedItems[r['Part Name']]);
      } else if (category === 'insufficient') {
        hasSelectedItems = currentData.insufficient.some(r => selectedItems[r['Part Name']]);
      } else if (category === 'goodMaterials') {
        hasSelectedItems = currentData.goodMaterials.some(r => selectedItems[r['Part Name']]);
      } else if (category === 'incomingStock') {
        hasSelectedItems = currentData.incomingStock.some(r => selectedItems[r['Part Name']]);
      }
      
      if (hasSelectedItems) {
        // Quand il y a des sélections
        btn.style.display = 'none';  // Masquer "Export"
        exportUnselectedBtn.style.display = 'inline-block';  // Afficher "Export Unselected"
        exportSelectedBtn.style.display = 'inline-block';  // Afficher "Export Selected"
      } else {
        // Quand il n'y a pas de sélections
        btn.style.display = 'inline-block';  // Afficher "Export"
        exportUnselectedBtn.style.display = 'none';  // Masquer "Export Unselected"
        exportSelectedBtn.style.display = 'none';  // Masquer "Export Selected"
      }
    });
    
    // Montrer/masquer le bouton "Export All Selected"
    const exportAllBtn = document.getElementById('export-all-selected-btn');
    if (exportAllBtn) {
      const hasAnySelected = Object.keys(selectedItems).length > 0;
      exportAllBtn.style.display = hasAnySelected ? 'inline-block' : 'none';
    }
  }
  
  // Event listeners pour les boutons Export (tout)
  document.querySelectorAll('.export-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const category = this.getAttribute('data-category');
      let rows, categoryName, isGoodMaterials = false, isIncomingStock = false;
      
      if (category === 'negativeStock') {
        rows = currentData.negativeStock;
        categoryName = 'Critical_Stock';
      } else if (category === 'lowStock') {
        rows = currentData.lowStock;
        categoryName = 'Low_Stock';
      } else if (category === 'insufficient') {
        rows = currentData.insufficient;
        categoryName = 'Ok_Stock';
      } else if (category === 'goodMaterials') {
        rows = currentData.goodMaterials;
        categoryName = 'Good_Materials';
        isGoodMaterials = true;
      } else if (category === 'incomingStock') {
        rows = currentData.incomingStock;
        categoryName = 'Incoming_Stock';
        isIncomingStock = true;
      }
      
      if (rows) {
        const selectedSupplier = document.getElementById('supplier-select').value;
        exportToCSV(rows, categoryName, isGoodMaterials, selectedSupplier, isIncomingStock, 'all');
      }
    });
  });
  
  // Event listeners pour les boutons Export Unselected
  document.querySelectorAll('.export-unselected-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const category = this.getAttribute('data-category');
      let rows, categoryName, isGoodMaterials = false, isIncomingStock = false;
      
      if (category === 'negativeStock') {
        rows = currentData.negativeStock;
        categoryName = 'Critical_Stock';
      } else if (category === 'lowStock') {
        rows = currentData.lowStock;
        categoryName = 'Low_Stock';
      } else if (category === 'insufficient') {
        rows = currentData.insufficient;
        categoryName = 'Ok_Stock';
      } else if (category === 'goodMaterials') {
        rows = currentData.goodMaterials;
        categoryName = 'Good_Materials';
        isGoodMaterials = true;
      } else if (category === 'incomingStock') {
        rows = currentData.incomingStock;
        categoryName = 'Incoming_Stock';
        isIncomingStock = true;
      }
      
      if (rows) {
        const selectedSupplier = document.getElementById('supplier-select').value;
        exportToCSV(rows, categoryName, isGoodMaterials, selectedSupplier, isIncomingStock, 'unselected');
      }
    });
  });
  
  // Event listeners pour les boutons Export Selected
  document.querySelectorAll('.export-selected-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const category = this.getAttribute('data-category');
      let rows, categoryName, isGoodMaterials = false, isIncomingStock = false;
      
      if (category === 'negativeStock') {
        rows = currentData.negativeStock;
        categoryName = 'Critical_Stock';
      } else if (category === 'lowStock') {
        rows = currentData.lowStock;
        categoryName = 'Low_Stock';
      } else if (category === 'insufficient') {
        rows = currentData.insufficient;
        categoryName = 'Ok_Stock';
      } else if (category === 'goodMaterials') {
        rows = currentData.goodMaterials;
        categoryName = 'Good_Materials';
        isGoodMaterials = true;
      } else if (category === 'incomingStock') {
        rows = currentData.incomingStock;
        categoryName = 'Incoming_Stock';
        isIncomingStock = true;
      }
      
      if (rows) {
        const selectedSupplier = document.getElementById('supplier-select').value;
        exportToCSV(rows, categoryName, isGoodMaterials, selectedSupplier, isIncomingStock, 'selected');
      }
    });
  });
  
  // Appel initial pour mettre à jour les boutons
  updateExportButtonsVisibility();
}

// Initialiser le filtrage par supplier
async function initializeFilter() {
  // Si aucun CSV n'a été uploadé, ne rien faire
  if (!csvContent) {
    return;
  }
  
  const suppliers = await getSuppliers();
  let supplierOptions = '<option value="">All Suppliers</option>\n';
  suppliers.forEach(supplier => {
    supplierOptions += `<option value="${supplier}">${supplier}</option>\n`;
  });
  document.getElementById('supplier-select').innerHTML = supplierOptions;
}

// Appliquer le filtre
function applyFilter() {
  const supplier = document.getElementById('supplier-select').value;
  const daysAfterDelivery = parseInt(document.getElementById('days-after-delivery').value) || DAYS_TO_COVER;
  const leadTime = parseInt(document.getElementById('lead-time').value) || LEAD_TIME;
  generateReport(supplier || null, daysAfterDelivery, leadTime);
}

// Make functions available to window for Firebase loading
window.initializeFilter = initializeFilter;
window.generateReport = generateReport;

// Initialisation
window.addEventListener('DOMContentLoaded', async () => {
  // Afficher un message par défaut au lieu de charger les données
  document.getElementById('content').innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">📁 Veuillez uploader un fichier CSV pour commencer</p>';
});
