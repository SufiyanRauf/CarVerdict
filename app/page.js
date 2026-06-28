"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Ask me what tends to go wrong with a specific car. I look through real owner complaints filed with the NHTSA.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // add-a-vehicle form
  const [showForm, setShowForm] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [vin, setVin] = useState("");
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState({ open: false, severity: "success", message: "" });

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setLoading(true);
    const history = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok) throw new Error("request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, content: last.content + text }];
        });
      }
    } catch {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return [
          ...prev.slice(0, -1),
          { ...last, content: "Sorry, something went wrong. Please try again." },
        ];
      });
    } finally {
      setLoading(false);
    }
  };

  const addVehicle = async () => {
    if (adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ make, model, year, vin }),
      });
      const data = await res.json();

      if (!res.ok) {
        setToast({ open: true, severity: "error", message: data.error || "Couldn't add that vehicle." });
      } else if (data.count === 0) {
        setToast({
          open: true,
          severity: "warning",
          message: `No NHTSA complaints found for the ${data.year} ${data.make} ${data.model}.`,
        });
      } else {
        setToast({
          open: true,
          severity: "success",
          message: `Loaded ${data.count} complaint${
            data.count === 1 ? "" : "s"
          } for the ${data.year} ${data.make} ${data.model}. You can ask about it now.`,
        });
        setMake("");
        setModel("");
        setYear("");
        setVin("");
        setShowForm(false);
      }
    } catch {
      setToast({ open: true, severity: "error", message: "Couldn't add that vehicle. Please try again." });
    } finally {
      setAdding(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const fieldSx = {
    bgcolor: "#0f1115",
    borderRadius: 1,
    input: { color: "#e8e8e8" },
    "& fieldset": { borderColor: "#2a2e36" },
  };

  return (
    <Box
      sx={{
        height: "100vh",
        bgcolor: "#0f1115",
        color: "#e8e8e8",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 760, px: 2, py: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          CarVerdict
        </Typography>
        <Typography variant="body2" sx={{ color: "#9aa0a6" }}>
          What owners actually complain about, from NHTSA records.
        </Typography>
      </Box>

      <Stack
        spacing={2}
        sx={{
          width: "100%",
          maxWidth: 760,
          flex: 1,
          overflowY: "auto",
          px: 2,
          pb: 2,
        }}
      >
        {messages.map((m, i) => (
          <Box
            key={i}
            sx={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <Box
              sx={{
                bgcolor: m.role === "user" ? "#2b6cb0" : "#1b1e24",
                color: m.role === "user" ? "#fff" : "#e8e8e8",
                px: 2,
                py: 1.25,
                borderRadius: 2,
                maxWidth: "80%",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              {m.content || "..."}
            </Box>
          </Box>
        ))}
        <div ref={bottomRef} />
      </Stack>

      <Box sx={{ width: "100%", maxWidth: 760, px: 2 }}>
        <Button
          onClick={() => setShowForm((s) => !s)}
          sx={{ textTransform: "none", color: "#9aa0a6", px: 0 }}
        >
          {showForm ? "Close" : "+ Add a vehicle"}
        </Button>

        {showForm && (
          <Box sx={{ bgcolor: "#1b1e24", borderRadius: 1, p: 2, mt: 1 }}>
            <Typography variant="body2" sx={{ color: "#9aa0a6", mb: 1.5 }}>
              Not in the list yet? Add it by make, model, and year, or paste a VIN.
              CarVerdict pulls its NHTSA complaints so you can ask about it.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
              <TextField
                size="small"
                placeholder="Make"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                sx={{ ...fieldSx, flex: 1 }}
              />
              <TextField
                size="small"
                placeholder="Model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                sx={{ ...fieldSx, flex: 1 }}
              />
              <TextField
                size="small"
                placeholder="Year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                sx={{ ...fieldSx, width: { sm: 110 } }}
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder="or paste a VIN"
                value={vin}
                onChange={(e) => setVin(e.target.value)}
                sx={fieldSx}
              />
              <Button
                variant="contained"
                onClick={addVehicle}
                disabled={adding}
                sx={{ textTransform: "none", px: 3 }}
              >
                {adding ? "Adding..." : "Add"}
              </Button>
            </Stack>
          </Box>
        )}
      </Box>

      <Box sx={{ width: "100%", maxWidth: 760, px: 2, py: 3 }}>
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            size="small"
            placeholder="What goes wrong with a 2018 Honda Accord?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            sx={{
              bgcolor: "#1b1e24",
              borderRadius: 1,
              input: { color: "#e8e8e8" },
              "& fieldset": { borderColor: "#2a2e36" },
            }}
          />
          <Button
            variant="contained"
            onClick={sendMessage}
            disabled={loading}
            sx={{ textTransform: "none", px: 3 }}
          >
            {loading ? "..." : "Send"}
          </Button>
        </Stack>
      </Box>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((t) => ({ ...t, open: false }))}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
