# 📊 Flip n Dip Order Report Generator

A web-based inventory management tool for analyzing stock levels, identifying low-stock items, and generating comprehensive order reports.

## Features

- **CSV Upload**: Upload your raw materials inventory data
- **Smart Categorization**: Automatically categorizes items into:
  - 🔴 Negative Stock (critical shortages)
  - 🟠 Low Stock (below minimum thresholds)
  - 🟡 Insufficient Stock (coverage period issues)
  - 🟢 Good Materials (healthy stock levels)
  - 🔵 Incoming Stock (items on order with inventory >= 1)

- **Customizable Filters**:
  - Supplier selection
  - Coverage periods (2 weeks to 4 months)
  - Buffer time (lead time for new orders)

- **Detailed Reports**:
  - Collapsible category sections
  - Comprehensive data tables with key metrics
  - Export functionality (CSV download)
  - Daily sales analysis (60-day average)

- **Dark Theme**: Modern dark UI with responsive design

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- CSV file with inventory data in the format of `raw_materials with PO.csv`
- **Important**: Must use a local web server (cannot use `file://` protocol due to CORS and ES6 module restrictions)

### Installation & Running

1. Clone the repository:
```bash
git clone https://github.com/yourusername/flipndip-order-report.git
cd flipndip-order-report
```

2. **Start a local web server** (choose one):

   **Option A: Python 3 (macOS/Linux)**
   ```bash
   python3 -m http.server 8000
   ```
   Then open: `http://localhost:8000`

   **Option B: Node.js with http-server**
   ```bash
   npm install -g http-server
   http-server
   ```
   Then open: `http://localhost:8080`

   **Option C: VS Code Live Server Extension**
   - Install the "Live Server" extension in VS Code
   - Right-click `index.html` → "Open with Live Server"

3. Open your browser and navigate to the local server URL

### Usage

1. **Upload CSV**: Click the upload section and select your CSV file
2. **Apply Filters**:
   - Select a supplier from the dropdown
   - Choose coverage period (days to cover in stock)
   - Set buffer time (lead time for incoming orders)
3. **View Report**: Browse categorized items in collapsible sections
4. **Export Data**: Use export buttons to download category data as CSV

## CSV Format Requirements

Your CSV file should contain the following columns:
- **Part Name** (Column 0): Name of the part/material
- **Quantity** (Column 1): Current stock quantity
- **Supplier** (Column 12): Supplier name
- **Daily Sales (60-day)** (Column 24): Average daily sales
- **Incoming Inventory** (Column 30): Quantity on order

Example structure:
```
Part Name,Quantity,Other columns...,Supplier,...,Daily Sales (60-day),...,Incoming Inventory
DUCATI PANIGALE COVER,100,...,ACME Corp,...,2.5,...,30
```

## File Structure

```
flipndip-order-report/
├── index.html              # Main HTML file with styles
├── suppliercode.js         # Core logic and data processing
├── README.md               # This file
├── .gitignore              # Git ignore file
├── raw_materials with PO.csv  # Sample data file
└── TRUST-PATTERN-NEW-LARGE.png  # Background pattern image
```

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Fonts**: Google Fonts (Montserrat)
- **Data Processing**: Client-side CSV parsing and analysis
- **Design**: Responsive dark theme with flexbox layout

## Color Scheme

- 🔴 **Red** (#c0392b): Negative stock (critical)
- 🟠 **Orange** (#e67e22): Low stock (warning)
- 🟡 **Yellow** (#b8860b): Insufficient stock (caution)
- 🟢 **Green** (#27ae60): Good materials (healthy)
- 🔵 **Blue** (#3498db): Incoming stock (ordered)

## Default Settings

- **Coverage Period**: 3 months (90 days)
- **Buffer Time**: 6 weeks (42 days)
- **Database**: `raw_materials with PO.csv`

## Features in Detail

### Categorization Logic

Items are categorized based on:

1. **Incoming Stock**: Items with Incoming Inventory >= 1 (on order)
2. **Negative Stock**: Current quantity < 0
3. **Low Stock**: Current quantity <= 2 times daily sales
4. **Insufficient Stock**: Days of coverage < coverage period setting
5. **Good Materials**: All other healthy stock items

### Daily Sales Calculation

Days of coverage = Current Quantity / Daily Sales (60-day average)

Used to determine if stock levels are sufficient for the selected coverage period.

## Known Limitations

- CSV parsing assumes standard CSV format with proper quoting
- Client-side processing means large files (>10MB) may impact performance
- No data persistence between sessions (processed data not stored)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Future Enhancements

- [ ] Database integration for data persistence
- [ ] User authentication and multi-user support
- [ ] Date-based historical analysis
- [ ] Automated email notifications for low stock
- [ ] Advanced filtering and search
- [ ] Custom report generation

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Support

For issues or feature requests, please create an issue on GitHub.

## Author

Created for Flip n Dip inventory management system.

---

**Last Updated**: April 13, 2026
**Version**: 1.0.0
