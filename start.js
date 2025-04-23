const { spawn } = require('child_process');
const path = require('path');

// Start server
const server = spawn('node', ['server/index.js'], {
  stdio: 'inherit',
  shell: true
});

// Start client
const client = spawn('npm', ['start'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, 'client')
});

// Handle process exit
process.on('SIGINT', () => {
  server.kill();
  client.kill();
  process.exit();
}); 