"use client";

import { useState } from "react";
import { Box, Button, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import Link from "next/link";

export default function Trends() {
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({ make: "", model: "", startYear: "", endYear: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const validYear = (y) => /^\d{4}$/.test(String(y).trim());
  const numericLike = (s) => /^\d+$/.test(String(s).trim());

  const ready =
    form.make.trim() &&
    !numericLike(form.make) &&
    form.model.trim() &&
    validYear(form.startYear) &&
    validYear(form.endYear);

  const run = async () => {
    if (loading || !ready) return;
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
      run();
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

  const hasData = result && result.years.some((y) => y.total > 0);
  const maxTotal = result ? Math.max(1, ...result.years.map((y) => y.total)) : 1;
  const maxComp = result?.topComponents.length ? result.topComponents[0].count : 1;

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
              <Button component={Link} href="/compare" sx={navBtn}>
                Compare
              </Button>
              <Button component={Link} href="/trends" sx={navBtnActive}>
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
          Complaint trends
        </Typography>
        <Typography variant="body2" sx={{ color: "#5b6472", mb: 2 }}>
          How NHTSA complaints for a car change across model years.
        </Typography>

        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              size="small"
              label="Make (example: Toyota)"
              value={form.make}
              onChange={set("make")}
              onKeyDown={handleKey}
              error={numericLike(form.make)}
              helperText={numericLike(form.make) ? "Enter a make, like Toyota" : ""}
              sx={{ ...fieldSx, flex: 1 }}
            />
            <TextField
              size="small"
              label="Model (example: Camry)"
              value={form.model}
              onChange={set("model")}
              onKeyDown={handleKey}
              sx={{ ...fieldSx, flex: 1 }}
            />
          </Stack>
          <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }} sx={{ alignItems: "center" }}>
            <TextField
              size="small"
              label={`From year (${currentYear - 10})`}
              value={form.startYear}
              onChange={set("startYear")}
              onKeyDown={handleKey}
              error={form.startYear.trim() !== "" && !validYear(form.startYear)}
              helperText={form.startYear.trim() !== "" && !validYear(form.startYear) ? "4-digit year" : ""}
              sx={{ ...fieldSx, flex: { xs: 1, sm: "0 0 170px" } }}
            />
            <Typography sx={{ color: "#5b6472" }}>to</Typography>
            <TextField
              size="small"
              label={`To year (${currentYear})`}
              value={form.endYear}
              onChange={set("endYear")}
              onKeyDown={handleKey}
              error={form.endYear.trim() !== "" && !validYear(form.endYear)}
              helperText={form.endYear.trim() !== "" && !validYear(form.endYear) ? "4-digit year" : ""}
              sx={{ ...fieldSx, flex: { xs: 1, sm: "0 0 170px" } }}
            />
          </Stack>
        </Stack>
        <Button
          variant="contained"
          onClick={run}
          disabled={loading || !ready}
          startIcon={loading ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : null}
          sx={{ ...primaryBtn, mt: 2 }}
        >
          {loading ? "Loading trends..." : "Show trends"}
        </Button>
        {loading && (
          <Typography variant="caption" sx={{ color: "#5b6472", display: "block", mt: 1 }}>
            Pulling NHTSA records for each model year. This can take a few seconds.
          </Typography>
        )}
        {error && <Typography sx={{ color: "#c0392b", mt: 2 }}>{error}</Typography>}
        {!result && !loading && !error && (
          <Typography variant="caption" sx={{ color: "#5b6472", display: "block", mt: 1.5 }}>
            Works best on high-volume cars like a Honda Civic or Ford F-150.
          </Typography>
        )}

        {result && (
          <Box sx={{ mt: 3 }}>
            {!hasData ? (
              <Typography sx={{ color: "#5b6472" }}>
                No NHTSA complaints on file for the {result.make} {result.model} in that range. Try a
                high-volume model like a Honda Civic or Ford F-150.
              </Typography>
            ) : (
              <>
                <Box sx={{ ...card, borderRadius: 2, p: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: "#1f2733", fontWeight: 600, mb: 2 }}>
                    Complaints by model year
                  </Typography>
                  <Box sx={{ overflowX: "auto", pb: 1 }}>
                    <Box sx={{ minWidth: result.years.length * 48 }}>
                      <Stack
                        direction="row"
                        spacing={{ xs: 1, sm: 2 }}
                        sx={{ height: 230, alignItems: "flex-end", borderBottom: "1px solid #e3e7ec" }}
                      >
                        {result.years.map((y) => {
                          const th = Math.round((y.total / maxTotal) * 200);
                          const sh = y.severe > 0 ? Math.max(2, Math.round((y.severe / maxTotal) * 200)) : 0;
                          return (
                            <Stack
                              key={y.year}
                              direction="row"
                              spacing={0.25}
                              sx={{ flex: 1, alignItems: "flex-end", justifyContent: "center" }}
                            >
                              <Stack sx={{ alignItems: "center", justifyContent: "flex-end" }}>
                                <Typography variant="caption" sx={{ color: "#1f2733", fontSize: { xs: 10, sm: 12 } }}>
                                  {y.total}
                                </Typography>
                                <Box sx={{ width: 16, height: th, bgcolor: "#1e3a5f", borderRadius: "3px 3px 0 0" }} />
                              </Stack>
                              <Box sx={{ width: 16, height: sh, bgcolor: "#c0522d", borderRadius: "3px 3px 0 0" }} />
                            </Stack>
                          );
                        })}
                      </Stack>
                      <Stack direction="row" spacing={{ xs: 1, sm: 2 }} sx={{ mt: 0.5 }}>
                        {result.years.map((y) => (
                          <Typography
                            key={y.year}
                            variant="caption"
                            sx={{ flex: 1, textAlign: "center", color: "#5b6472", fontSize: { xs: 10, sm: 12 } }}
                          >
                            {y.year}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>
                  </Box>
                  <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                    <Legend color="#1e3a5f" label="all complaints" />
                    <Legend color="#c0522d" label="serious (crash, fire, injury, or death)" />
                  </Stack>
                </Box>

                {result.topComponents.length > 0 && (
                  <Box sx={{ ...card, borderRadius: 2, p: 2, mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: "#1f2733", fontWeight: 600, mb: 2 }}>
                      Most-reported parts across these years
                    </Typography>
                    <Stack spacing={1.5}>
                      {result.topComponents.map((p) => (
                        <Box key={p.component}>
                          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                            <Typography variant="body2">{prettyPart(p.component)}</Typography>
                            <Typography variant="body2" sx={{ color: "#5b6472" }}>
                              {p.count}
                            </Typography>
                          </Stack>
                          <Box sx={{ height: 8, bgcolor: "#eef1f5", borderRadius: 1, mt: 0.5 }}>
                            <Box
                              sx={{
                                width: `${Math.round((p.count / maxComp) * 100)}%`,
                                height: "100%",
                                bgcolor: "#1e3a5f",
                                borderRadius: 1,
                              }}
                            />
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}

                {result.summary && (
                  <Box sx={{ ...card, borderRadius: 2, borderLeft: "3px solid #1e3a5f", p: 2, mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: "#1f2733", fontWeight: 600, mb: 1 }}>
                      Summary
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {result.summary}
                    </Typography>
                  </Box>
                )}
              </>
            )}
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

function Legend({ color, label }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
      <Box sx={{ width: 12, height: 12, bgcolor: color, borderRadius: "2px" }} />
      <Typography variant="caption" sx={{ color: "#5b6472" }}>
        {label}
      </Typography>
    </Stack>
  );
}
