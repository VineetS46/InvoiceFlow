# InvoiceFlow - Intelligent Serverless SaaS Platform 🚀

![Azure](https://img.shields.io/badge/Azure-Functions-0078D4?style=for-the-badge&logo=microsoft-azure)
![AI](https://img.shields.io/badge/GenAI-Llama_3-blueviolet?style=for-the-badge)
![Nodejs](https://img.shields.io/badge/Node.js-Backend-green?style=for-the-badge&logo=node.js)
![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge&logo=react)

### ⚠️ Note on Live Demo
> **This project uses paid cloud infrastructure (Azure Functions, Cosmos DB, Groq API). To adhere to Cloud FinOps and cost-optimization best practices, the live environment has been decommissioned. This repository contains the full source code and architectural documentation.**

---

## 📖 Overview
**InvoiceFlow** is a cloud-native SaaS platform designed to automate financial workflows. It solves the problem of manual data entry by using a **Hybrid AI Pipeline** to extract, validate, and categorize invoice data automatically.

Unlike traditional OCR, InvoiceFlow uses **Generative AI (Llama 3)** to understand context, making it capable of processing complex, unstructured documents with high accuracy.

---

## 🏗️ System Architecture & Workflow
The system is built on an **Event-Driven Serverless Architecture** to ensure scalability and zero idle costs.

### **The "Divide and Conquer" AI Pipeline:**
1.  **Ingestion:** User uploads PDF/Image -> Trigger Azure Blob Storage.
2.  **Extraction:** Azure AI Document Intelligence identifies the primary invoice page.
3.  **Intelligence:** Groq (Llama 3) extracts structured JSON (Vendor, Date, Line Items).
4.  **Storage:** Validated data is stored in **Azure Cosmos DB** with logical isolation.

<!-- <img width="586" height="1604" alt="InvoiceFlow_Backend_Flowchart" src="https://github.com/user-attachments/assets/47f284da-ec99-43c0-b94d-7f423ba28b02" /> -->

---

## ⚡ Key Features
* **🏢 Multi-Tenant Workspaces:** Secure data isolation using `/workspaceId` partition keys in Cosmos DB.
* **🧠 User-Trainable AI:** The system "learns" from user corrections to improve future categorization.
* **💸 Cost-Optimized:** 100% Serverless (Azure Functions) architecture means you only pay when code runs.
* **📊 Financial Analytics:** Real-time dashboard for tracking spending trends and overdue payments.

---

## 🛠️ Technology Stack
| Component | Technology | Reasoning |
| :--- | :--- | :--- |
| **Backend** | Azure Functions (Node.js) | Event-driven scaling & cost efficiency. |
| **Database** | Azure Cosmos DB (NoSQL) | Global scale & multi-tenant partitioning. |
| **AI Model** | Groq API (Llama 3) | Low-latency inference for extraction. |
| **Frontend** | React.js + Recharts | Responsive UI & Data Visualization. |
| **DevOps** | GitHub Actions | Automated CI/CD pipelines. |
| **Auth** | Firebase Auth | Secure identity management. |

---

## 📸 UI Snapshots

### **Dashboard  Analytics**
<img width="795" height="376" alt="image" src="https://github.com/user-attachments/assets/985501e3-970f-4eae-aba3-6e9703114a7f" />

### **Analytics**
<img width="808" height="417" alt="image" src="https://github.com/user-attachments/assets/a543068c-64a9-488c-a1ab-0060efb8a20c" />

### **AI Extraction Result**
<img width="740" height="868" alt="image" src="https://github.com/user-attachments/assets/3c813dd1-d928-42bd-8678-63ffe14f4982" />

---
