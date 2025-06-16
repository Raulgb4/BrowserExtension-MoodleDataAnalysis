# 📌 Moodle Data Analyzer

🚀 **Google Chrome Extension for Extracting, Processing, and Visualizing Moodle Course Data**  
This project consists of a browser extension designed to help educators analyze student activity and engagement in **Moodle**, by extracting data directly from the **pages of the Moodle platform** using scraping techniques.

---

## 📖 Project Overview

The extension provides an intuitive interface that, once activated from the browser, interacts with the Moodle platform loaded in the current tab. It collects relevant data such as user activity, resource access, and submissions by analyzing the HTML structure of the course pages in real time (DOM). This allows educators to visualize key metrics without the need to export or upload any files.

---

### 🔍 Key Features

- **Automatic Data Extraction from Moodle Pages**  
  Retrieves information directly from the DOM of the Moodle site while the user navigates through it.

- **Structured Data Processing**  
  Organizes and formats extracted data such as activities, users, grades, and participation into structured statistics.

- **Dynamic Visualizations**  
  Displays charts and graphs built with **Chart.js** or **D3.js** to analyze engagement and performance.

- **Filtering and Customization**  
  Allows users to apply filters by activity, participant, or time range to explore data in more detail.

- **Data Export**  
  Supports exporting processed data in formats such as `.CSV`, `.XLSX`, or `.JSON` for offline use or reports.

- **Privacy-Friendly**  
  All operations are performed **locally in the browser** — no data is sent externally or stored in the cloud.

---


## 🛠️ Technologies Used

- **JavaScript** – Core language for extension logic and control.
- **HTML & CSS** – Interface layout and styling (popup interface).
- **Chart.js / D3.js** – For generating graphs and interactive visualizations.
- **JSZip** – Reading and decompressing `.mbz` files inside the browser.
- **Sheet.js (xlsx)** – Exporting data to Excel-compatible formats.
- **Web Extensions API** – Integrating the tool into the Chrome browser.
- **Agile Methodology** – Developed using an iterative and modular approach.

---

## 📂 Project Structure

```
BrowserExtension-MoodleDataAnalysis/
├── manifest.json           # Chrome extension configuration
├── popup.html              # User interface (popup view)
├── popup.js                # Controls popup behavior and events (Controller)
├── style.css               # Styling for the popup interface
│
├── js/                     # Core logic scripts (MVC structure)
│   ├── controller.js       # Manages event flow and coordinates modules
│   ├── model.js            # Data structures and processing logic (Model)
│   ├── chartRenderer.js    # Visualization logic using Chart.js or D3.js (View)
│   └── zipParser.js        # Parses .mbz files and extracts course data
│
├── libs/                   # External libraries (JSZip, Chart.js, etc.)
│   ├── jszip.min.js
│   ├── chart.min.js
│   └── sheet.min.js
│
├── icons/                  # Extension icons (16x16, 48x48, 128x128)
│
├── docker/                 # Docker setup for Moodle testing
│   └── docker-compose.yml
│
├── .gitignore              # Git configuration for ignoring files
├── README.md               # Project documentation
```

---
## 🐳 Moodle Test Server (Docker)

This project includes a preconfigured Moodle server using Docker Compose to allow testing the extension with real course data extracted from a `.mbz` backup file.

### ✅ How to Launch Moodle Locally

1. Go to the `docker/` directory:
   ```bash
   cd docker/
   ```

2. Start the containers:
   ```bash
   docker-compose up
   ```

3. Open your browser and access:
   👉 http://localhost:8080

4. Log in with:
  - **Username:** `admin`
  - **Password:** `admin123`

> Credentials are configurable in `docker-compose.yml`

---

### 📤 How to Restore a `.mbz` Course File

1. In the Moodle interface, go to:
   `Site administration > Courses > Restore`
2. Upload the `.mbz` file provided by the tutors.
3. Choose "Create a new course" when prompted.
4. Follow the steps to complete the restore process.
5. Once restored, you can navigate the course and use the browser extension to extract and analyze its data.

---

### 🔁 Stopping and Restarting

- To run in background:
  ```bash
  docker-compose up -d
  ```
- To stop the containers:
  ```bash
  docker-compose down
  ```

---

## 📜 License

This project is licensed under the **MIT License** – see the `LICENSE` file for more details.

---

🔗 **Stay tuned for updates and new features!** 🚀  
Developed as part of a Final Year Project (TFG) at the University of Málaga.