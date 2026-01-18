# 🚀 Productivity Hub: Integrated Notes & Todos

A seamless workspace designed for deep work, combining structured note-taking with actionable task management.

## ✨ Core Features

### 📂 Nested Folders & Hierarchical Organization
Organize your workspace with infinite nesting. Move beyond flat lists and create a structure that mirrors your mental model.
- 📁 **Engineering**
  - 📁 **Architecture**
    - 📝 System Design Docs
    - 📝 Database Schema
  - 📁 **Sprints**
    - 📝 Sprint 42 Retrospective
- 📁 **Personal**
  - 📝 Travel Itinerary

### 🔗 Contextual Todos (Note Integration)
Never lose context again. Embed todos directly within your notes. Tasks are automatically synced to your global task manager while remaining anchored to their relevant documentation.

> **Meeting Note: Project Phoenix Kickoff**
> 
> We discussed the primary objectives for the upcoming quarter. Key stakeholders have approved the initial roadmap.
> 
> **Action Items:**
> - [x] Define MVP scope with the product team
> - [ ] Draft technical specification document `priority:high`
> - [ ] Schedule recurring sync meetings
> 
> *Note: The technical spec should focus on the new microservices architecture.*

### 📊 Centralized Dashboard
Your productivity command center. The dashboard aggregates data from across all your folders and notes to give you a clear picture of your day.

| Widget | Description |
| :--- | :--- |
| **Quick Access** | Your most recently edited notes and frequently visited folders. |
| **Task Pipeline** | A unified view of all todos extracted from notes, filtered by due date. |
| **Project Health** | Visual progress bars showing completion rates for nested projects. |
| **Daily Focus** | A curated "Top 3" list to keep you aligned with your primary goals. |

## 🛠 Technical Architecture

- **Frontend**: TypeScript, React, Tailwind CSS for a polished, accessible UI.
- **State Management**: Optimized for nested structures and real-time task syncing.
- **Backend**: CSR Architecture with Node.js, Express, and Prisma.
- **Data Integrity**: Strict Zod validation for all folder and note operations.
