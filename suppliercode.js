// ── Paramètres ────────────────────────────────────────────────
let CSV_PATH = "raw_materials with PO.csv";
let DAYS_TO_COVER = 90;
let LEAD_TIME = 42;
const MARKERS = [15, 25, 50, 100, 175, 250];
const SUSPICIOUS_SALES_THRESHOLD = 0.1;
const SUSPICIOUS_STOCK_THRESHOLD = 10;
const COVERAGE_OPTIONS = [15, 30, 45, 60];

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

// ── Exporter un tableau en CSV ───────────────────────────────────
function exportToCSV(rows, categoryName, isGoodMaterials = false, selectedSupplier = '') {
  if (rows.length === 0) {
    alert('Aucune donnée à exporter pour cette catégorie.');
    return;
  }

  let headers, csvContent;

  if (isGoodMaterials) {
    // Pour Good Materials et Incoming Stock, exporter seulement Part Name
    headers = ['Part Name'];
  } else {
    // Pour les autres catégories
    const isKomacut = selectedSupplier && selectedSupplier.toLowerCase() === 'komacut';
    const isAllSuppliers = !selectedSupplier || selectedSupplier === '';
    
    // Si supplier est "komacut", utiliser "Rounded Order Quantity" à la place de "Exact Order Quantity"
    if (isKomacut) {
      headers = ['Part Name', 'Rounded Order Quantity'];
    } else {
      headers = ['Part Name', 'Exact Order Quantity'];
      
      // Si supplier est "All Suppliers", ajouter aussi "Rounded Order Quantity"
      if (isAllSuppliers) {
        if (rows.some(r => r['Rounded Order Quantity'] && r['Rounded Order Quantity'] !== '-')) {
          headers.push('Rounded Order Quantity');
        }
      }
    }
  }

  csvContent = headers.map(h => `"${h}"`).join(',') + '\n';

  rows.forEach(r => {
    const rowData = [];
    if (isGoodMaterials) {
      rowData.push(`"${r['Part Name']}"`);
    } else {
      rowData.push(`"${r['Part Name']}"`);
      
      const isKomacut = selectedSupplier && selectedSupplier.toLowerCase() === 'komacut';
      const isAllSuppliers = !selectedSupplier || selectedSupplier === '';
      
      // Si supplier est "komacut", exporter Rounded Order Quantity
      if (isKomacut) {
        const arrondi = r['Rounded Order Quantity'] !== null && r['Rounded Order Quantity'] !== '-' ? r['Rounded Order Quantity'] : '';
        rowData.push(`"${arrondi}"`);
      } else {
        // Sinon exporter Exact Order Quantity
        rowData.push(`"${r['Exact Order Quantity']}"`);
        
        // Si supplier est "All Suppliers", ajouter aussi "Rounded Order Quantity"
        if (isAllSuppliers) {
          if (headers.includes('Rounded Order Quantity')) {
            const arrondi = r['Rounded Order Quantity'] !== null && r['Rounded Order Quantity'] !== '-' ? r['Rounded Order Quantity'] : '';
            rowData.push(`"${arrondi}"`);
          }
        }
      }
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
    await initializeFilter();
    await generateReport();
  };
  reader.readAsText(file);
}

// Charger le CSV (depuis file ou depuis le serveur)
async function loadCSVContent() {
  if (csvContent) {
    return csvContent;
  }
  const response = await fetch(CSV_PATH);
  return await response.text();
}

function roundToUpperMarker(qty) {
  if (qty > 50 && qty <= 100) {
    return Math.ceil(qty / 10) * 10;
  }
  else if (qty > 100) {
    return Math.ceil(qty / 50) * 50;
  }
  else {
    for (let m of MARKERS) {
      if (m >= qty) {
        return m;
      }
    }
    return Math.ceil(qty / 50) * 50;
  }
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
function buildTable(rows, showArrondi, isGoodMaterials = false, isIncomingStock = false) {
  if (rows.length === 0) {
    return '<p><em>Aucune pièce dans cette catégorie.</em></p>';
  }

  let headers, html;

  if (isIncomingStock) {
    headers = ['Part Name', 'Stock', 'Daily Sales', 'Current Days', 'Incoming Inventory'];
    
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
      html += '</tr>\n';
    });
  } else if (isGoodMaterials) {
    headers = ['Part Name', 'Stock', 'Daily Sales', 'Current Days', 'Incoming Inventory'];
    
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
      html += '</tr>\n';
    });
  } else {
    headers = ['Part Name', 'Stock', 'Daily Sales', 'Current Days', 'After Delivery', 'Exact Order Quantity'];
    if (showArrondi) {
      headers.push('Rounded Order Quantity');
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
      html += `<td>${r['After Delivery']}</td>`;
      html += `<td><strong>${r['Exact Order Quantity']}</strong></td>`;
      if (showArrondi) {
        const arrondi = r['Rounded Order Quantity'] !== null && r['Rounded Order Quantity'] !== '-' ? r['Rounded Order Quantity'] : '-';
        html += `<td><strong>${arrondi}</strong></td>`;
      }
      html += '</tr>\n';
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

  const reportHtml = `
  <h1>Order Report — ${selectedSupplier || 'All Suppliers'}</h1>
  <div class="meta">
    Coverage Period: <strong>${daysAfterDelivery} days</strong> &nbsp;|&nbsp;
    Lead Time: <strong>${LEAD_TIME} days</strong> &nbsp;|&nbsp;
    Total Parts to Order: <strong>${data.negativeStock.length + data.lowStock.length + data.insufficient.length}</strong>
    ${data.showArrondi ? `&nbsp;|&nbsp; Markers: <strong>${MARKERS.join(', ')}, then ×50</strong>` : ''}
  </div>

  ${data.negativeStock.length > 0 ? `
    <details open>
      <summary><h2><span class="red">🔴 Critical Stock</span> <button class="export-btn" data-category="negativeStock" style="margin-left: 1rem; padding: 0.5rem 1rem; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export</button></h2></summary>
      ${buildTable(data.negativeStock, data.showArrondi)}
    </details>
  ` : ''}

  ${data.lowStock.length > 0 ? `
    <details open>
      <summary><h2><span class="orange">🟠 Low Stock</span> <button class="export-btn" data-category="lowStock" style="margin-left: 1rem; padding: 0.5rem 1rem; background: #e67e22; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export</button></h2></summary>
      ${buildTable(data.lowStock, data.showArrondi)}
    </details>
  ` : ''}

  ${data.insufficient.length > 0 ? `
    <details open>
      <summary><h2><span class="yellow">🟡 Ok Stock</span> <button class="export-btn" data-category="insufficient" style="margin-left: 1rem; padding: 0.5rem 1rem; background: #b8860b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export</button></h2></summary>
      ${buildTable(data.insufficient, data.showArrondi)}
    </details>
  ` : ''}

  ${data.goodMaterials.length > 0 ? `
    <details ${data.hasProblems ? '' : 'open'}>
      <summary><h2><span class="green">✅ Good stock</span> <button class="export-btn" data-category="goodMaterials" style="margin-left: 1rem; padding: 0.5rem 1rem; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export</button></h2></summary>
      ${buildTable(data.goodMaterials, data.showArrondi, true)}
    </details>
  ` : ''}

  ${data.incomingStock.length > 0 ? `
    <details>
      <summary><h2><span class="blue">📦 Incoming Stock</span> <button class="export-btn" data-category="incomingStock" style="margin-left: 1rem; padding: 0.5rem 1rem; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">⬇️ Export</button></h2></summary>
      ${buildTable(data.incomingStock, data.showArrondi, false, true)}
    </details>
  ` : ''}
  `;

  document.getElementById('content').innerHTML = reportHtml;
  
  document.querySelectorAll('.export-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const category = this.getAttribute('data-category');
      let rows, categoryName, isGoodMaterials = false;
      
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
        isGoodMaterials = true;
      }
      
      if (rows) {
        const selectedSupplier = document.getElementById('supplier-select').value;
        exportToCSV(rows, categoryName, isGoodMaterials, selectedSupplier);
      }
    });
  });
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

// Initialisation
window.addEventListener('DOMContentLoaded', async () => {
  // Afficher un message par défaut au lieu de charger les données
  document.getElementById('content').innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">📁 Veuillez uploader un fichier CSV pour commencer</p>';
});
