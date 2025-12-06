import express from "express";
import cors from "cors";
import deployRoute from "./routes/deploy.route";
import runRoute from "./routes/run.route";
import streamRoute from "./routes/stream.route";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/deploy", deployRoute);
app.use("/run", runRoute);
app.use("/stream", streamRoute);

app.listen(4000, () => console.log("Backend running on :4000"));
