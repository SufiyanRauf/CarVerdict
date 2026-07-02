"use client";

import { useState } from "react";
import { Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import Link from "next/link";

const blank = { make: "", model: "", year: "" };

export default function Compare() {
  const [carA, setCarA] = useState({ ...blank });
  const [carB, setCarB] = useState({ ...blank });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const runCompare = async () => {
    if (loading) return;
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

  const fieldSx = {
    bgcolor: "#0f1115",
    borderRadius: 1,
    input: { color: "#e8e8e8", fontSize: 16 },
    "& fieldset": { borderColor: "#2a2e36" },
  };

  const cars = [
    ["First car", carA, setCarA],
    ["Second car", carB, setCarB],
  ];

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
              Compare vehicles
            </Typography>
            <Typography variant="body2" sx={{ color: "#9aa0a6" }}>
              See which car owners complain about less, using NHTSA records and safety ratings.
            </Typography>
          </Box>
          <Button component={Link} href="/" sx={{ textTransform: "none", color: "#9aa0a6" }}>
            Back to chat
          </Button>
        </Stack>
      </Box>

      <Box sx={{ width: "100%", maxWidth: 760, px: 2 }}>
        <Stack spacing={2}>
          {cars.map(([label, v, set]) => (
            <Box key={label} sx={{ bgcolor: "#1b1e24", borderRadius: 1, p: 2 }}>
              <Typography variant="body2" sx={{ color: "#9aa0a6", mb: 1 }}>
                {label}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  size="small"
                  placeholder="Make"
                  value={v.make}
                  onChange={(e) => set({ ...v, make: e.target.value })}
                  sx={{ ...fieldSx, flex: 1 }}
                />
                <TextField
                  size="small"
                  placeholder="Model"
                  value={v.model}
                  onChange={(e) => set({ ...v, model: e.target.value })}
                  sx={{ ...fieldSx, flex: 1 }}
                />
                <TextField
                  size="small"
                  placeholder="Year"
                  value={v.year}
                  onChange={(e) => set({ ...v, year: e.target.value })}
                  sx={{ ...fieldSx, width: { sm: 110 } }}
                />
              </Stack>
            </Box>
          ))}

          <Button
            variant="contained"
            onClick={runCompare}
            disabled={loading}
            sx={{ textTransform: "none", alignSelf: "flex-start", px: 3 }}
          >
            {loading ? "Comparing..." : "Compare"}
          </Button>
          {error && <Typography sx={{ color: "#ef5350" }}>{error}</Typography>}
        </Stack>
      </Box>

      {result && (
        <Box sx={{ width: "100%", maxWidth: 760, px: 2, py: 3 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            {result.vehicles.map((s, i) => (
              <Box key={i} sx={{ flex: 1, bgcolor: "#1b1e24", borderRadius: 2, p: 2 }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {s.year} {s.make} {s.model}
                </Typography>
                <Typography variant="body2" sx={{ color: "#9aa0a6", mb: 1 }}>
                  {s.noData ? "No NHTSA complaints on file" : `${s.complaints} recent complaints`}
                  {s.stars ? ` · NCAP ${s.stars}★ overall` : " · NCAP rating n/a"}
                </Typography>
                {!s.noData && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {s.topComponents.map((c) => (
                      <Chip
                        key={c.component}
                        label={`${c.component} · ${c.count}`}
                        size="small"
                        sx={{ bgcolor: "#0f1115", color: "#e8e8e8", mb: 0.5 }}
                      />
                    ))}
                  </Stack>
                )}
              </Box>
            ))}
          </Stack>

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
            {result.verdict}
          </Box>
        </Box>
      )}
    </Box>
  );
}
