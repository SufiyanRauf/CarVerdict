"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";

// suggestions shown on the landing screen: a spread of makes and body styles (EV, SUV, truck,
// luxury sedan) so a first-time visitor sees the range of cars it covers, all pre-loaded
const examples = [
  "What goes wrong with a 2021 Tesla Model 3?",
  "Compare a 2019 Honda CR-V and a 2019 Toyota RAV4",
  "Common problems with a 2020 Ford F-150",
  "What are common issues with a 2019 BMW 3 Series?",
];

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Ask me what tends to go wrong with a specific car, or compare two. I look through real owner complaints filed with the NHTSA.",
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

  const sendMessage = async (preset) => {
    const question = (typeof preset === "string" ? preset : input).trim();
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
      const marker = "<<<SOURCES>>>";
      let raw = "";
      // the answer text streams first, then the marker and the complaints it was grounded in
      const apply = (done) => {
        const at = raw.indexOf(marker);
        let answer = at === -1 ? raw : raw.slice(0, at);
        const srcRaw = at === -1 ? "" : raw.slice(at + marker.length);

        // the marker can arrive a few characters at a time, so don't flash a half-typed one
        if (at === -1) {
          for (let k = marker.length - 1; k > 0; k--) {
            if (answer.endsWith(marker.slice(0, k))) {
              answer = answer.slice(0, -k);
              break;
            }
          }
        }

        let sources;
        if (srcRaw) {
          try {
            sources = JSON.parse(srcRaw);
          } catch {
            sources = undefined; // the sources JSON is still arriving
          }
        }

        const content =
          done && !answer.trim() ? "I couldn't find anything on that. Try another car." : answer;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, content, ...(sources ? { sources } : {}) }];
        });
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        apply(false);
      }
      apply(true);
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

  const handleAddKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addVehicle();
    }
  };

  const fieldSx = {
    bgcolor: "#fff",
    borderRadius: 1.5,
    input: { color: "#1f2733", fontSize: 16 }, // 16px keeps iOS Safari from zooming in on focus
    "& fieldset": { borderColor: "#cbd2d9" },
    "& .Mui-focused fieldset": { borderColor: "#1e3a5f", borderWidth: "1.5px" },
  };

  // the main ask bar is a bit taller than the small form fields so it reads as the primary action
  const askSx = {
    ...fieldSx,
    input: { color: "#1f2733", fontSize: 17, py: 1.25 },
  };

  // navy buttons to match the accent, since MUI's default contained blue looked a bit generic
  const primaryBtn = {
    textTransform: "none",
    px: 3,
    bgcolor: "#1e3a5f",
    "&:hover": { bgcolor: "#16304d" },
  };

  // the nav links sit on the navy header, so they need to be light
  const navBtn = {
    textTransform: "none",
    color: "rgba(255,255,255,0.9)",
    px: { xs: 1, sm: 1.75 },
    minWidth: 0,
    fontSize: { xs: 13, sm: 14 },
    border: "1px solid rgba(255,255,255,0.35)",
    borderRadius: 1,
    "&:hover": { color: "#fff", borderColor: "rgba(255,255,255,0.7)", bgcolor: "rgba(255,255,255,0.1)" },
  };

  const navBtnActive = {
    ...navBtn,
    color: "#fff",
    fontWeight: 600,
    borderColor: "#fff",
    bgcolor: "rgba(255,255,255,0.12)",
  };

  const crossLink = {
    color: "#1e3a5f",
    textDecoration: "none",
    fontWeight: 600,
    "&:hover": { textDecoration: "underline" },
  };

  const canAdd = (make.trim() && model.trim()) || vin.trim();

  // NHTSA sends component names in all caps; tidy them for the source chips
  const prettyPart = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  const header = (
    <Box sx={{ width: "100%", bgcolor: "#1e3a5f", color: "#fff" }}>
      <Box sx={{ width: "100%", maxWidth: 760, mx: "auto", px: 2, py: 2 }}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Box component={Link} href="/" sx={{ textDecoration: "none", color: "#fff" }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              CarVerdict
            </Typography>
          </Box>
          <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} sx={{ alignItems: "center" }}>
            <Button component={Link} href="/" sx={navBtnActive}>
              Home
            </Button>
            <Button component={Link} href="/compare" sx={navBtn}>
              Compare
            </Button>
            <Button component={Link} href="/trends" sx={navBtn}>
              Trends
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );

  const addVehicleBlock = (
    <Box sx={{ textAlign: "left" }}>
      <Button
        onClick={() => setShowForm((s) => !s)}
        sx={{ textTransform: "none", color: "#5b6472", px: 0 }}
      >
        {showForm ? "Close" : "+ Add a vehicle"}
      </Button>

      {showForm && (
        <Box
          sx={{
            bgcolor: "#fff",
            border: "1px solid #d7dde5",
            boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
            borderRadius: 2,
            p: 2,
            mt: 1,
          }}
        >
          <Typography variant="body2" sx={{ color: "#5b6472", mb: 1.5 }}>
            Optional. Asking about a car it does not have yet already loads it for you. Use this to
            pre-load one first, by make, model, and year, or paste a VIN.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
            <TextField
              size="small"
              placeholder="Make"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              onKeyDown={handleAddKey}
              sx={{ ...fieldSx, flex: 1 }}
            />
            <TextField
              size="small"
              placeholder="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onKeyDown={handleAddKey}
              sx={{ ...fieldSx, flex: 1 }}
            />
            <TextField
              size="small"
              placeholder="Year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              onKeyDown={handleAddKey}
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
              onKeyDown={handleAddKey}
              sx={fieldSx}
            />
            <Button variant="contained" onClick={addVehicle} disabled={adding || !canAdd} sx={primaryBtn}>
              {adding ? "Adding..." : "Add"}
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );

  const footer = (
    <Box
      sx={{
        width: "100%",
        maxWidth: 760,
        mx: "auto",
        px: 2,
        pb: 2,
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 1,
      }}
    >
      <Typography variant="caption" sx={{ color: "#5b6472" }}>
        Data from the NHTSA public complaint database. Not affiliated with NHTSA.
      </Typography>
      <Typography
        variant="caption"
        component="a"
        href="https://github.com/SufiyanRauf/CarVerdict"
        target="_blank"
        rel="noopener noreferrer"
        sx={{ color: "#1e3a5f", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
      >
        Source on GitHub
      </Typography>
    </Box>
  );

  return (
    <Box
      sx={{
        height: "100dvh",
        bgcolor: "#f7f8fa",
        color: "#1f2733",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {header}

      {messages.length === 1 ? (
        // landing: value prop, then the ask bar up top as the main action, then suggestions
        <Box
          sx={{
            flex: 1,
            width: "100%",
            maxWidth: 760,
            mx: "auto",
            px: 2,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            justifyContent: { xs: "flex-start", md: "center" },
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={{ xs: 3, md: 4 }}
            sx={{ py: { xs: 3, md: 4 }, alignItems: { md: "flex-start" } }}
          >
            <Box sx={{ flex: { md: 1.8 }, textAlign: { xs: "center", md: "left" } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
                Find a car&apos;s common problems before you buy
              </Typography>
              <Typography variant="body1" sx={{ color: "#4a5261", mb: 2 }}>
                Ask what goes wrong with a specific car and get an answer from real NHTSA owner
                complaints, grouped by the part that fails. Compare two cars, or chart how a model&apos;s
                complaints change by year.
              </Typography>
              <Typography variant="body2" sx={{ color: "#4a5261", mb: 2.5 }}>
                It pulls NHTSA records live for almost any car, with{" "}
                <Box component="span" sx={{ color: "#1e3a5f", fontWeight: 700 }}>
                  55
                </Box>{" "}
                popular models pre-loaded for instant answers.
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  placeholder="Ask about a car, or compare two..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  sx={askSx}
                />
                <Button
                  variant="contained"
                  onClick={sendMessage}
                  disabled={loading}
                  sx={{ ...primaryBtn, fontWeight: 600 }}
                >
                  {loading ? "..." : "Ask"}
                </Button>
              </Stack>
            </Box>

            <Box sx={{ flex: { md: 1 }, width: "100%" }}>
              <Typography variant="body2" sx={{ color: "#5b6472", fontWeight: 600, mb: 1.5 }}>
                Suggestions
              </Typography>
              <Stack spacing={1.5}>
                {examples.map((q) => (
                  <ButtonBase
                    key={q}
                    onClick={() => sendMessage(q)}
                    sx={{
                      width: "100%",
                      bgcolor: "#fff",
                      border: "1px solid #c2ccd9",
                      boxShadow: "0 1px 2px rgba(16,24,40,0.06)",
                      borderRadius: 2,
                      px: 2,
                      py: 1.5,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      textAlign: "left",
                      transition: "border-color 120ms, box-shadow 120ms, background-color 120ms",
                      "&:hover": {
                        borderColor: "#1e3a5f",
                        bgcolor: "#f5f8fc",
                        boxShadow: "0 2px 8px rgba(16,24,40,0.10)",
                      },
                    }}
                  >
                    <Typography variant="body2" sx={{ color: "#1f2733", fontWeight: 500 }}>
                      {q}
                    </Typography>
                    <Box component="span" sx={{ color: "#1e3a5f", ml: 2, fontWeight: 700, flexShrink: 0 }}>
                      &rarr;
                    </Box>
                  </ButtonBase>
                ))}
              </Stack>
              <Typography variant="caption" sx={{ display: "block", color: "#5b6472", mt: 2 }}>
                You can also{" "}
                <Box component={Link} href="/compare" sx={crossLink}>
                  compare two cars side by side
                </Box>{" "}
                or{" "}
                <Box component={Link} href="/trends" sx={crossLink}>
                  chart how complaints trend by year
                </Box>
                .
              </Typography>
            </Box>
          </Stack>
        </Box>
      ) : (
        // chat: messages scroll, input pinned at the bottom
        <>
          <Stack
            spacing={2}
            sx={{ width: "100%", maxWidth: 760, flex: 1, overflowY: "auto", px: 2, pt: 2, pb: 2 }}
          >
            {messages.map((m, i) => (
              <Box
                key={i}
                sx={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}
              >
                <Box
                  sx={{
                    bgcolor: m.role === "user" ? "#1e3a5f" : "#fff",
                    color: m.role === "user" ? "#fff" : "#1f2733",
                    border: m.role === "user" ? "none" : "1px solid #d7dde5",
                    boxShadow: m.role === "user" ? "none" : "0 1px 2px rgba(16,24,40,0.04)",
                    px: 2,
                    py: m.role === "user" ? 1.25 : 1.75,
                    borderRadius: 2,
                    maxWidth: m.role === "user" ? "80%" : "100%",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.6,
                  }}
                >
                  {m.role === "assistant" && m.content.trim() === "" && loading ? (
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <CircularProgress size={14} sx={{ color: "#5b6472" }} />
                      <Typography variant="body2" sx={{ color: "#5b6472" }}>
                        Reading NHTSA records...
                      </Typography>
                    </Stack>
                  ) : (
                    <>
                      {m.content}
                      {m.role === "assistant" && m.sources?.count > 0 && (
                        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid #e6eaef" }}>
                          <Typography variant="caption" sx={{ color: "#5b6472", display: "block", mb: 0.75 }}>
                            Grounded in {m.sources.count} NHTSA complaint
                            {m.sources.count === 1 ? "" : "s"}
                          </Typography>
                          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                            {m.sources.items.map((s, j) => (
                              <Chip
                                key={j}
                                size="small"
                                label={`${s.year} ${s.make} ${s.model}${
                                  s.component ? " · " + prettyPart(s.component) : ""
                                }`}
                                sx={{ bgcolor: "#eef1f5", color: "#1e3a5f", border: "1px solid #dde3ea" }}
                              />
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              </Box>
            ))}
            <div ref={bottomRef} />
          </Stack>

          <Box sx={{ width: "100%", maxWidth: 760, px: 2, pt: 3, pb: 1.5 }}>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder="Ask about a car, or compare two..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                sx={fieldSx}
              />
              <Button variant="contained" onClick={sendMessage} disabled={loading} sx={primaryBtn}>
                {loading ? "..." : "Ask"}
              </Button>
            </Stack>
          </Box>
        </>
      )}

      {footer}

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
