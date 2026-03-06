module.exports = {
  apps: [
    {
      name: "treinamento",
      cwd: __dirname,
      script: "server.ts",
      interpreter: "node",
      node_args: "--import tsx",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
