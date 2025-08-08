import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash, Download, Upload, Calendar, Play, AlertTriangle, Copy, Filter, Lock } from "lucide-react";
import { format, addDays, parseISO, isAfter } from "date-fns";
import jsPDF from "jspdf";
import "jspdf-autotable";

/**
 * Officina Planner – Demo interattiva (v5)
 *
 * Aggiunte:
 * - Report PDF stampabile del periodo (una pagina per giorno, tabelle per tecnico) – pulsante "Report PDF".
 * - Lock assegnazione: blocco hard di un job a un tecnico (meccanico/elettrauto) dal tab Lavori o dal Piano.
 * - Campo Veicolo/Targa per distinguere job dello stesso cliente.
 * - Affinità cliente→meccanico e continuità già presenti; il lock ha priorità su tutto.
 */

// Helpers
const df = (d: Date) => format(d, "yyyy-MM-dd");
const defaultStart = new Date("2025-08-18");
const defaultEnd = new Date("2025-08-23");

type Tech = { id: string; hours: number };
type Team = { meccanici: Tech[]; elettrauti: Tech[] };

const defaultTeam = (): Team => ({
  meccanici: [
    { id: "M1", hours: 8 },
    { id: "M2", hours: 8 },
    { id: "M3", hours: 8 },
    { id: "M4", hours: 8 },
    { id: "M5", hours: 7 },
  ],
  elettrauti: [
    { id: "E1", hours: 8 },
    { id: "E2", hours: 8 },
    { id: "E3", hours: 6 },
  ],
});

type Job = {
  id: string;
  title: string;
  hours: number;
  deadline: string | null;
  ingress: string | null;
  roles: ("meccanico" | "elettrauto" | "elettrauto_fac")[];
  note: string;
  plate?: string;
  lockedMechanicId?: string | null;
  lockedElectricId?: string | null;
};

const seedJobs: Job[] = [
  ["T.M. - frizione + campagne SW", 6, "2025-08-23", "2025-08-18", ["meccanico", "elettrauto_fac"], "elettrauto solo per scarico SW", "AB123CD"],
  ["Bollettini - AdBlue", 2, "2025-08-25", "2025-08-08", ["elettrauto"], "", ""],
  ["Bollettini - Tagliando", 6, "2025-08-25", "2025-08-08", ["meccanico"], "", ""],
  ["Bollettini - Pompa olio", 5, "2025-08-25", "2025-08-08", ["meccanico"], "", ""],
  ["Azzari - Scatola idroguida (smont.)", 3, "2025-08-22", "2025-08-08", ["meccanico"], "poi rimontaggio 3h dopo 2 giorni", ""],
  ["Azzari - Scatola idroguida (rimont.)", 3, "2025-08-22", "2025-08-20", ["meccanico"], "", ""],
  ["Ceroni 718 - Frizione", 8, "2025-08-22", "2025-08-08", ["meccanico"], "", ""],
  ["Ceroni 718 - Soffietto cabina", 1.5, "2025-08-22", "2025-08-08", ["meccanico"], "", ""],
  ["Ceroni 718 - Tachigrafo", 2, "2025-08-22", "2025-08-08", ["elettrauto"], "", ""],
  ["Autotrasporti FP - Tagliando", 3, "2025-08-25", "2025-08-18", ["meccanico"], "", ""],
  ["Autotrasporti FP - Torpress", 1.5, "2025-08-25", "2025-08-18", ["meccanico"], "", ""],
  ["Autotrasporti FP - Motorino", 2, "2025-08-25", "2025-08-18", ["elettrauto"], "", ""],
  ["Panone - Tagliando + campagna relè", 5, "2025-08-20", "2025-08-18", ["meccanico", "elettrauto_fac"], "", ""],
  ["Panone - Perdita olio + freno motore", 3, "2025-08-20", "2025-08-18", ["meccanico"], "", ""],
  ["Tudini - Ammortizzatori cabina", 1.5, "2025-08-22", "2025-08-11", ["elettrauto"], "", ""],
  ["Tudini - Infiltrazione acqua cabina", 1.5, "2025-08-22", "2025-08-11", ["elettrauto"], "", ""],
  ["Tudini - Tendicinghia", 1.5, "2025-08-22", "2025-08-11", ["elettrauto"], "", ""],
  ["Tudini - Anomalia terzo asse", 1.5, "2025-08-22", "2025-08-11", ["elettrauto"], "", ""],
  ["Tudini - Terminale di scarico", 1.5, "2025-08-22", "2025-08-11", ["elettrauto"], "", ""],
  ["Picena Zinc - Tagliando + campagne SW", 5, "2025-09-01", "2025-08-18", ["meccanico", "elettrauto_fac"], "", ""],
  ["Picena Zinc - Rumore turbina a freddo", 2, "2025-09-01", "2025-08-18", ["meccanico"], "", ""],
  ["Ciccotosto - Tagliando", 3, "2025-08-21", "2025-08-18", ["meccanico"], "", ""],
  ["Ceroni 716 - Pastiglie A/P", 3, "2025-08-22", "2025-08-11", ["meccanico"], "", ""],
  ["Ceroni 716 - Radiatore EGR", 8, "2025-08-22", "2025-08-11", ["meccanico"], "", ""],
  ["Ceroni 716 - Termostato", 2, "2025-08-22", "2025-08-11", ["elettrauto"], "", ""],
  ["VAS - Marmitta + turbina", 14, null, "2025-08-08", ["meccanico"], "ricambi dal 20/08", ""],
  ["A&G - Guarnizioni scarico + radiatore EGR", 10, "2025-08-21", "2025-08-19", ["meccanico"], "", ""],
  ["Tuccitto - Smont. cambio (frizione/perdita olio)", 16, null, "2025-08-08", ["meccanico"], "", ""],
].map(
  ([title, hours, deadline, ingress, roles, note, plate]) =>
    ({
      id: (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)),
      title, hours, deadline, ingress, roles, note,
      plate: plate || "",
      lockedMechanicId: null,
      lockedElectricId: null,
    } as Job)
);

