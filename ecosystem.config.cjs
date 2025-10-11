require("dotenv").config();

const env = require("dotenv").config().parsed || {};

module.exports = {
  apps: [
    {
      name: "remix-app",
      script: "npm",
      args: "start",
      cwd: "/home/country-blocker/htdocs/country-blocker.devoptly.com/current",
      env: {
        NODE_ENV: "production",
        ...env
      }
    }
  ]
};
