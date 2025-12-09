import express from "express";
import cors from "cors";

import streamRoute from "./routes/stream.route";
import functionsRoute from "./routes/functions.route";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/stream", streamRoute);
app.use("/functions", functionsRoute);

app.listen(4000, () => console.log("Backend running on :4000"));