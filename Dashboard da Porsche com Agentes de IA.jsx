import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, ResponsiveContainer, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";
import {
  TrendingUp, Package, Wrench, Megaphone, Radar, Circle, ChevronRight,
  Clock, X,
} from "lucide-react";

// ---------- helpers ----------
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const randWalk = (last, vol, min, max) =>
  clamp(Math.round(last + (Math.random() - 0.48) * vol), min, max);

const makeHistory = (base, n = 20, vol = 4, min = 0, max = 999) => {
  const arr = [base];
  for (let i = 1; i < n; i++) arr.push(randWalk(arr[i - 1], vol, min, max));
  return arr;
};

function fmtClock(d) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// ---------- agent definitions ----------
const AGENT_DEFS = [
  {
    id: "vendas",
    name: "Vendas",
    Icon: TrendingUp,
    metricLabel: "Veículos vendidos (mês)",
    base: 34,
    vol: 3,
    min: 18,
    max: 60,
    templates: [
      (n) => `Aumento de ${n}% em test-drives do 911 Carrera nesta semana.`,
      () => `Taycan lidera conversão de leads qualificados no funil.`,
      (n) => `Ticket médio subiu para R$ ${420 + n} mil no segmento Cayenne.`,
      () => `3 propostas de Panamera aguardando aprovação de crédito.`,
    ],
  },
  {
    id: "estoque",
    name: "Estoque",
    Icon: Package,
    metricLabel: "Unidades em pátio",
    base: 58,
    vol: 4,
    min: 30,
    max: 90,
    templates: [
      (n) => `Macan elétrico com giro de estoque ${n}% mais rápido que a média.`,
      () => `Alerta: apenas 2 unidades de 718 Cayman GT4 disponíveis.`,
      (n) => `Tempo médio no pátio caiu para ${18 - (n % 6)} dias.`,
      () => `Recomendo reposição de Cayenne Coupé para o próximo trimestre.`,
    ],
  },
  {
    id: "posvenda",
    name: "Pós-venda",
    Icon: Wrench,
    metricLabel: "Agendamentos hoje",
    base: 12,
    vol: 2,
    min: 4,
    max: 25,
    templates: [
      () => `Pico de agendamentos de revisão dos 30.000 km detectado.`,
      () => `Peça em falta: pastilha de freio dianteira (911 Turbo).`,
      (n) => `Satisfação pós-serviço em ${90 + (n % 9)}% nesta semana.`,
      () => `2 recalls pendentes de agendamento identificados.`,
    ],
  },
  {
    id: "marketing",
    name: "Marketing & Leads",
    Icon: Megaphone,
    metricLabel: "Leads qualificados",
    base: 21,
    vol: 3,
    min: 8,
    max: 45,
    templates: [
      (n) => `Campanha "Taycan Turbo GT" com CTR ${n}% acima da média.`,
      () => `Lead score médio subiu após test-drive experience.`,
      (n) => `Instagram gerou ${n} leads novos nas últimas 24h.`,
      () => `Recomendo pausar anúncio de baixo desempenho em Meta Ads.`,
    ],
  },
  {
    id: "mercado",
    name: "Inteligência de Mercado",
    Icon: Radar,
    metricLabel: "Concorrentes monitorados",
    base: 6,
    vol: 1,
    min: 3,
    max: 10,
    templates: [
      (n) => `Concorrente reduziu preço do Cayenne em ${n}%.`,
      () => `Novo SUV elétrico premium lançado na região.`,
      (n) => `Demanda por elétricos premium cresce ${n}% no trimestre.`,
      () => `Nenhuma mudança relevante de preço nas últimas 24h.`,
    ],
  },
];

function statusFromConfidence(c) {
  if (c >= 85) return { label: "Operando", color: "#4CAF6D" };
  if (c >= 60) return { label: "Atenção", color: "#E0A72E" };
  return { label: "Alerta", color: "#D5001C" };
}

