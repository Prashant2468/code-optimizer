# Code Complexity Analyzer

A web application that analyzes code complexity for Java, C++, and Python code.

## Features

- Code input with syntax highlighting
- Support for Java, C++, and Python
- Real-time complexity analysis
- Dark/Light mode toggle
- Responsive design

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm run install-all
   ```

## Running the Application

1. Start both frontend and backend:
   ```bash
   npm start
   ```

2. The application will be available at:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

## Usage

1. Select your programming language from the dropdown
2. Paste your code in the editor
3. Click "Analyze Code" to get complexity analysis
4. View the results in the right panel

## Technologies Used

- Frontend:
  - React.js
  - Monaco Editor
  - Tailwind CSS
  - Axios

- Backend:
  - Node.js
  - Express.js
  - Code parsing libraries

## Note

This is a simplified version of code complexity analysis. The actual complexity might vary based on the specific implementation details of your code. 