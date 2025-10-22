import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.get("/api/posts", async (req, res) => {
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, body, user_id");

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post("/api/posts", async (req, res) => {
  const { title, body, user_id } = req.body;
  const { data, error } = await supabase
    .from("posts")
    .insert([{ title, body, user_id }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

app.listen(5000, () => console.log("http://localhost:5000"));