function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

const extractClient = (title: string) => {
  if (!title) return "";
  const i = title.indexOf(" - ");
  return i > -1 ? title.slice(0, i).trim().toLowerCase() : title.trim().toLowerCase();
};

function priority(job: Job, startDate: Date) {
  if (!job.deadline) return 0;
  const daysLeft = Math.max(
    0,
    (parseISO(job.deadline).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(0, 30 - Math.floor(daysLeft));
}

type Alloc = { day: string; role: "Meccanico" | "Elettrauto"; personId: string; jobId: string; hours: number };
type ResidAgg = Record<string, { meccanico: { free: number; total: number }; elettrauto: { free: number; total: number } }>;

function scheduleJobsIndividuals({
  jobs,
  team,
  start,
  end,
  noParallelRoles = true,
  clientAffinity = {},
}: {
  jobs: Job[];
  team: Team;
  start: Date;
  end: Date;
  noParallelRoles?: boolean;
  clientAffinity?: Record<string, string>;
}) {
  const days: string[] = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) days.push(df(d));

  const resid: Record<
    string,
    { meccanici: { id: string; free: number }[]; elettrauti: { id: string; free: number }[] }
  > = Object.fromEntries(
    days.map((day) => [
      day,
      {
        meccanici: team.meccanici.map((m) => ({ id: m.id, free: Number(m.hours) || 0 })),
        elettrauti: team.elettrauti.map((e) => ({ id: e.id, free: Number(e.hours) || 0 })),
      },
    ])
  );

  const ordered = [...jobs].sort((a, b) => {
    const p = priority(b, start) - priority(a, start);
    if (p !== 0) return p;
    const ca = extractClient(a.title),
      cb = extractClient(b.title);
    if (ca !== cb) return ca < cb ? -1 : 1;
    const ia = a.ingress ? parseISO(a.ingress).getTime() : 0;
    const ib = b.ingress ? parseISO(b.ingress).getTime() : 0;
    if (ia !== ib) return ia - ib;
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime();
  });

  const alloc: Alloc[] = [];
  const risks: { jobId: string; title: string; remaining: number }[] = [];
  const jobAssignees: Record<string, { Meccanico?: string; Elettrauto?: string }> = {};

  const pushAlloc = (day: string, role: Alloc["role"], personId: string, jobId: string, hours: number) => {
    if (hours <= 0) return;
    alloc.push({ day, role, personId, jobId, hours: Math.round(hours * 100) / 100 });
  };

  const pickPerson = (arr: { id: string; free: number }[], preferredId: string | null) => {
    if (preferredId) {
      const p = arr.find((x) => x.id === preferredId);
      if (p && p.free > 0) return p;
      return null;
    }
    return arr.slice().sort((a, b) => b.free - a.free)[0] || null;
  };

  for (const j of ordered) {
    let remaining = Number(j.hours) || 0;
    const startDay = df(new Date(Math.max(parseISO(j.ingress || df(start)).getTime(), start.getTime())));
    const deadline = j.deadline
      ? df(new Date(Math.min(parseISO(j.deadline).getTime(), end.getTime())))
      : df(end);
    const client = extractClient(j.title);

    for (let d = new Date(startDay); remaining > 0 && df(d) <= deadline; d = addDays(d, 1)) {
      const dayKey = df(d);
      let workedToday = false;

      // Meccanico – lock > assegnatario job > affinità cliente > max free
      if (j.roles.includes("meccanico")) {
        const mechArr = resid[dayKey].meccanici;
        const locked = j.lockedMechanicId || null;
        const prefJob = jobAssignees[j.id]?.Meccanico || null;
        const prefClient = clientAffinity[client] || null;

        let person = null;
        if (locked) person = pickPerson(mechArr, locked);
        if (!person) person = pickPerson(mechArr, prefJob);
        if (!person) person = pickPerson(mechArr, prefClient);
        if (!person && !locked) person = pickPerson(mechArr, null);

        if (person && person.free > 0) {
          const take = Math.min(person.free, remaining);
          person.free -= take;
          remaining -= take;
          workedToday = true;
          jobAssignees[j.id] = { ...(jobAssignees[j.id] || {}), Meccanico: person.id };
          if (!clientAffinity[client]) clientAffinity[client] = person.id;
          pushAlloc(dayKey, "Meccanico", person.id, j.id, take);
        }
      }

      if (noParallelRoles && workedToday) continue;

      // Elettrauto – lock > assegnatario job > max free
      if (j.roles.includes("elettrauto") || j.roles.includes("elettrauto_fac")) {
        const elecArr = resid[dayKey].elettrauti;
        const locked = j.lockedElectricId || null;
        const prefJob = jobAssignees[j.id]?.Elettrauto || null;

        let person = null;
        if (locked) person = pickPerson(elecArr, locked);
        if (!person) person = pickPerson(elecArr, prefJob);
        if (!person && !locked) person = pickPerson(elecArr, null);

        if (person && person.free > 0) {
          const take = Math.min(person.free, remaining);
          person.free -= take;
          remaining -= take;
          workedToday = true;
          jobAssignees[j.id] = { ...(jobAssignees[j.id] || {}), Elettrauto: person.id };
          pushAlloc(dayKey, "Elettrauto", person.id, j.id, take);
        }
      }
    }

    if (remaining > 0) risks.push({ jobId: j.id, title: j.title, remaining: Math.round(remaining * 100) / 100 });
  }

  const residAgg: ResidAgg = Object.fromEntries(
    days.map((day) => {
      const mTot = team.meccanici.reduce((s, x) => s + (Number(x.hours) || 0), 0);
      const eTot = team.elettrauti.reduce((s, x) => s + (Number(x.hours) || 0), 0);
      const mFree = (resid[day].meccanici || []).reduce((s, x) => s + x.free, 0);
      const eFree = (resid[day].elettrauti || []).reduce((s, x) => s + x.free, 0);
      return [day, { meccanico: { free: mFree, total: mTot }, elettrauto: { free: eFree, total: eTot } }];
    })
  ) as ResidAgg;

  return { alloc, residAgg, risks, clientAffinity };
}

export default function OfficinaPlannerApp() {
  const [periodStart, setPeriodStart] = useLocalStorage("op:start", df(defaultStart));
  const [periodEnd, setPeriodEnd] = useLocalStorage("op:end", df(defaultEnd));
  const [jobs, setJobs] = useLocalStorage<Job[]>("op:jobs", seedJobs);
  const [team, setTeam] = useLocalStorage<Team>("op:team", defaultTeam());
  const [clientAffinity, setClientAffinity] = useLocalStorage<Record<string, string>>("op:affinity", {});
  const [result, setResult] = useState<{ alloc: Alloc[]; residAgg: ResidAgg; risks: any[]; clientAffinity: Record<string,string> }>({ alloc: [], residAgg: {} as ResidAgg, risks: [], clientAffinity: {} });
  const [clientFilter, setClientFilter] = useState("__ALL__");
  const [shiftDeadlines, setShiftDeadlines] = useState(false);

  const start = useMemo(() => parseISO(periodStart), [periodStart]);
  const end = useMemo(() => parseISO(periodEnd), [periodEnd]);

  const run = () => {
    const filtered = jobs.filter((j) => {
      const ing = parseISO(j.ingress || periodStart);
      if (isAfter(ing, end)) return false;
      if (clientFilter !== "__ALL__" && extractClient(j.title) !== clientFilter.toLowerCase()) return false;
      return true;
    });
    const out = scheduleJobsIndividuals({
      jobs: filtered,
      team,
      start,
      end,
      noParallelRoles: true,
      clientAffinity: { ...clientAffinity },
    });
    setClientAffinity(out.clientAffinity);
    setResult(out);
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodStart, periodEnd, clientFilter, team, jobs]);

  const jobsById = useMemo(() => Object.fromEntries(jobs.map((j) => [j.id, j])) as Record<string, Job>, [jobs]);
  const days = useMemo(() => {
    const arr: string[] = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) arr.push(df(d));
    return arr;
  }, [start, end]);

  const clients = useMemo(() => {
    const set = new Set(jobs.map((j) => extractClient(j.title)));
    return ["__ALL__", ...Array.from(set).sort()];
  }, [jobs]);

  const grouped = useMemo(() => {
    const g: Record<string, { Meccanico: Record<string, Alloc[]>; Elettrauto: Record<string, Alloc[]> }> = Object.fromEntries(
      days.map((d) => [d, { Meccanico: {}, Elettrauto: {} }])
    ) as any;
    for (const a of result.alloc) {
      const roleKey = a.role; // "Meccanico" | "Elettrauto"
      g[a.day][roleKey][a.personId] = g[a.day][roleKey][a.personId] || [];
      g[a.day][roleKey][a.personId].push(a);
    }
    return g;
  }, [result.alloc, days]);

  const dupWeek = () => {
    const ns = df(addDays(parseISO(periodStart), 7));
    const ne = df(addDays(parseISO(periodEnd), 7));
    setPeriodStart(ns);
    setPeriodEnd(ne);
    if (shiftDeadlines) {
      setJobs(jobs.map((j) => (j.deadline ? { ...j, deadline: df(addDays(parseISO(j.deadline), 7)) } : j)));
    }
  };

  const reassignJob = (allocItem: Alloc, newPersonId: string, lockToo = false) => {
    const job = jobsById[allocItem.jobId];
    if (!job) return;
    const client = extractClient(job.title);
    if (allocItem.role === "Meccanico") {
      const newAff = { ...clientAffinity, [client]: newPersonId };
      setClientAffinity(newAff);
      if (lockToo) {
        const updated = jobs.map((j) => (j.id === job.id ? { ...j, lockedMechanicId: newPersonId } : j));
        setJobs(updated);
      }
    } else if (allocItem.role === "Elettrauto" && lockToo) {
      const updated = jobs.map((j) => (j.id === job.id ? { ...j, lockedElectricId: newPersonId } : j));
      setJobs(updated);
    }
    setTimeout(run, 0);
  };

  const lockToCurrent = (allocItem: Alloc) => {
    reassignJob(allocItem, allocItem.personId, true);
  };

  const makePdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const title = `Piano Officina ${periodStart} → ${periodEnd}`;
    doc.text(title, 14, 12);

    days.forEach((day, idx) => {
      if (idx > 0) doc.addPage();
      doc.setFontSize(12);
      doc.text(day, 14, 18);

      const makeTable = (roleKey: "Meccanico" | "Elettrauto") => {
        const rows: (string | number)[][] = [];
        const per = (grouped as any)[day]?.[roleKey] || {};
        Object.entries(per).forEach(([pid, arr]) => {
          (arr as Alloc[]).forEach((a) => {
            const j = jobsById[a.jobId];
            rows.push([pid, j ? j.title : a.jobId, j?.plate || "", a.hours]);
          });
        });
        if (!rows.length) rows.push(["—", "(nessuna attività)", "", "0"]);
        (doc as any).autoTable({
          startY: (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 6 : 24,
          head: [[`${roleKey}`, "Lavoro", "Veicolo/Targa", "Ore"]],
          body: rows,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [230, 230, 230] },
          theme: "grid",
          margin: { left: 14, right: 14 },
        });
      };

      makeTable("Meccanico");
      makeTable("Elettrauto");
    });

    doc.save(`Piano_Officina_${periodStart}_${periodEnd}.pdf`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Officina Planner – Demo</h1>
          <p className="text-sm text-muted-foreground">
            Tecnici identificati, continuità, affinità cliente→meccanico, lock e PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={run} className="gap-2">
            <Play className="w-4 h-4" /> Pianifica
          </Button>
          <Button onClick={dupWeek} variant="outline" className="gap-2">
            <Copy className="w-4 h-4" /> Duplica settimana
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={shiftDeadlines}
              onChange={(e) => setShiftDeadlines(e.target.checked)}
            />{" "}
            sposta anche le scadenze (+7)
          </label>
          <Button onClick={makePdf} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Report PDF
          </Button>
          <Button
            onClick={() => {
              const b = new Blob(
                [JSON.stringify({ periodStart, periodEnd, jobs, team, clientAffinity }, null, 2)],
                { type: "application/json" }
              );
              const u = URL.createObjectURL(b);
              const a = document.createElement("a");
              a.href = u;
              a.download = `officina_planner_${periodStart}_${periodEnd}.json`;
              a.click();
              URL.revokeObjectURL(u);
            }}
            variant="outline"
            className="gap-2"
          >
            <Download className="w-4 h-4" /> Esporta
          </Button>
          <div className="relative">
            <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" /> Importa JSON
            </Button>
            <input
              title="Importa"
              type="file"
              accept="application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => {
                  try {
                    const data = JSON.parse(String(r.result));
                    if (data.periodStart) setPeriodStart(data.periodStart);
                    if (data.periodEnd) setPeriodEnd(data.periodEnd);
                    if (Array.isArray(data.jobs)) setJobs(data.jobs);
                    if (data.team) setTeam(data.team);
                    if (data.clientAffinity) setClientAffinity(data.clientAffinity);
                  } catch {
                    alert("File non valido");
                  }
                };
                r.readAsText(f);
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2 flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filtro cliente
          </CardTitle>
          <div className="w-64">
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "__ALL__" ? "Tutti i clienti" : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Periodo & Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Inizio</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fine</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Ore tot. Meccanici</Label>
              <Input readOnly value={team.meccanici.reduce((s, x) => s + (Number(x.hours) || 0), 0)} />
            </div>
            <div className="space-y-1">
              <Label>Ore tot. Elettrauti</Label>
              <Input readOnly value={team.elettrauti.reduce((s, x) => s + (Number(x.hours) || 0), 0)} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="font-semibold mb-2">Meccanici</div>
              {team.meccanici.map((m, idx) => (
                <div key={m.id} className="flex items-center gap-2 mb-2">
                  <Input
                    className="w-24"
                    value={m.id}
                    onChange={(e) => {
                      const v = { ...team };
                      v.meccanici[idx] = { ...m, id: e.target.value };
                      setTeam(v);
                    }}
                  />
                  <Input
                    type="number"
                    className="w-28"
                    min={0}
                    value={m.hours}
                    onChange={(e) => {
                      const v = { ...team };
                      v.meccanici[idx] = { ...m, hours: Number(e.target.value) };
                      setTeam(v);
                    }}
                  />
                </div>
              ))}
            </div>
            <div>
              <div className="font-semibold mb-2">Elettrauti</div>
              {team.elettrauti.map((m, idx) => (
                <div key={m.id} className="flex items-center gap-2 mb-2">
                  <Input
                    className="w-24"
                    value={m.id}
                    onChange={(e) => {
                      const v = { ...team };
                      v.elettrauti[idx] = { ...m, id: e.target.value };
                      setTeam(v);
                    }}
                  />
                  <Input
                    type="number"
                    className="w-28"
                    min={0}
                    value={m.hours}
                    onChange={(e) => {
                      const v = { ...team };
                      v.elettrauti[idx] = { ...m, hours: Number(e.target.value) };
                      setTeam(v);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Lavori</TabsTrigger>
          <TabsTrigger value="plan">Piano giornaliero</TabsTrigger>
          <TabsTrigger value="resid">Ore residue</TabsTrigger>
        </TabsList>
        <TabsContent value="jobs">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle>Lavori pianificabili</CardTitle>
              <Button
                onClick={() =>
                  setJobs([
                    {
                      id: (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string,
                      title: "Nuovo lavoro",
                      hours: 1,
                      deadline: df(end),
                      ingress: df(start),
                      roles: ["meccanico"],
                      note: "",
                      plate: "",
                      lockedMechanicId: null,
                      lockedElectricId: null,
                    },
                    ...jobs,
                  ])
                }
                className="gap-2"
              >
                <Plus className="w-4 h-4" /> Aggiungi lavoro
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {jobs.map((j, idx) => (
                <div key={j.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 rounded-2xl border">
                  <Input
                    className="md:col-span-3"
                    value={j.title}
                    onChange={(e) => {
                      const v = [...jobs];
                      v[idx] = { ...j, title: e.target.value };
                      setJobs(v);
                    }}
                  />
                  <Input
                    className="md:col-span-1"
                    type="number"
                    step="0.5"
                    min={0}
                    value={j.hours}
                    onChange={(e) => {
                      const v = [...jobs];
                      v[idx] = { ...j, hours: Number(e.target.value) };
                      setJobs(v);
                    }}
                  />
                  <Input
                    className="md:col-span-2"
                    type="date"
                    value={j.deadline || ""}
                    onChange={(e) => {
                      const v = [...jobs];
                      v[idx] = { ...j, deadline: e.target.value || null };
                      setJobs(v);
                    }}
                  />
                  <Input
                    className="md:col-span-2"
                    type="date"
                    value={j.ingress || ""}
                    onChange={(e) => {
                      const v = [...jobs];
                      v[idx] = { ...j, ingress: e.target.value || null };
                      setJobs(v);
                    }}
                  />
                  <Select
                    value={j.roles.join(",")}
                    onValueChange={(val) => {
                      const arr = val.split(",").filter(Boolean) as Job["roles"];
                      const v = [...jobs];
                      v[idx] = { ...j, roles: arr };
                      setJobs(v);
                    }}
                  >
                    <SelectTrigger className="md:col-span-2">
                      <SelectValue placeholder="Ruoli" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meccanico">meccanico</SelectItem>
                      <SelectItem value="elettrauto">elettrauto</SelectItem>
                      <SelectItem value="meccanico,elettrauto">meccanico + elettrauto</SelectItem>
                      <SelectItem value="meccanico,elettrauto_fac">meccanico + elettrauto (facolt.)</SelectItem>
                      <SelectItem value="elettrauto_fac">elettrauto (facolt.)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="md:col-span-2"
                    placeholder="Veicolo/Targa"
                    value={j.plate || ""}
                    onChange={(e) => {
                      const v = [...jobs];
                      v[idx] = { ...j, plate: e.target.value };
                      setJobs(v);
                    }}
                  />
                  <Select
                    value={j.lockedMechanicId || ""}
                    onValueChange={(val) => {
                      const v = [...jobs];
                      v[idx] = { ...j, lockedMechanicId: val || null };
                      setJobs(v);
                    }}
                  >
                    <SelectTrigger className="md:col-span-1">
                      <SelectValue placeholder="Blocca M" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {team.meccanici.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={j.lockedElectricId || ""}
                    onValueChange={(val) => {
                      const v = [...jobs];
                      v[idx] = { ...j, lockedElectricId: val || null };
                      setJobs(v);
                    }}
                  >
                    <SelectTrigger className="md:col-span-1">
                      <SelectValue placeholder="Blocca E" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {team.elettrauti.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="md:col-span-12">
                    <Textarea
                      placeholder="Note"
                      value={j.note}
                      onChange={(e) => {
                        const v = [...jobs];
                        v[idx] = { ...j, note: e.target.value };
                        setJobs(v);
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan">
          <div className="grid md:grid-cols-2 gap-4">
            {days.map((day) => {
              const agg = result.residAgg?.[day];
              const mFreePct = agg ? agg.meccanico.free / (agg.meccanico.total || 1) : 1;
              const eFreePct = agg ? agg.elettrauto.free / (agg.elettrauto.total || 1) : 1;
              const low = mFreePct < 0.1 || eFreePct < 0.1;
              return (
                <Card key={day} className={low ? "border-yellow-500" : ""}>
                  <CardHeader className="pb-2 flex items-center justify-between">
                    <CardTitle className="text-base">{day}</CardTitle>
                    {low && <span className="text-xs px-2 py-1 rounded-full bg-yellow-100">Capacità quasi piena</span>}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm font-semibold">Meccanici</div>
                      {Object.entries((result as any).alloc ? (grouped as any)[day]?.Meccanico || {} : {}).length ? (
                        <ul className="list-disc ml-5 space-y-1">
                          {Object.entries((grouped as any)[day].Meccanico).map(([pid, arr]: [string, Alloc[]]) => (
                            <li key={pid}>
                              <span className="font-mono">{pid}</span>:{" "}
                              {arr.map((a) => (
                                <span key={`${a.jobId}-${a.day}-${a.role}`} className="inline-flex items-center gap-2 mr-2">
                                  {jobsById[a.jobId]?.title}
                                  {jobsById[a.jobId]?.plate ? ` [${jobsById[a.jobId]?.plate}]` : ""} (
                                  <span className="font-mono">{a.hours}h</span>)
                                  <Select onValueChange={(val) => reassignJob(a, val, false)}>
                                    <SelectTrigger className="h-7 w-24">
                                      <SelectValue placeholder={pid} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {team.meccanici.map((m) => (
                                        <SelectItem key={m.id} value={m.id}>
                                          {m.id}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-7 w-7"
                                    title="Blocca su questo tecnico"
                                    onClick={() => lockToCurrent(a)}
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                  </Button>
                                </span>
                              ))}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="italic text-muted-foreground">—</div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Elettrauti</div>
                      {Object.entries((grouped as any)[day]?.Elettrauto || {}).length ? (
                        <ul className="list-disc ml-5 space-y-1">
                          {Object.entries((grouped as any)[day].Elettrauto).map(([pid, arr]: [string, Alloc[]]) => (
                            <li key={pid}>
                              <span className="font-mono">{pid}</span>:{" "}
                              {arr.map((a) => (
                                <span key={`${a.jobId}-${a.day}-${a.role}`} className="inline-flex items-center gap-2 mr-2">
                                  {jobsById[a.jobId]?.title}
                                  {jobsById[a.jobId]?.plate ? ` [${jobsById[a.jobId]?.plate}]` : ""} (
                                  <span className="font-mono">{a.hours}h</span>)
                                  <Select onValueChange={(val) => reassignJob(a, val, false)}>
                                    <SelectTrigger className="h-7 w-24">
                                      <SelectValue placeholder={pid} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {team.elettrauti.map((e) => (
                                        <SelectItem key={e.id} value={e.id}>
                                          {e.id}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-7 w-7"
                                    title="Blocca su questo tecnico"
                                    onClick={() => lockToCurrent(a)}
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                  </Button>
                                </span>
                              ))}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="italic text-muted-foreground">—</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="resid">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Ore residue per giorno</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              {days.map((day) => {
                const agg = result.residAgg?.[day] as any;
                if (!agg)
                  return (
                    <div key={day} className="rounded-2xl border p-3">
                      {day}
                    </div>
                  );
                const mFree = agg.meccanico.free,
                  mTot = agg.meccanico.total;
                const eFree = agg.elettrauto.free,
                  eTot = agg.elettrauto.total;
                const mPct = mTot ? Math.round((mFree / mTot) * 100) : 100;
                const ePct = eTot ? Math.round((eFree / eTot) * 100) : 100;
                return (
                  <div key={day} className="rounded-2xl border p-3">
                    <div className="text-sm font-semibold mb-1">{day}</div>
                    <div className="text-sm">
                      Meccanico: {mFree}h libere su {mTot}h ({mPct}%)
                    </div>
                    <div className="text-sm">
                      Elettrauto: {eFree}h libere su {eTot}h ({ePct}%)
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {result.risks?.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <CardTitle>Alert scadenze a rischio</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc ml-6">
              {result.risks.map((r) => (
                <li key={r.jobId}>
                  <span className="font-medium">{r.title}</span>: restano{" "}
                  <span className="font-mono">{r.remaining}h</span> non allocate entro il periodo/scadenza.
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Note & Limitazioni</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Lock ha priorità su continuità e affinità. La riassegnazione dal piano può anche bloccare (icona lucchetto).</p>
          <p>• Nessun parallelismo nello stesso giorno tra meccanico ed elettrauto sullo stesso job.</p>
          <p>• Ordinamento: priorità (scadenza) → cliente → ingresso → scadenza.</p>
          <p>• Dati in <span className="font-mono">localStorage</span>, esportabili in JSON.</p>
        </CardContent>
      </Card>
    </div>
  );
}
