# 🏥 e-Roster: Pharmacy Staff Scheduling System — Frontend

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

> The React frontend for e-Roster, a full-stack pharmacy staff scheduling system built to replace manual Excel-based rostering with a structured, role-based web application.

🔗 **Live Demo:** [shift-f.vercel.app](https://shift-f.vercel.app)

---

## 🔍 Why a Frontend?

Backend logic alone is invisible to end users. A Django REST API can handle all the data, but non-technical staff cannot interact with raw API responses. This frontend was built to bridge that gap — making the system accessible to pharmacy managers and staff who just need to log in and get their work done.

The React frontend was developed with AI-assisted tools, while all system design, workflow logic, and feature planning were handled independently.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 Authentication | Role-based login for Manager, Full-time, Part-time, and Casual staff |
| 🗓 Shift Scheduling | View, create, edit, and delete shifts via an intuitive UI |
| 👥 Staff Management | Manage team members and their assigned roles |
| 📋 Leave Requests | Submit and manage leave requests through the interface |
| 🔄 Shift Swaps | Request and track shift swaps with full assignment history |
| 🔗 API Integration | Communicates with the Django REST API backend via Axios |

---

## 🛠 Tech Stack

| Category | Technology |
|---|---|
| Framework | React (Create React App) |
| Language | JavaScript |
| Styling | CSS |
| API Communication | Axios |
| Deployment | Vercel |
| Development Approach | AI-assisted (Claude) |

---

## 🏗 Architecture Overview

```
e-Roster Frontend (React / Vercel)
        ↕ REST API (Axios)
e-Roster Backend (Django / Render)
        ↕
Database (PostgreSQL)
```

---

## 💡 Technical Highlights

- **AI-Assisted Development** — React frontend built with AI-assisted tools to accelerate UI implementation, while core system design, workflow logic, and feature planning were independently designed

- **Role-Based UI** — Interface adapts based on user role, displaying only the actions and data relevant to each user type

- **REST API Integration** — Connects to the Django backend via Axios, handling authentication tokens, data fetching, and form submissions

- **Deployed on Vercel** — Frontend deployed independently from the backend, enabling flexible scaling and environment management

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/gawe0925/pharmacy_roster_system_front.git

# Install dependencies
npm install

# Start the development server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

> Make sure the backend API is running and the endpoint is correctly configured in your environment variables.

---

## 🎯 Purpose

This frontend was built as part of a real-world problem-solving project. The goal was not just to learn React, but to make a backend system genuinely usable by non-technical pharmacy staff — turning a working API into a tool that real people can actually benefit from.

---

## 🔗 Related Repository

- **Backend:** [pharmacy_roster_system_backend](https://github.com/gawe0925/pharmacy_roster_system_backend)
