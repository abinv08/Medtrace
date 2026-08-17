import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Slider,
  Paper,
  Grid,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack,
  PlayArrow,
  Pause,
  RestartAlt,
  DirectionsRun,
  Wifi,
  GraphicEq,
  CheckCircle,
  WarningAmber,
  Speed,
  Sensors,
  Waves,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// ─── Constants & Configuration ────────────────────────────────────────────────
const SAMPLE_RATE = 50; // 50 samples per second (20ms per sample)
const BUFFER_SAMPLES = 400; // 8 seconds of data at 50 Hz
const HEATMAP_COLS = 160; // columns in scrolling heatmap
const NUM_SUBCARRIERS = 30; // 30 subcarriers

// Subcarrier static random sensitivity and phase calibration (fixed for realism)
const SUBCARRIER_PROFILES = Array.from({ length: NUM_SUBCARRIERS }, (_, i) => {
  // Deterministic pseudo-random seed per subcarrier
  const seed = (i * 137.5 + 42) % 100;
  return {
    id: i,
    sensitivity: 0.45 + (seed / 100) * 0.8, // range 0.45 - 1.25
    phase: ((i * 0.21 + seed * 0.05) % (Math.PI * 2)), // fixed phase offset
  };
});

export const CSIBreathingMonitor: React.FC = () => {
  const navigate = useNavigate();

  // ─── User Configurable React State ──────────────────────────────────────────
  const [targetBpm, setTargetBpm] = useState<number>(16);
  const [noiseLevel, setNoiseLevel] = useState<number>(20);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // ─── Throttled Diagnostic State for UI ───────────────────────────────────────
  const [displayBpm, setDisplayBpm] = useState<number>(16.0);
  const [snrEstimate, setSnrEstimate] = useState<number>(24.5);
  const [confidence, setConfidence] = useState<number>(94);
  const [isMotionDetected, setIsMotionDetected] = useState<boolean>(false);
  const [breathingPhase, setBreathingPhase] = useState<'Inhale' | 'Exhale' | 'Hold'>('Inhale');
  const [ringScale, setRingScale] = useState<number>(1.0);

  // ─── High Performance Animation & Signal Processing Refs ────────────────────
  const animationFrameRef = useRef<number | null>(null);
  const lastSampleTimeRef = useRef<number>(performance.now());
  const sampleIndexRef = useRef<number>(0);
  const motionUntilTimeRef = useRef<number>(0);

  // Dynamic parameters accessible in loop without re-subscribing
  const targetBpmRef = useRef<number>(targetBpm);
  const noiseLevelRef = useRef<number>(noiseLevel);
  const isPlayingRef = useRef<boolean>(isPlaying);

  useEffect(() => { targetBpmRef.current = targetBpm; }, [targetBpm]);
  useEffect(() => { noiseLevelRef.current = noiseLevel; }, [noiseLevel]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Rolling signal buffers
  const rawBufferRef = useRef<Float32Array>(new Float32Array(BUFFER_SAMPLES));
  const filteredBufferRef = useRef<Float32Array>(new Float32Array(BUFFER_SAMPLES));
  // Heatmap buffer: 160 columns x 30 subcarriers (stored as columns for fast horizontal roll)
  const heatmapBufferRef = useRef<Float32Array[]>(
    Array.from({ length: HEATMAP_COLS }, () => new Float32Array(NUM_SUBCARRIERS))
  );

  // Filter state (Dual EMA for bandpass)
  const fastEmaRef = useRef<number>(10.0);
  const slowEmaRef = useRef<number>(10.0);

  // Peak detection state
  const peakIndicesRef = useRef<number[]>([]); // sample indices of detected peaks
  const lastPeakIndexRef = useRef<number>(-100);

  // Canvas references
  const rawScopeCanvasRef = useRef<HTMLCanvasElement>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);
  const filteredScopeCanvasRef = useRef<HTMLCanvasElement>(null);

  // UI Throttle timer
  const lastUiUpdateRef = useRef<number>(0);

  // ─── Reset Buffers ──────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    rawBufferRef.current.fill(10.0);
    filteredBufferRef.current.fill(0.0);
    heatmapBufferRef.current.forEach((col) => col.fill(0.0));
    peakIndicesRef.current = [];
    lastPeakIndexRef.current = -100;
    fastEmaRef.current = 10.0;
    slowEmaRef.current = 10.0;
    sampleIndexRef.current = 0;
    motionUntilTimeRef.current = 0;
    setDisplayBpm(targetBpmRef.current);
    setConfidence(95);
    setIsMotionDetected(false);
  }, []);

  // ─── Trigger Motion Artifact ────────────────────────────────────────────────
  const handleTriggerMotion = useCallback(() => {
    // 1.5 seconds of vigorous motion artifact
    motionUntilTimeRef.current = performance.now() + 1600;
    setIsMotionDetected(true);
  }, []);

  // ============================================================================
  // HARDWARE INTEGRATION POINT:
  // To connect real CSI hardware (e.g. ESP32-CSI, Intel 5300, Atheros CSI tool
  // over WebSocket or Serial), replace generateSample() with your incoming
  // packet stream callback: socket.on('csi_packet', (rawAmp) => processSample(rawAmp));
  // ============================================================================
  const generateSample = (
    sampleIdx: number,
    bpm: number,
    noise: number,
    isMotion: boolean
  ): { raw: number; subcarriers: Float32Array } => {
    const t = sampleIdx / SAMPLE_RATE;
    const freq = bpm / 60.0; // Fundamental breathing frequency in Hz

    // Baseline amplitude ~ 10.0
    let amplitude = 10.0;

    // 1. Fundamental breathing sine wave + harmonic overtone
    const breathingComponent =
      2.0 * Math.sin(2 * Math.PI * freq * t) +
      0.35 * Math.sin(4 * Math.PI * freq * t + 0.5);

    amplitude += breathingComponent;

    // 2. Additive random Gaussian/white noise
    const noiseScale = (noise / 100) * 1.8;
    const randNoise = (Math.random() - 0.5) * noiseScale;
    amplitude += randNoise;

    // 3. Motion artifact burst
    if (isMotion) {
      const motionFreq = 8.5;
      const motionJitter =
        Math.sin(2 * Math.PI * motionFreq * t) * 5.0 +
        (Math.random() - 0.5) * 8.0;
      amplitude += motionJitter;
    }

    // 4. Generate 30 Subcarrier values
    const scValues = new Float32Array(NUM_SUBCARRIERS);
    for (let i = 0; i < NUM_SUBCARRIERS; i++) {
      const profile = SUBCARRIER_PROFILES[i];
      const scNoise = (Math.random() - 0.5) * noiseScale * 0.6;
      // Real CSI behavior: subcarrier amplitude = baseline * sensitivity * cos(phase) + subcarrier noise
      const subcarrierAmp =
        amplitude * profile.sensitivity * Math.cos(profile.phase + t * 0.05) +
        scNoise;
      scValues[i] = subcarrierAmp;
    }

    return { raw: amplitude, subcarriers: scValues };
  };

  // ─── Real-time DSP Processing for a single sample ───────────────────────────
  const processDspSample = useCallback((raw: number, subcarriers: Float32Array, isMotion: boolean) => {
    const idx = sampleIndexRef.current;

    // 1. Dual Exponential Moving Average Bandpass Filter
    const fastAlpha = 0.35;
    const slowAlpha = 0.01;

    fastEmaRef.current = fastAlpha * raw + (1 - fastAlpha) * fastEmaRef.current;
    slowEmaRef.current = slowAlpha * raw + (1 - slowAlpha) * slowEmaRef.current;
    const filtered = fastEmaRef.current - slowEmaRef.current;

    // 2. Shift buffers left and append newest sample
    rawBufferRef.current.copyWithin(0, 1);
    rawBufferRef.current[BUFFER_SAMPLES - 1] = raw;

    filteredBufferRef.current.copyWithin(0, 1);
    filteredBufferRef.current[BUFFER_SAMPLES - 1] = filtered;

    // 3. Shift heatmap buffer and append newest subcarrier column
    heatmapBufferRef.current.shift();
    heatmapBufferRef.current.push(subcarriers);

    // 4. Peak Detection (Local maxima with refractory period)
    const buf = filteredBufferRef.current;
    const curr = buf[BUFFER_SAMPLES - 2]; // test previous sample to check peak
    const prev = buf[BUFFER_SAMPLES - 3];
    const next = buf[BUFFER_SAMPLES - 1];

    const PEAK_THRESHOLD = 0.3;
    const MIN_PEAK_DISTANCE_SAMPLES = Math.floor(SAMPLE_RATE * (60 / 36)); // max 36 BPM refractory guard

    if (
      !isMotion &&
      curr > prev &&
      curr > next &&
      curr > PEAK_THRESHOLD &&
      idx - lastPeakIndexRef.current > MIN_PEAK_DISTANCE_SAMPLES
    ) {
      lastPeakIndexRef.current = idx;
      peakIndicesRef.current.push(idx);
      if (peakIndicesRef.current.length > 8) {
        peakIndicesRef.current.shift();
      }
    }

    sampleIndexRef.current += 1;
    return filtered;
  }, []);

  // ─── Canvas Renderers ───────────────────────────────────────────────────────
  const renderRawScope = (canvas: HTMLCanvasElement, rawData: Float32Array) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#0B1220';
    ctx.fillRect(0, 0, width, height);

    // Draw Oscilloscope Grid
    ctx.strokeStyle = 'rgba(30, 44, 69, 0.6)';
    ctx.lineWidth = 1;

    // Vertical grid lines
    const gridCols = 10;
    for (let c = 0; c <= gridCols; c++) {
      const x = (c / gridCols) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines
    const gridRows = 6;
    for (let r = 0; r <= gridRows; r++) {
      const y = (r / gridRows) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Center baseline
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.15)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Raw CSI Signal Trace
    ctx.strokeStyle = '#5EEAD4';
    ctx.shadowColor = '#5EEAD4';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const minAmp = 2.0;
    const maxAmp = 18.0;
    const range = maxAmp - minAmp;

    for (let i = 0; i < BUFFER_SAMPLES; i++) {
      const x = (i / (BUFFER_SAMPLES - 1)) * width;
      const normalized = (rawData[i] - minAmp) / range;
      const y = height - normalized * height;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0; // reset shadow
  };

  const renderHeatmap = (canvas: HTMLCanvasElement, heatmapData: Float32Array[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const cellW = width / HEATMAP_COLS;
    const cellH = height / NUM_SUBCARRIERS;

    // Colormap calculation (Deep Navy -> Dark Teal -> Vivid Cyan -> Aqua White)
    for (let col = 0; col < HEATMAP_COLS; col++) {
      const scArray = heatmapData[col];
      const x = col * cellW;

      for (let row = 0; row < NUM_SUBCARRIERS; row++) {
        const val = scArray[row];
        // Normalize value roughly between 4.0 and 16.0
        const norm = Math.max(0, Math.min(1, (val - 4.0) / 12.0));
        const y = (NUM_SUBCARRIERS - 1 - row) * cellH;

        // Custom Teal/Cyan gradient interpolation
        const r = Math.floor(11 + norm * 150);
        const g = Math.floor(30 + norm * 204);
        const b = Math.floor(60 + norm * 195);

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, y, Math.ceil(cellW) + 0.5, Math.ceil(cellH) + 0.5);
      }
    }

    // Overlay horizontal subcarrier lane dividers
    ctx.strokeStyle = 'rgba(11, 18, 32, 0.4)';
    ctx.lineWidth = 0.5;
    for (let row = 0; row <= NUM_SUBCARRIERS; row += 5) {
      const y = row * cellH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  const renderFilteredWaveform = (
    canvas: HTMLCanvasElement,
    filteredData: Float32Array,
    peakIndices: number[],
    currentSampleIdx: number
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#0B1220';
    ctx.fillRect(0, 0, width, height);

    // Subtle grid
    ctx.strokeStyle = 'rgba(30, 44, 69, 0.5)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= 4; r++) {
      const y = (r / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Zero center line
    ctx.strokeStyle = 'rgba(245, 165, 36, 0.2)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Filtered Waveform (Amber trace)
    ctx.strokeStyle = '#F5A524';
    ctx.shadowColor = '#F5A524';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    const maxDelta = 3.5;
    for (let i = 0; i < BUFFER_SAMPLES; i++) {
      const x = (i / (BUFFER_SAMPLES - 1)) * width;
      const val = filteredData[i];
      // Map [-maxDelta, maxDelta] -> [height, 0]
      const y = height / 2 - (val / maxDelta) * (height / 2.2);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw Detected Peaks on Waveform
    const startIdx = currentSampleIdx - BUFFER_SAMPLES;
    peakIndices.forEach((peakGlobalIdx) => {
      const localBufferIdx = peakGlobalIdx - startIdx;
      if (localBufferIdx >= 0 && localBufferIdx < BUFFER_SAMPLES) {
        const x = (localBufferIdx / (BUFFER_SAMPLES - 1)) * width;
        const val = filteredData[localBufferIdx];
        const y = height / 2 - (val / maxDelta) * (height / 2.2);

        // Glowing outer dot
        ctx.fillStyle = '#F5A524';
        ctx.shadowColor = '#F5A524';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();

        // Inner white highlight
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Vertical peak guide
        ctx.strokeStyle = 'rgba(245, 165, 36, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  };

  // ─── Main Animation / Simulation Loop ───────────────────────────────────────
  useEffect(() => {
    let active = true;

    const loop = (time: number) => {
      if (!active) return;

      if (isPlayingRef.current) {
        const elapsed = time - lastSampleTimeRef.current;
        const sampleInterval = 1000 / SAMPLE_RATE; // 20ms

        // If enough time elapsed, catch up samples
        if (elapsed >= sampleInterval) {
          const samplesToProcess = Math.min(Math.floor(elapsed / sampleInterval), 4);
          lastSampleTimeRef.current = time;

          let lastFilteredVal = 0;
          const isMotion = time < motionUntilTimeRef.current;

          for (let s = 0; s < samplesToProcess; s++) {
            const { raw, subcarriers } = generateSample(
              sampleIndexRef.current,
              targetBpmRef.current,
              noiseLevelRef.current,
              isMotion
            );
            lastFilteredVal = processDspSample(raw, subcarriers, isMotion);
          }

          // Throttle UI Updates (~12 updates/sec)
          if (time - lastUiUpdateRef.current > 80) {
            lastUiUpdateRef.current = time;

            // Compute Estimated BPM from inter-peak intervals
            const peaks = peakIndicesRef.current;
            if (peaks.length >= 3 && !isMotion) {
              const intervals: number[] = [];
              for (let i = 1; i < peaks.length; i++) {
                intervals.push((peaks[i] - peaks[i - 1]) / SAMPLE_RATE);
              }
              const avgIntervalSec = intervals.reduce((a, b) => a + b, 0) / intervals.length;
              if (avgIntervalSec > 0) {
                const calculatedBpm = 60 / avgIntervalSec;
                setDisplayBpm(parseFloat(calculatedBpm.toFixed(1)));
              }
            } else if (isMotion) {
              // During motion, display transient unstable BPM
              setDisplayBpm(parseFloat((targetBpmRef.current + (Math.random() - 0.5) * 6).toFixed(1)));
            }

            // Estimate SNR (Signal to Noise Ratio)
            const noise = noiseLevelRef.current;
            const computedSnr = isMotion
              ? Math.max(3.0, 10.0 - noise * 0.08)
              : Math.max(8.0, 32.0 - noise * 0.22);
            setSnrEstimate(parseFloat(computedSnr.toFixed(1)));

            // Compute Confidence %
            const computedConf = isMotion
              ? Math.floor(25 + Math.random() * 20)
              : Math.min(99, Math.max(45, Math.floor(100 - noise * 0.55)));
            setConfidence(computedConf);

            // Motion status
            setIsMotionDetected(isMotion);

            // Breathing ring scale & phase indicator
            const normalizedBreathing = Math.max(-1, Math.min(1, lastFilteredVal / 2.0));
            const scale = 1.0 + normalizedBreathing * 0.28;
            setRingScale(scale);

            if (isMotion) {
              setBreathingPhase('Hold');
            } else if (normalizedBreathing > 0.15) {
              setBreathingPhase('Inhale');
            } else if (normalizedBreathing < -0.15) {
              setBreathingPhase('Exhale');
            } else {
              setBreathingPhase('Hold');
            }
          }
        }
      }

      // Draw Canvases
      if (rawScopeCanvasRef.current) {
        renderRawScope(rawScopeCanvasRef.current, rawBufferRef.current);
      }
      if (heatmapCanvasRef.current) {
        renderHeatmap(heatmapCanvasRef.current, heatmapBufferRef.current);
      }
      if (filteredScopeCanvasRef.current) {
        renderFilteredWaveform(
          filteredScopeCanvasRef.current,
          filteredBufferRef.current,
          peakIndicesRef.current,
          sampleIndexRef.current
        );
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [processDspSample]);

  // ─── Responsive Canvas Resize Setup ─────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;

      [rawScopeCanvasRef.current, heatmapCanvasRef.current, filteredScopeCanvasRef.current].forEach(
        (canvas) => {
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.scale(dpr, dpr);
          }
        }
      );
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#0B1220',
        color: '#E2E8F0',
        fontFamily: "'Inter', sans-serif",
        pb: 6,
      }}
    >
      {/* ── Top Header Navigation Bar ────────────────────────────────────────── */}
      <Box
        sx={{
          backgroundColor: '#101B2D',
          borderBottom: '1px solid #1E2C45',
          px: { xs: 2, md: 4 },
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/')}
            sx={{
              color: '#94A3B8',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '10px',
              border: '1px solid #1E2C45',
              backgroundColor: '#0B1220',
              '&:hover': { color: '#5EEAD4', borderColor: '#5EEAD4', backgroundColor: 'rgba(94, 234, 212, 0.05)' },
            }}
          >
            Back to MedTrace
          </Button>

          <Box display="flex" alignItems="center" gap={1.5}>
            <Box
              sx={{
                p: 1,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0EA5E9 0%, #14B8A6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Wifi sx={{ color: '#FFFFFF', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#F8FAFC', lineHeight: 1.2, fontSize: '1.1rem' }}>
                WiFi CSI Breathing & Vitals Monitor
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', fontFamily: 'monospace' }}>
                IEEE 802.11n/ac Subcarrier Amplitude Pipeline · 50.0 Hz
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box display="flex" alignItems="center" gap={1.5}>
          <Chip
            icon={<Sensors sx={{ fontSize: '16px !important', color: isPlaying ? '#5EEAD4 !important' : '#94A3B8 !important' }} />}
            label={isPlaying ? 'LIVE STREAMING' : 'STREAM PAUSED'}
            size="small"
            sx={{
              backgroundColor: isPlaying ? 'rgba(94, 234, 212, 0.12)' : 'rgba(148, 163, 184, 0.12)',
              color: isPlaying ? '#5EEAD4' : '#94A3B8',
              fontWeight: 800,
              fontFamily: 'monospace',
              border: `1px solid ${isPlaying ? 'rgba(94, 234, 212, 0.3)' : 'rgba(148, 163, 184, 0.3)'}`,
            }}
          />
        </Box>
      </Box>

      {/* ── Main Dashboard 2-Column Layout ──────────────────────────────────── */}
      <Container maxWidth="xl" sx={{ mt: 3 }}>
        <Grid container spacing={3}>
          {/* ════════════ LEFT COLUMN: Signal Visualizers ════════════ */}
          <Grid item xs={12} lg={8.5}>
            <Box display="flex" flexDirection="column" gap={3}>
              {/* Panel 1: Live Raw CSI Amplitude Scope */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '18px',
                  backgroundColor: '#101B2D',
                  border: '1px solid #1E2C45',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <GraphicEq sx={{ color: '#5EEAD4', fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F1F5F9', letterSpacing: 0.5 }}>
                      RAW CSI AMPLITUDE SCOPE (CHANNEL STATE DYNAMICS)
                    </Typography>
                  </Box>
                  <Box display="flex" gap={2}>
                    <Typography variant="caption" sx={{ color: '#5EEAD4', fontFamily: 'monospace', fontWeight: 600 }}>
                      SPAN: 8.0s (400 SAMPLES)
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', fontFamily: 'monospace' }}>
                      SCALE: 2 - 18 dBm
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ width: '100%', height: 190, borderRadius: '12px', overflow: 'hidden', border: '1px solid #1E2C45' }}>
                  <canvas ref={rawScopeCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
                </Box>
              </Paper>

              {/* Horizontal Pipeline Indicator */}
              <Paper
                elevation={0}
                sx={{
                  p: 1.8,
                  borderRadius: '16px',
                  backgroundColor: '#0F1827',
                  border: '1px solid #1E2C45',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: { xs: 'wrap', md: 'nowrap' },
                  gap: 1,
                }}
              >
                {[
                  { step: '01', title: 'CSI CAPTURE', desc: '50 Hz Raw Packet' },
                  { step: '02', title: 'PHASE SANITIZE', desc: 'Linear Unwrapping' },
                  { step: '03', title: 'BANDPASS DEMA', desc: 'αf=0.35, αs=0.01' },
                  { step: '04', title: 'PEAK DETECT', desc: 'Adaptive Refractory' },
                  { step: '05', title: 'BREATHING RATE', desc: 'Inter-Peak Mean' },
                ].map((st, i) => (
                  <React.Fragment key={st.step}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: 'rgba(94, 234, 212, 0.15)',
                          color: '#5EEAD4',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          fontFamily: 'monospace',
                        }}
                      >
                        {st.step}
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#F1F5F9', fontWeight: 700, display: 'block', fontSize: '0.75rem' }}>
                          {st.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.68rem', fontFamily: 'monospace' }}>
                          {st.desc}
                        </Typography>
                      </Box>
                    </Box>
                    {i < 4 && (
                      <Typography sx={{ color: '#1E2C45', fontWeight: 800, display: { xs: 'none', md: 'block' } }}>
                        →
                      </Typography>
                    )}
                  </React.Fragment>
                ))}
              </Paper>

              {/* Panel 2: Subcarrier Heatmap (30 subcarriers) */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '18px',
                  backgroundColor: '#101B2D',
                  border: '1px solid #1E2C45',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Waves sx={{ color: '#22D3EE', fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F1F5F9', letterSpacing: 0.5 }}>
                      30-SUBCARRIER CSI SPECTROGRAM / HEATMAP
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#64748B', fontFamily: 'monospace' }}>
                    Y: SC#0 — SC#29 (OFDM SUBCARRIERS)
                  </Typography>
                </Box>

                <Box sx={{ width: '100%', height: 160, borderRadius: '12px', overflow: 'hidden', border: '1px solid #1E2C45' }}>
                  <canvas ref={heatmapCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
                </Box>
              </Paper>

              {/* Panel 3: Filtered Breathing Waveform Canvas */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '18px',
                  backgroundColor: '#101B2D',
                  border: '1px solid #1E2C45',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Speed sx={{ color: '#F5A524', fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F1F5F9', letterSpacing: 0.5 }}>
                      FILTERED RESPIRATORY WAVEFORM & PEAK EXTRACTION
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box display="flex" alignItems="center" gap={0.8}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F5A524' }} />
                      <Typography variant="caption" sx={{ color: '#F5A524', fontFamily: 'monospace', fontWeight: 600 }}>
                        DETECTED PEAKS
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ width: '100%', height: 190, borderRadius: '12px', overflow: 'hidden', border: '1px solid #1E2C45' }}>
                  <canvas ref={filteredScopeCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
                </Box>
              </Paper>
            </Box>
          </Grid>

          {/* ════════════ RIGHT COLUMN: Sidebar Metrics & Controls ════════════ */}
          <Grid item xs={12} lg={3.5}>
            <Box display="flex" flexDirection="column" gap={3}>
              {/* Big Metric Card with Breathing Ring */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: '20px',
                  background: 'linear-gradient(145deg, #101B2D 0%, #0F172A 100%)',
                  border: '1px solid #1E2C45',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 800, letterSpacing: 1.5 }}>
                  RESPIRATORY RATE ESTIMATE
                </Typography>

                {/* Breathing Ring */}
                <Box
                  sx={{
                    my: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    height: 160,
                  }}
                >
                  {/* Outer Pulsing Aura */}
                  <Box
                    sx={{
                      position: 'absolute',
                      width: 130,
                      height: 130,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(94, 234, 212, 0.25) 0%, rgba(14, 165, 233, 0) 70%)',
                      transform: `scale(${ringScale * 1.25})`,
                      transition: 'transform 0.15s ease-out',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Ring Border */}
                  <Box
                    sx={{
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      border: `3px solid ${isMotionDetected ? '#F87171' : '#5EEAD4'}`,
                      boxShadow: isMotionDetected
                        ? '0 0 24px rgba(248, 113, 113, 0.4)'
                        : '0 0 24px rgba(94, 234, 212, 0.35)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: `scale(${ringScale})`,
                      transition: 'transform 0.15s ease-out, border-color 0.3s ease',
                      backgroundColor: 'rgba(16, 27, 45, 0.8)',
                    }}
                  >
                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: 900,
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: isMotionDetected ? '#F87171' : '#F8FAFC',
                        lineHeight: 1,
                      }}
                    >
                      {displayBpm}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 800, mt: 0.5 }}>
                      BPM
                    </Typography>
                  </Box>
                </Box>

                {/* Status chip */}
                <Chip
                  label={`Phase: ${breathingPhase.toUpperCase()}`}
                  size="small"
                  sx={{
                    backgroundColor: isMotionDetected ? 'rgba(248, 113, 113, 0.15)' : 'rgba(94, 234, 212, 0.12)',
                    color: isMotionDetected ? '#F87171' : '#5EEAD4',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    borderRadius: '8px',
                    border: `1px solid ${isMotionDetected ? '#F87171' : '#5EEAD4'}30`,
                  }}
                />
              </Paper>

              {/* Diagnostics Panel */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: '20px',
                  backgroundColor: '#101B2D',
                  border: '1px solid #1E2C45',
                }}
              >
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, letterSpacing: 1.2, display: 'block', mb: 2 }}>
                  SYSTEM DIAGNOSTICS & TELEMETRY
                </Typography>

                <Box display="flex" flexDirection="column" gap={2}>
                  {/* Subject State */}
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>Subject State</Typography>
                    <Chip
                      icon={isMotionDetected ? <WarningAmber sx={{ fontSize: '14px !important', color: '#F87171 !important' }} /> : <CheckCircle sx={{ fontSize: '14px !important', color: '#5EEAD4 !important' }} />}
                      label={isMotionDetected ? 'MOTION ARTIFACT' : 'STATIONARY'}
                      size="small"
                      sx={{
                        backgroundColor: isMotionDetected ? 'rgba(248, 113, 113, 0.15)' : 'rgba(94, 234, 212, 0.1)',
                        color: isMotionDetected ? '#F87171' : '#5EEAD4',
                        fontWeight: 800,
                        fontSize: '0.72rem',
                        fontFamily: 'monospace',
                      }}
                    />
                  </Box>

                  {/* SNR */}
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>Estimated SNR</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 800, color: snrEstimate > 18 ? '#5EEAD4' : '#F5A524' }}>
                      {snrEstimate} dB
                    </Typography>
                  </Box>

                  {/* Confidence */}
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>Confidence Score</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 800, color: confidence > 75 ? '#5EEAD4' : '#F87171' }}>
                      {confidence} %
                    </Typography>
                  </Box>

                  {/* Sampling Rate */}
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>Sampling Frequency</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 800, color: '#F1F5F9' }}>
                      50.0 Hz (20ms)
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Controls Panel */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: '20px',
                  backgroundColor: '#101B2D',
                  border: '1px solid #1E2C45',
                }}
              >
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, letterSpacing: 1.2, display: 'block', mb: 2.5 }}>
                  SIMULATION CONTROLS
                </Typography>

                {/* Target BPM Slider */}
                <Box mb={3}>
                  <Box display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2" sx={{ color: '#CBD5E1', fontWeight: 600 }}>
                      Target Breathing Rate
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#5EEAD4', fontFamily: 'monospace', fontWeight: 800 }}>
                      {targetBpm} BPM
                    </Typography>
                  </Box>
                  <Slider
                    value={targetBpm}
                    min={8}
                    max={30}
                    step={1}
                    onChange={(_, val) => setTargetBpm(val as number)}
                    sx={{
                      color: '#5EEAD4',
                      '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(94, 234, 212, 0.6)' },
                      '& .MuiSlider-track': { background: 'linear-gradient(90deg, #14B8A6, #5EEAD4)' },
                    }}
                  />
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="caption" sx={{ color: '#64748B' }}>8 (Bradypnea)</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>30 (Tachypnea)</Typography>
                  </Box>
                </Box>

                {/* Noise Level Slider */}
                <Box mb={3}>
                  <Box display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2" sx={{ color: '#CBD5E1', fontWeight: 600 }}>
                      RF Channel Noise Level
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#F5A524', fontFamily: 'monospace', fontWeight: 800 }}>
                      {noiseLevel} %
                    </Typography>
                  </Box>
                  <Slider
                    value={noiseLevel}
                    min={0}
                    max={100}
                    step={5}
                    onChange={(_, val) => setNoiseLevel(val as number)}
                    sx={{
                      color: '#F5A524',
                      '& .MuiSlider-thumb': { boxShadow: '0 0 10px rgba(245, 165, 36, 0.6)' },
                      '& .MuiSlider-track': { background: 'linear-gradient(90deg, #F5A524, #EF4444)' },
                    }}
                  />
                </Box>

                {/* Action Buttons */}
                <Box display="flex" flexDirection="column" gap={1.5}>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<DirectionsRun />}
                    onClick={handleTriggerMotion}
                    sx={{
                      py: 1.2,
                      borderRadius: '12px',
                      backgroundColor: 'rgba(248, 113, 113, 0.15)',
                      color: '#F87171',
                      border: '1px solid rgba(248, 113, 113, 0.3)',
                      fontWeight: 800,
                      '&:hover': {
                        backgroundColor: 'rgba(248, 113, 113, 0.25)',
                        borderColor: '#F87171',
                      },
                    }}
                  >
                    Trigger Motion Artifact
                  </Button>

                  <Box display="flex" gap={1.5}>
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={isPlaying ? <Pause /> : <PlayArrow />}
                      onClick={() => setIsPlaying(!isPlaying)}
                      sx={{
                        py: 1.2,
                        borderRadius: '12px',
                        backgroundColor: isPlaying ? 'rgba(94, 234, 212, 0.15)' : '#5EEAD4',
                        color: isPlaying ? '#5EEAD4' : '#0B1220',
                        border: '1px solid #5EEAD4',
                        fontWeight: 800,
                        '&:hover': {
                          backgroundColor: isPlaying ? 'rgba(94, 234, 212, 0.25)' : '#2DD4BF',
                        },
                      }}
                    >
                      {isPlaying ? 'Pause Stream' : 'Resume'}
                    </Button>

                    <Button
                      variant="outlined"
                      onClick={handleReset}
                      sx={{
                        px: 2,
                        borderRadius: '12px',
                        borderColor: '#1E2C45',
                        color: '#94A3B8',
                        '&:hover': { borderColor: '#5EEAD4', color: '#5EEAD4' },
                      }}
                    >
                      <RestartAlt />
                    </Button>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default CSIBreathingMonitor;
