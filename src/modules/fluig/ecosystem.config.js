module.exports = {
  apps: [
    {
      name: "fluig",
      cwd: __dirname,
      script: "server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
