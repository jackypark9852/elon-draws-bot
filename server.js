import express from "express";
import Run from "./index.js";
import { CronJob } from "cron";

const app = express();
app.get("/", (req, res) => {
  res.status(200).send("Hello server is running").end();
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log("Press Ctrl+C to quit.");
});

// Start
console.log("App Started");
var job = new CronJob(
  "*/5 * * * *",
  function () {
    Run();
  },
  null,
  true,
  "America/Los_Angeles"
);
