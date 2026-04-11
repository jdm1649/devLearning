# Security Learning Project — Task Manager (Phase 1)

A full-stack task management web application built with **.NET 8 Web API** and **React + TypeScript**. This is Phase 1 of a multi-phase security learning project.

## Architecture

```
├── backend/
│   └── TaskManager/          # .NET 8 Web API
│       ├── Controllers/      # API endpoints
│       ├── Data/             # EF Core DbContext
│       ├── Models/           # Entity models & DTOs
│       └── Program.cs        # App entry point
├── frontend/                 # React + TypeScript (Vite)
│   └── src/
│       ├── api/              # API client functions
│       ├── components/       # React components
│       └── types/            # TypeScript type definitions
```

## Tech Stack

| Layer    | Technology                      |
|----------|---------------------------------|
| Backend  | .NET 8, ASP.NET Core Web API   |
| Database | SQLite via Entity Framework Core |
| Frontend | React 19, TypeScript, Vite      |

## Features

- **Task CRUD** — Create, read, update, and delete tasks
- **Priority Levels** — Low, Medium, High, Urgent
- **Status Tracking** — Pending, In Progress, Completed, Cancelled
- **Due Dates & Reminders** — Schedule tasks with due dates
- **Search & Filter** — Filter by status, priority; search by title/description
- **Sorting** — Sort by date, priority, title, or status
- **Tags** — Organize tasks with comma-separated tags
- **Soft Delete** — Tasks are soft-deleted, not permanently removed
- **Overdue Detection** — Visual indicator for overdue tasks

## Getting Started

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 18+](https://nodejs.org/)

### Run the Backend

```bash
cd backend/TaskManager
dotnet run
```

The API starts at `http://localhost:5151`. Swagger UI is available at `http://localhost:5151/swagger`.

### Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts at `http://localhost:5173` and connects to the backend API.

## API Endpoints

| Method | Endpoint                  | Description            |
|--------|---------------------------|------------------------|
| GET    | `/api/tasks`              | List all tasks (with filters) |
| GET    | `/api/tasks/{id}`         | Get a single task      |
| POST   | `/api/tasks`              | Create a new task      |
| PUT    | `/api/tasks/{id}`         | Update a task          |
| PATCH  | `/api/tasks/{id}/status`  | Update task status     |
| DELETE | `/api/tasks/{id}`         | Soft-delete a task     |

### Query Parameters (GET /api/tasks)

| Param    | Description                          |
|----------|--------------------------------------|
| status   | Filter by status (Pending, InProgress, Completed, Cancelled) |
| priority | Filter by priority (Low, Medium, High, Urgent) |
| search   | Search in title and description      |
| sortBy   | Sort field (createdAt, dueDate, priority, title, status) |
| sortDir  | Sort direction (asc, desc)           |
