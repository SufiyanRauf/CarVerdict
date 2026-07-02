"use client";

import { useState } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import Link from "next/link";

export default function Trends() {
  const [form, setForm] = useState({ make: "", model: "", startYear: "2015", endYear: "2022" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const run = async () => {
    if (loading) return;
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

  const fieldSx = {
    bgcolor: "#0f1115",
    borderRadius: 1,
    input: { color: "#e8e8e8" },
    "& fieldset": { borderColor: "#2a2e36" },
  };

  const hasData = result && result.years.some((y) => y.total > 0);
  const maxTotal = result ? Math.max(1, ...result.years.map((y) => y.total)) : 1;
  const maxComp = result?.topComponents.length ? result.topComponents[0].count : 1;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#0f1115",
        color: "#e8e8e8",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 760, px: 2, py: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Complaint trends
            </Typography>
            <Typography variant="body2" sx={{ color: "#9aa0a6" }}>
              How NHTSA complaints for a car change across model years.
            </Typography>
          </Box>
          <Button component={Link} href="/" sx={{ textTransform: "none", color: "#9aa0a6" }}>
            Back to chat
          </Button>
        </Stack>
      </Box>

      <Box sx={{ width: "100%", maxWidth: 760, px: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            size="small"
            placeholder="Make"
            value={form.make}
            onChange={set("make")}
            sx={{ ...fieldSx, flex: 1 }}
          />
          <TextField
            size="small"
            placeholder="Model"
            value={form.model}
            onChange={set("model")}
            sx={{ ...fieldSx, flex: 1 }}
          />
          <TextField
            size="small"
            placeholder="From"
            value={form.startYear}
            onChange={set("startYear")}
            sx={{ ...fieldSx, width: { sm: 90 } }}
          />
          <TextField
            size="small"
            placeholder="To"
            value={form.endYear}
            onChange={set("endYear")}
            sx={{ ...fieldSx, width: { sm: 90 } }}
          />
        </Stack>
        <Button
          variant="contained"
          onClick={run}
          disabled={loading}
          sx={{ textTransform: "none", mt: 2, px: 3 }}
        >
          {loading ? "Loading..." : "Show trends"}
        </Button>
        {error && <Typography sx={{ color: "#ef5350", mt: 2 }}>{error}</Typography>}
      </Box>

      {result && (
        <Box sx={{ width: "100%", maxWidth: 760, px: 2, py: 3 }}>
          {!hasData ? (
            <Typography sx={{ color: "#9aa0a6" }}>
              No NHTSA complaints on file for the {result.make} {result.model} in that range.
            </Typography>
          ) : (
            <>
              <Box sx={{ bgcolor: "#1b1e24", borderRadius: 2, p: 2 }}>
                <Typography variant="body2" sx={{ color: "#9aa0a6", mb: 2 }}>
                  Complaints by model year
                </Typography>
                <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ height: 190 }}>
                  {result.years.map((y) => {
                    const h = Math.round((y.total / maxTotal) * 150);
                    const sh = Math.round((y.severe / maxTotal) * 150);
                    return (
                      <Stack key={y.year} alignItems="center" justifyContent="flex-end" sx={{ flex: 1 }}>
                        <Typography variant="caption" sx={{ color: "#9aa0a6" }}>
                          {y.total}
                        </Typography>
                        <Box
                          sx={{
                            width: "70%",
                            maxWidth: 34,
                            height: h,
                            bgcolor: "#2b6cb0",
                            borderRadius: "3px 3px 0 0",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-end",
                          }}
                        >
                          <Box sx={{ height: sh, bgcolor: "#c0522d" }} />
                        </Box>
                        <Typography variant="caption" sx={{ color: "#9aa0a6", mt: 0.5 }}>
                          {y.year}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Legend color="#2b6cb0" label="all complaints" />
                  <Legend color="#c0522d" label="serious (crash, fire, or injury)" />
                </Stack>
              </Box>

              {result.topComponents.length > 0 && (
                <Box sx={{ bgcolor: "#1b1e24", borderRadius: 2, p: 2, mt: 2 }}>
                  <Typography variant="body2" sx={{ color: "#9aa0a6", mb: 2 }}>
                    Most-reported parts across these years
                  </Typography>
                  <Stack spacing={1.5}>
                    {result.topComponents.map((p) => (
                      <Box key={p.component}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">{p.component}</Typography>
                          <Typography variant="body2" sx={{ color: "#9aa0a6" }}>
                            {p.count}
                          </Typography>
                        </Stack>
                        <Box sx={{ height: 8, bgcolor: "#0f1115", borderRadius: 1, mt: 0.5 }}>
                          <Box
                            sx={{
                              width: `${Math.round((p.count / maxComp) * 100)}%`,
                              height: "100%",
                              bgcolor: "#2b6cb0",
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
                <Box
                  sx={{
                    bgcolor: "#1b1e24",
                    borderRadius: 2,
                    p: 2,
                    mt: 2,
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                  }}
                >
                  {result.summary}
                </Box>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

function Legend({ color, label }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ width: 12, height: 12, bgcolor: color, borderRadius: "2px" }} />
      <Typography variant="caption" sx={{ color: "#9aa0a6" }}>
        {label}
      </Typography>
    </Stack>
  );
}
