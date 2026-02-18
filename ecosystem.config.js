module.exports = {
  apps: [
    {
      name: 'todo-dashboard',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      cwd: '/Users/ruanbaiye/Documents/Brickverse/Todo-Dashboard',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
