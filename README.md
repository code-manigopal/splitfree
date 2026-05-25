# SplitFree — Trip Expense Tracker

SplitFree is a lightweight, real-time web application designed to help groups seamlessly track, split, and settle shared expenses during trips. It eliminates the friction of manual math by providing smart settlement algorithms, visual analytics, and easy export options.

## Core Features

| Feature | Description |
| :--- | :--- |
| **Secure Authentication** | Quick login using Google accounts via Firebase Auth. |
| **Real-Time Database** | Live synchronization across all users' devices using Firestore. |
| **Smart Settlements** | Built-in algorithm that minimizes the total number of transactions needed for everyone to square up. |
| **Role-Based Access** | Admins can approve/reject members, edit trip details, or delete the trip. |
| **Granular Expenses** | Add costs, assign specific participants, tag categories (Food, Travel, etc.), and track exactly who paid. |
| **Visual Analytics** | Interactive pie and bar charts powered by Chart.js to visualize spending patterns. |
| **One-Click Exports** | Generate comprehensive trip reports in PDF format or raw data in CSV format. |

---

## How to Use SplitFree

1. Sign in on the landing page using your Google account.
2. Click **+ Create Trip** from the home dashboard to set up a new itinerary.
3. Fill in the trip details, including the name, dates, default currency, and an optional description.
4. Click **🔗 Share Link** inside the trip view to copy the invite URL and send it to your travel group.
5. Navigate to the **👥 Members** tab to approve pending users as they request to join your trip.
6. Click **+ Add Expense** whenever someone makes a purchase.
7. Input the expense description, total amount, category, who paid, and check off the specific people splitting that cost.
8. Monitor the **📊 Dashboard** to see live updates on your personal balance, total trip spending, and recent activity.
9. Open the **🔄 Settle Up** tab at the end of the trip to view the optimized list of who owes whom.
10. Click the **✓ Mark Done** button next to a settlement route once the money has been transferred in real life.
11. Navigate to the **📈 Finalytics** tab to download a final PDF report or CSV spreadsheet of all trip data.
12. Archive the trip from the main dashboard once everything is fully settled.

---

## Local Development Setup

1. Clone this repository to your local machine.
2. Verify that `index.html`, `style.css`, and `corelogic.js` are located in the same root directory.
3. Open `corelogic.js` and replace the `FB` configuration object with your own Firebase project credentials.
4. Enable **Google Sign-In** under Authentication in your Firebase Console.
5. Enable **Cloud Firestore** and configure your security rules to manage read/write access.
6. Serve the project directory using a local web server (such as the VS Code Live Server extension) to allow ES modules to load correctly.
7. Open the provided localhost URL in your web browser to test the application.

---

## Technology Stack

* **Frontend:** HTML5, CSS3 (Custom Variables), Vanilla JavaScript (ES Modules).
* **Backend as a Service:** Firebase Authentication, Cloud Firestore.
* **Libraries:** Chart.js (Data Visualization), jsPDF (Document Generation).
