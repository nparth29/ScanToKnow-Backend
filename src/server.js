// src/server.js

import { setServers } from "dns";
setServers(["8.8.8.8"]);

import "dotenv/config";
import app from "./app.js";
import mongoose from "mongoose";

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");

    const server = app.listen(PORT, () =>
      console.log(`Server running on port ${PORT}`)
    );

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Run: npx kill-port ${PORT}`);
        process.exit(1);
      } else {
        console.error("Server error:", err);
        process.exit(1);
      }
    });
  })
  .catch((err) => {
    console.error("DB connection error:", err);
    process.exit(1);
  });