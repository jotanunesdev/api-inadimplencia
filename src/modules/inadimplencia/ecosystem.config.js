module.exports = {
  apps: [
    {
      name: "inadimplencia",
      cwd: __dirname,
      script: "server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