// ---------- semicircle gauge (signature element) ----------
function PerformanceGauge({ value }) {
  const size = 190;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 180;
  const endAngle = 0;
  const pct = clamp(value, 0, 100) / 100;
  const angle = startAngle - pct * (startAngle - endAngle);

  const polar = (angleDeg, radius) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy - radius * Math.sin(rad) };
  };

  const arcPath = (a1, a2, radius) => {
    const p1 = polar(a1, radius);
    const p2 = polar(a2, radius);
    const largeArc = Math.abs(a1 - a2) > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
  };

  const ticks = Array.from({ length: 11 }, (_, i) => 180 - i * 18);

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`}>
        <path d={arcPath(180, 0, r)} fill="none" stroke="#2A2A2E" strokeWidth={stroke} strokeLinecap="round" />
        <path
          d={arcPath(180, angle, r)}
          fill="none"
          stroke="#C9A968"
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ transition: "d 0.8s ease" }}
        />
        {ticks.map((t, i) => {
          const p1 = polar(t, r - stroke / 2 - 3);
          const p2 = polar(t, r - stroke / 2 - 9);
          return (
            <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#54545a" strokeWidth={1.5} />
          );
        })}
        <circle cx={cx} cy={cy} r={4} fill="#C9A968" />
      </svg>
      <div className="absolute bottom-1 flex flex-col items-center">
        <span
          className="text-4xl font-bold tabular-nums"
          style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#F5F3EE" }}
        >
          {Math.round(value)}
        </span>
        <span
          className="text-[10px] tracking-[0.25em] uppercase mt-0.5"
          style={{ color: "#9A9A9E" }}
        >
          Índice de Confiança
        </span>
      </div>
    </div>
  );
}

// ---------- sparkline ----------
function Sparkline({ data, color }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.6}
          fill={`url(#grad-${color.replace("#", "")})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------- KPI dial (hero strip item) ----------
function Dial({ label, value, suffix }) {
  return (
    <div className="flex flex-col items-center px-6 py-4 flex-1 min-w-[140px]">
      <span
        className="text-3xl sm:text-4xl font-bold tabular-nums"
        style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#F5F3EE" }}
      >
        {value}
        {suffix && <span className="text-lg ml-1" style={{ color: "#C9A968" }}>{suffix}</span>}
      </span>
      <span
        className="text-[10px] tracking-[0.2em] uppercase mt-1 text-center"
        style={{ color: "#9A9A9E" }}
      >
        {label}
      </span>
    </div>
  );
}

// ---------- main component ----------
export default function PorscheAIDashboard() {
  const [now, setNow] = useState(new Date());
  const [agents, setAgents] = useState(() =>
    AGENT_DEFS.map((def) => {
      const history = makeHistory(def.base, 20, def.vol, def.min, def.max);
      const confidence = Math.round(70 + Math.random() * 25);
      return {
        ...def,
        history,
        value: history[history.length - 1],
        confidence,
      };
    })
  );
  const [feed, setFeed] = useState(() => {
    const initial = [];
    const d = new Date();
    AGENT_DEFS.slice(0, 3).forEach((def, idx) => {
      const t = def.templates[idx % def.templates.length];
      initial.push({
        id: `init-${def.id}`,
        agentId: def.id,
        agentName: def.name,
        text: t(Math.round(5 + Math.random() * 15)),
        time: fmtClock(new Date(d.getTime() - idx * 60000)),
      });
    });
    return initial;
  });
  const [selectedId, setSelectedId] = useState(null);
  const counterRef = useRef(0);

  useEffect(() => {
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      setAgents((prev) =>
        prev.map((a) => {
          const nextVal = randWalk(a.value, a.vol, a.min, a.max);
          const history = [...a.history.slice(1), nextVal];
          const confidence = clamp(
            Math.round(a.confidence + (Math.random() - 0.5) * 8),
            40,
            99
          );
          return { ...a, value: nextVal, history, confidence };
        })
      );

      // occasionally push a new feed entry
      if (Math.random() < 0.65) {
        const def = AGENT_DEFS[Math.floor(Math.random() * AGENT_DEFS.length)];
        const t = def.templates[Math.floor(Math.random() * def.templates.length)];
        counterRef.current += 1;
        setFeed((prev) => {
          const entry = {
            id: `f-${counterRef.current}-${Date.now()}`,
            agentId: def.id,
            agentName: def.name,
            text: t(Math.round(3 + Math.random() * 20)),
            time: fmtClock(new Date()),
          };
          return [entry, ...prev].slice(0, 30);
        });
      }
    }, 3200);
    return () => clearInterval(tick);
  }, []);

  const avgConfidence = useMemo(
    () => agents.reduce((s, a) => s + a.confidence, 0) / agents.length,
    [agents]
  );
  const criticalCount = useMemo(
    () => agents.filter((a) => a.confidence < 60).length,
    [agents]
  );
  const selected = agents.find((a) => a.id === selectedId);
  const selectedFeed = selected
    ? feed.filter((f) => f.agentId === selected.id).slice(0, 8)
    : [];

  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor: "#0B0B0C", color: "#F5F3EE" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
        .porsche-font-display { font-family: 'Barlow Condensed', sans-serif; }
        .porsche-font-body { font-family: 'Inter', sans-serif; }
        .porsche-font-mono { font-family: 'IBM Plex Mono', monospace; }
        .pulse-dot { animation: pulseDot 2.2s ease-in-out infinite; }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .agent-card { transition: border-color 0.25s ease, transform 0.25s ease; }
        .agent-card:hover { border-color: #54545a; transform: translateY(-2px); }
        .feed-scroll::-webkit-scrollbar { width: 6px; }
        .feed-scroll::-webkit-scrollbar-thumb { background: #2A2A2E; border-radius: 3px; }
        @media (prefers-reduced-motion: reduce) {
          .pulse-dot { animation: none; }
          .agent-card:hover { transform: none; }
        }
      `}</style>

      {/* Header */}
      <header
        className="flex flex-wrap items-center justify-between px-6 sm:px-10 py-5 border-b"
        style={{ borderColor: "#1F1F22" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center border"
            style={{ borderColor: "#C9A968" }}
          >
            <span className="text-xs font-bold" style={{ color: "#C9A968" }}>P</span>
          </div>
          <div>
            <h1 className="porsche-font-display text-2xl tracking-[0.08em] uppercase leading-none">
              Porsche <span style={{ color: "#C9A968" }}>Intelligence</span>
            </h1>
            <p className="porsche-font-body text-xs mt-0.5" style={{ color: "#9A9A9E" }}>
              Centro de Inteligência — Agentes de IA em operação
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 porsche-font-mono text-sm mt-3 sm:mt-0">
          <span style={{ color: "#9A9A9E" }}>{fmtDate(now)}</span>
          <span className="flex items-center gap-1.5" style={{ color: "#F5F3EE" }}>
            <Clock size={14} style={{ color: "#C9A968" }} /> {fmtClock(now)}
          </span>
        </div>
      </header>

      {/* Hero instrument strip */}
      <section
        className="flex flex-wrap items-center divide-x px-4 sm:px-10 py-2"
        style={{ borderBottom: "1px solid #1F1F22", divideColor: "#1F1F22" }}
      >
        <div className="flex flex-1 min-w-[260px] justify-center py-2">
          <PerformanceGauge value={avgConfidence} />
        </div>
        <div className="flex flex-1 flex-wrap divide-x" style={{ divideColor: "#1F1F22" }}>
          <Dial label="Agentes ativos" value={agents.length} />
          <Dial label="Insights nesta sessão" value={feed.length} />
          <Dial
            label="Alertas críticos"
            value={criticalCount}
            suffix={criticalCount > 0 ? "!" : ""}
          />
          <Dial label="Confiança média" value={Math.round(avgConfidence)} suffix="%" />
        </div>
      </section>

      {/* Agent grid + feed */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6 sm:px-10 py-8">
        {/* Agent cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {agents.map((a) => {
            const status = statusFromConfidence(a.confidence);
            const latestInsight = feed.find((f) => f.agentId === a.id);
            const Icon = a.Icon;
            return (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className="agent-card text-left rounded-xl border p-4 flex flex-col gap-3"
                style={{ backgroundColor: "#141416", borderColor: "#232326" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={16} style={{ color: "#C9A968" }} />
                    <span className="porsche-font-display uppercase tracking-[0.08em] text-sm">
                      {a.name}
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5">
                    <Circle
                      size={8}
                      className="pulse-dot"
                      style={{ fill: status.color, color: status.color }}
                    />
                    <span
                      className="porsche-font-mono text-[10px] uppercase tracking-wide"
                      style={{ color: status.color }}
                    >
                      {status.label}
                    </span>
                  </span>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <div
                      className="porsche-font-mono text-2xl font-semibold tabular-nums"
                      style={{ color: "#F5F3EE" }}
                    >
                      {a.value}
                    </div>
                    <div className="porsche-font-body text-[11px]" style={{ color: "#9A9A9E" }}>
                      {a.metricLabel}
                    </div>
                  </div>
                  <div className="w-28">
                    <Sparkline data={a.history} color="#C9A968" />
                  </div>
                </div>

                {latestInsight && (
                  <p
                    className="porsche-font-body text-xs leading-snug border-t pt-2"
                    style={{ color: "#C7C6C2", borderColor: "#1F1F22" }}
                  >
                    {latestInsight.text}
                  </p>
                )}

                <div
                  className="flex items-center justify-between porsche-font-body text-[11px]"
                  style={{ color: "#6f6f74" }}
                >
                  <span>Confiança: {a.confidence}%</span>
                  <span className="flex items-center gap-0.5">
                    Ver detalhes <ChevronRight size={12} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Live feed */}
        <div
          className="rounded-xl border flex flex-col overflow-hidden"
          style={{ backgroundColor: "#141416", borderColor: "#232326", maxHeight: 560 }}
        >
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: "#1F1F22" }}
          >
            <span className="porsche-font-display uppercase tracking-[0.1em] text-sm">
              Transmissão dos agentes
            </span>
            <Circle size={7} className="pulse-dot" style={{ fill: "#4CAF6D", color: "#4CAF6D" }} />
          </div>
          <div className="feed-scroll overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {feed.map((f) => (
              <div key={f.id} className="flex gap-2">
                <span
                  className="porsche-font-mono text-[10px] mt-0.5 shrink-0"
                  style={{ color: "#6f6f74" }}
                >
                  {f.time}
                </span>
                <p className="porsche-font-body text-xs leading-snug">
                  <span style={{ color: "#C9A968" }}>{f.agentName}:</span>{" "}
                  <span style={{ color: "#C7C6C2" }}>{f.text}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Detail panel */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 py-6"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setSelectedId(null)}
        >
          <div
            className="w-full max-w-xl rounded-xl border p-6"
            style={{ backgroundColor: "#141416", borderColor: "#232326" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <selected.Icon size={18} style={{ color: "#C9A968" }} />
                <h2 className="porsche-font-display uppercase tracking-[0.08em] text-lg">
                  {selected.name}
                </h2>
              </div>
              <button onClick={() => setSelectedId(null)} aria-label="Fechar">
                <X size={18} style={{ color: "#9A9A9E" }} />
              </button>
            </div>

            <div className="flex items-center gap-6 mb-4">
              <div>
                <div
                  className="porsche-font-mono text-3xl font-semibold"
                  style={{ color: "#F5F3EE" }}
                >
                  {selected.value}
                </div>
                <div className="porsche-font-body text-xs" style={{ color: "#9A9A9E" }}>
                  {selected.metricLabel}
                </div>
              </div>
              <div>
                <div
                  className="porsche-font-mono text-3xl font-semibold"
                  style={{ color: statusFromConfidence(selected.confidence).color }}
                >
                  {selected.confidence}%
                </div>
                <div className="porsche-font-body text-xs" style={{ color: "#9A9A9E" }}>
                  Confiança do agente
                </div>
              </div>
            </div>

            <div className="h-40 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selected.history.map((v, i) => ({ i, v }))}>
                  <CartesianGrid stroke="#1F1