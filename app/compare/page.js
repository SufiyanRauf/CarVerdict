"use client";

import { useState } from "react";
import { Box, Button, Chip, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import Link from "next/link";

export default function Compare() {
  const [carA, setCarA] = useState({ make: "", model: "", year: "" });
  const [carB, setCarB] = useState({ make: "", model: "", year: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const validYear = (y) => /^\d{4}$/.test(String(y).trim());
  const numericLike = (s) => /^\d+$/.test(String(s).trim()); // a make of only digits is likely a mixed-up field (some models are just numbers, like the Ram 1500)

  const carOk = (c) =>
    c.make.trim() && !numericLike(c.make) && c.model.trim() && validYear(c.year);
  const ready = carOk(carA) && carOk(carB);

  const runCompare = async () => {
    if (loading || !ready) return;
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicles: [carA, carB] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runCompare();
    }
  };

  const fieldSx = {
    bgcolor: "#fff",
    borderRadius: 1.5,
    input: { color: "#1f2733", fontSize: 16 },
    "& fieldset": { borderColor: "#cbd2d9" },
    "& .Mui-focused fieldset": { borderColor: "#1e3a5f", borderWidth: "1.5px" },
    "& label": { color: "#5b6472" },
    "& label.Mui-focused": { color: "#1e3a5f" },
  };

  const primaryBtn = {
    textTransform: "none",
    px: 3,
    bgcolor: "#1e3a5f",
    "&:hover": { bgcolor: "#16304d" },
  };

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

  const card = {
    bgcolor: "#fff",
    border: "1px solid #d7dde5",
    boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
  };

  const prettyPart = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  const cars = [
    ["First car", carA, setCarA],
    ["Second car", carB, setCarB],
  ];

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "#f7f8fa",
        color: "#1f2733",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ width: "100%", bgcolor: "#1e3a5f", color: "#fff" }}>
        <Box sx={{ width: "100%", maxWidth: 760, mx: "auto", px: 2, py: 2 }}>
          <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Box component={Link} href="/" sx={{ textDecoration: "none", color: "#fff" }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                CarVerdict
              </Typography>
            </Box>
            <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} sx={{ alignItems: "center" }}>
              <Button component={Link} href="/" sx={navBtn}>
                Home
              </Button>
              <Button component={Link} href="/compare" sx={navBtnActive}>
                Compare
              </Button>
              <Button component={Link} href="/trends" sx={navBtn}>
                Trends
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          width: "100%",
          maxWidth: 760,
          mx: "auto",
          px: 2,
          py: 3,
          display: "flex",
          flexDirection: "column",
          justifyContent: result ? "flex-start" : { xs: "flex-start", md: "center" },
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Compare two vehicles
        </Typography>
        <Typography variant="body2" sx={{ color: "#5b6472", mb: 2 }}>
          See which car owners complain about less, using NHTSA records and safety ratings.
        </Typography>

        <Stack spacing={2}>
          {cars.map(([label, v, set]) => (
            <Box key={label} sx={{ ...card, borderRadius: 2, p: 2 }}>
              <Typography variant="subtitle2" sx={{ color: "#1f2733", fontWeight: 600, mb: 1 }}>
                {label}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  size="small"
                  label="Make (example: Toyota)"
                  value={v.make}
                  onChange={(e) => set({ ...v, make: e.target.value })}
                  onKeyDown={handleKey}
                  error={numericLike(v.make)}
                  helperText={numericLike(v.make) ? "Enter a make, like Toyota" : ""}
                  sx={{ ...fieldSx, flex: 1 }}
                />
                <TextField
                  size="small"
                  label="Model (example: Camry)"
                  value={v.model}
                  onChange={(e) => set({ ...v, model: e.target.value })}
                  onKeyDown={handleKey}
                  sx={{ ...fieldSx, flex: 1 }}
                />
                <TextField
                  size="small"
                  label="Year (example: 2019)"
                  value={v.year}
                  onChange={(e) => set({ ...v, year: e.target.value })}
                  onKeyDown={handleKey}
                  error={v.year.trim() !== "" && !validYear(v.year)}
                  helperText={v.year.trim() !== "" && !validYear(v.year) ? "Use a 4-digit year, like 2019" : ""}
                  sx={{ ...fieldSx, width: { sm: 200 } }}
                />
              </Stack>
            </Box>
          ))}

          <Box>
            <Button
              variant="contained"
              onClick={runCompare}
              disabled={loading || !ready}
              startIcon={loading ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : null}
              sx={{ ...primaryBtn, alignSelf: "flex-start" }}
            >
              {loading ? "Comparing..." : "Compare"}
            </Button>
            {loading && (
              <Typography variant="caption" sx={{ color: "#5b6472", display: "block", mt: 1 }}>
                Pulling NHTSA records and safety ratings. This can take a few seconds.
              </Typography>
            )}
          </Box>
          {error && <Typography sx={{ color: "#c0392b" }}>{error}</Typography>}
          {!result && !loading && !error && (
            <Typography variant="caption" sx={{ color: "#5b6472" }}>
              Example: Toyota Camry 2019 vs Honda Accord 2019.
            </Typography>
          )}
        </Stack>

        {result && (
          <Box sx={{ mt: 3 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              {result.vehicles.map((s, i) => (
                <Box
                  key={i}
                  sx={{ ...card, flex: 1, borderRadius: 2, p: 2, display: "flex", flexDirection: "column" }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {s.year} {s.make} {s.model}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#5b6472", mb: 1 }}>
                    {s.noData ? "No NHTSA complaints on file" : `${s.complaints} complaints on file`}
                    {s.stars ? (
                      <Box component="span" sx={{ color: "#c8890f", fontWeight: 600 }}>
                        {" · "}NCAP {s.stars}★ overall
                      </Box>
                    ) : (
                      " · NCAP rating not available"
                    )}
                  </Typography>
                  {!s.noData && (
                    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                      {s.topComponents.map((c) => (
                        <Chip
                          key={c.component}
                          label={`${prettyPart(c.component)} · ${c.count}`}
                          size="small"
                          sx={{ bgcolor: "#eef1f5", color: "#1e3a5f", border: "1px solid #dde3ea", mb: 0.5 }}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              ))}
            </Stack>

            <Typography variant="caption" sx={{ color: "#5b6472", display: "block", mt: 2 }}>
              Complaint counts here are a recent sample per car, used to surface the most-reported
              parts, not lifetime totals. NCAP is the U.S. New Car Assessment Program, a government
              crash-test safety rating out of 5 stars.
            </Typography>

            <Box
              sx={{
                ...card,
                borderRadius: 2,
                borderLeft: "3px solid #1e3a5f",
                p: 2,
                mt: 2,
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              {result.verdict}
            </Box>
          </Box>
        )}
      </Box>

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
    </Box>
  );
}
