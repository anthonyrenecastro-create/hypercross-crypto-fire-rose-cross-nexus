import React, { useState, useEffect } from "react";
import { Coins, Plus, ArrowUpRight, Flame, RefreshCw, Shield, X, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Asset {
  name: string;
  symbol: string;
  supply: string;
  type: string;
  channel: string;
  status: string;
}

interface IssuanceForm {
  name: string;
  symbol: string;
  supply: string;
  type: string;
  channel: string;
  subAccount: string;
}

type ActionKind = "transfer" | "burn" | "sync";

interface ActionModal {
  kind: ActionKind;
  asset: Asset;
}

const DESKTOP_ORG_ID = "local-desktop-org";

function normalizeAssets(data: any[]): Asset[] {
  return Array.isArray(data)
    ? data.map((asset: any) => ({
        name: asset.name || asset.symbol || "Unknown",
        symbol: asset.symbol || asset.name || "???",
        supply: asset.supply?.toString() || "0",
        type: asset.type || "Fungible",
        channel: asset.channel || "default-channel",
        status: asset.status || "Active",
      }))
    : [];
}

function getFallbackAssets(): Asset[] {
  return [
    { name: "HyperToken", symbol: "HXT", supply: "10000000", type: "Fungible", channel: "default-channel", status: "Demo" },
    { name: "NexusBond", symbol: "NXB", supply: "500000", type: "Fungible", channel: "default-channel", status: "Demo" },
  ];
}

export default function DigitalAssetsPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<IssuanceForm>({
    name: "",
    symbol: "",
    supply: "",
    type: "Fungible",
    channel: "",
    subAccount: "",
  });
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<ActionModal | null>(null);
  const [transferTo, setTransferTo] = useState("");
  const [actionAmount, setActionAmount] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncingRow, setSyncingRow] = useState<string | null>(null);

  const isElectron = typeof window !== "undefined" && typeof window.electron?.dbGetAssets === "function";

  useEffect(() => {
    let cancelled = false;

    const fetchAssets = async () => {
      try {
        setLoading(true);

        if (isElectron) {
          const desktopAssets = await window.electron!.dbGetAssets(DESKTOP_ORG_ID);
          if (!cancelled) {
            setAssets(normalizeAssets(desktopAssets as any[]));
            setError(null);
          }
          return;
        }

        const response = await fetch("/api/live/assets?channel=default-channel");
        if (!response.ok) {
          const details = await response.text().catch(() => "");
          throw new Error(`HTTP ${response.status}${details ? `: ${details.slice(0, 180)}` : ""}`);
        }

        const data = await response.json();
        if (!cancelled) {
          setAssets(normalizeAssets(data));
          setError(null);
        }
      } catch (err) {
        console.error("Error fetching assets:", err);
        if (!cancelled) {
          setAssets((current) => (current.length > 0 ? current : getFallbackAssets()));
          setError(
            isElectron
              ? "Desktop asset service unavailable. Showing cached/demo assets."
              : "Backend API unavailable. Start the app server with npm run dev (or npm run dev:electron). Showing cached/demo assets."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAssets();
    if (isElectron) return () => { cancelled = true; };
    const interval = setInterval(fetchAssets, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isElectron]);

  const handleIssue = async () => {
    setIssuing(true);
    try {
      if (isElectron) {
        const created = await window.electron!.dbCreateAsset({
          name: form.name,
          symbol: form.symbol,
          supply: form.supply,
          type: form.type,
          channel: form.channel || "default-channel",
          orgId: DESKTOP_ORG_ID,
          chaincode: "assets",
          externalId: form.subAccount || null,
          status: "Active",
        });
        setAssets((current) => [normalizeAssets([created])[0], ...current]);
      } else {
        throw new Error("On-chain asset issuance is not configured for the web application.");
      }

      setError(null);
      setIssued(true);
      setShowForm(false);
      setForm({ name: "", symbol: "", supply: "", type: "Fungible", channel: "", subAccount: "" });
      setTimeout(() => setIssued(false), 3000);
    } catch (err) {
      console.error("Error issuing asset:", err);
      setError(err instanceof Error ? err.message : "Failed to issue asset.");
    } finally {
      setIssuing(false);
    }
  };

  const openModal = (kind: ActionKind, asset: Asset) => {
    setModal({ kind, asset });
    setTransferTo("");
    setActionAmount("");
    setActionResult(null);
  };

  const closeModal = () => {
    setModal(null);
    setActionResult(null);
    setTransferTo("");
    setActionAmount("");
  };

  const handleTransfer = async () => {
    if (!modal) return;
    const { asset } = modal;
    if (!transferTo.trim()) {
      setActionResult({ ok: false, message: "Recipient address is required." });
      return;
    }
    if (!actionAmount || isNaN(Number(actionAmount)) || Number(actionAmount) <= 0) {
      setActionResult({ ok: false, message: "Enter a valid positive amount." });
      return;
    }

    setActionBusy(true);
    setActionResult(null);
    try {
      const res = await fetch(`/api/live/assets/${encodeURIComponent(asset.symbol)}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: transferTo.trim(), amount: actionAmount, channel: asset.channel }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setActionResult({ ok: true, message: data.message || `Transferred ${actionAmount} ${asset.symbol} to ${transferTo}` });
      } else {
        setActionResult({ ok: false, message: data.error || "Transfer failed." });
      }
    } catch {
      setActionResult({ ok: false, message: "Network error. Could not reach server." });
    } finally {
      setActionBusy(false);
    }
  };

  const handleBurn = async () => {
    if (!modal) return;
    const { asset } = modal;
    if (!actionAmount || isNaN(Number(actionAmount)) || Number(actionAmount) <= 0) {
      setActionResult({ ok: false, message: "Enter a valid positive amount to burn." });
      return;
    }

    setActionBusy(true);
    setActionResult(null);
    try {
      const res = await fetch(`/api/live/assets/${encodeURIComponent(asset.symbol)}/burn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: actionAmount, channel: asset.channel }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        const burned = Number(actionAmount);
        setAssets((prev) => prev.map((a) =>
          a.symbol === asset.symbol
            ? { ...a, supply: Math.max(0, Number(a.supply) - burned).toString() }
            : a
        ));
        setActionResult({ ok: true, message: data.message || `Burned ${actionAmount} ${asset.symbol} from supply` });
      } else {
        setActionResult({ ok: false, message: data.error || "Burn failed." });
      }
    } catch {
      setActionResult({ ok: false, message: "Network error. Could not reach server." });
    } finally {
      setActionBusy(false);
    }
  };

  const handleSync = async (asset: Asset) => {
    setSyncingRow(asset.symbol);
    try {
      const res = await fetch(`/api/live/assets/${encodeURIComponent(asset.symbol)}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: asset.channel }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.asset) {
        const newSupply = data.asset?.supply?.toString();
        if (newSupply) {
          setAssets((prev) => prev.map((a) =>
            a.symbol === asset.symbol ? { ...a, supply: newSupply } : a
          ));
        }
      }
    } catch {
      // Non-fatal: sync is best-effort
    } finally {
      setSyncingRow(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {modal?.kind === "transfer" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e0e11] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-blue-400" />
                Transfer {modal.asset.symbol}
              </h3>
              <button onClick={closeModal} className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-white/50 text-sm">Send tokens from the {modal.asset.name} supply to another address.</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-white/70">Recipient Address</Label>
                <Input
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  placeholder="0x... or account ID"
                  className="bg-black/50 border-white/10 text-white font-mono text-sm"
                  disabled={actionBusy}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-black/50 border-white/10 text-white"
                  disabled={actionBusy}
                />
                <p className="text-xs text-white/35">Available supply: {modal.asset.supply}</p>
              </div>
            </div>
            {actionResult && (
              <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${actionResult.ok ? "bg-green-500/10 border border-green-500/30 text-green-300" : "bg-red-500/10 border border-red-500/30 text-red-300"}`}>
                {actionResult.ok && <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
                {actionResult.message}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={actionBusy || !transferTo.trim() || !actionAmount}
                onClick={handleTransfer}
              >
                {actionBusy ? <span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />Sending…</span> : "Confirm Transfer"}
              </Button>
              <Button variant="outline" className="border-white/20 text-white/70" onClick={closeModal} disabled={actionBusy}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {modal?.kind === "burn" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e0e11] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Flame className="h-5 w-5 text-red-400" />
                Burn {modal.asset.symbol}
              </h3>
              <button onClick={closeModal} className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              ⚠ Burning is irreversible. These tokens will be permanently removed from the total supply.
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Amount to Burn</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={actionAmount}
                onChange={(e) => setActionAmount(e.target.value)}
                placeholder="0.00"
                className="bg-black/50 border-white/10 text-white"
                disabled={actionBusy}
              />
              <p className="text-xs text-white/35">Current supply: {modal.asset.supply}</p>
            </div>
            {actionResult && (
              <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${actionResult.ok ? "bg-green-500/10 border border-green-500/30 text-green-300" : "bg-red-500/10 border border-red-500/30 text-red-300"}`}>
                {actionResult.ok && <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
                {actionResult.message}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={actionBusy || !actionAmount}
                onClick={handleBurn}
              >
                {actionBusy ? <span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />Burning…</span> : "Confirm Burn"}
              </Button>
              <Button variant="outline" className="border-white/20 text-white/70" onClick={closeModal} disabled={actionBusy}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Coins className="h-6 w-6 text-[#ffae00]" />
            Digital Asset Issuance
          </h2>
          <p className="text-white/50 mt-1 text-sm">
            Issue fungible tokens and non-fungible assets directly on your blockchain network. Each asset is backed by a blockchain-aware data source and configurable deployment metadata.
          </p>
        </div>
        <Button
          onClick={() => setShowForm((s) => !s)}
          className="bg-gradient-to-r from-[#ffae00] to-[#ff6600] hover:opacity-90 text-black font-semibold border-0 shadow-[0_0_15px_rgba(255,174,0,0.3)]"
        >
          <Plus className="h-4 w-4 mr-2" /> Issue Asset
        </Button>
      </div>

      {issued && (
        <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-sm">
          ✓ Asset issued successfully on the configured blockchain network.
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          ⚠ {error}
        </div>
      )}

      {showForm && (
        <Card className="glass-panel neon-border-gold border-t-2">
          <CardHeader>
            <CardTitle className="text-white text-lg">New Asset</CardTitle>
            <CardDescription className="text-white/50">Define the parameters for the new digital asset token.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/70">Asset Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="HyperToken" className="bg-black/50 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-[#ffae00]" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Ticker Symbol</Label>
                <Input value={form.symbol} onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))} placeholder="HXT" className="bg-black/50 border-white/10 text-white placeholder:text-white/30 font-mono focus-visible:ring-[#ffae00]" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Total Supply</Label>
                <Input value={form.supply} onChange={(e) => setForm((f) => ({ ...f, supply: e.target.value }))} placeholder="10000000" className="bg-black/50 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-[#ffae00]" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Asset Type</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full h-10 rounded-md bg-black/50 border border-white/10 text-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#ffae00]"
                >
                  <option value="Fungible">Fungible Token (ERC-20 style)</option>
                  <option value="Non-Fungible">Non-Fungible Token (ERC-721 style)</option>
                  <option value="Semi-Fungible">Semi-Fungible (ERC-1155 style)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Blockchain Channel</Label>
                <Input value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))} placeholder="default-channel" className="bg-black/50 border-white/10 text-white placeholder:text-white/30 font-mono text-sm focus-visible:ring-[#ffae00]" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Sub-account <span className="text-white/30">(dept / IoT group)</span></Label>
                <Input value={form.subAccount} onChange={(e) => setForm((f) => ({ ...f, subAccount: e.target.value }))} placeholder="finance-dept" className="bg-black/50 border-white/10 text-white placeholder:text-white/30 font-mono text-sm focus-visible:ring-[#ffae00]" />
              </div>
            </div>
            <Button onClick={handleIssue} disabled={issuing || !form.name || !form.symbol || !form.supply} className="w-full bg-gradient-to-r from-[#ffae00] to-[#ff6600] hover:opacity-90 text-black font-semibold border-0 disabled:opacity-40">
              {issuing ? <span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />Issuing on network…</span> : "Issue Asset"}
            </Button>
          </CardContent>
        </Card>
      )}

      {(() => {
        const totalSupply = assets.reduce((sum, a) => sum + (parseFloat(a.supply) || 0), 0);
        const fmtSupply = (n: number) => {
          if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "") + "B";
          if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
          if (n >= 1_000) return (n / 1_000).toFixed(2).replace(/\.?0+$/, "") + "K";
          return n.toLocaleString();
        };
        const activeChannels = new Set(assets.map((a) => a.channel).filter(Boolean)).size;
        return (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Assets Issued", value: loading ? "..." : assets.length.toString(), icon: <Coins className="h-5 w-5 text-[#ffae00]" /> },
              { label: "Total Token Supply", value: loading ? "..." : (totalSupply === 0 ? "—" : fmtSupply(totalSupply)), icon: <ArrowUpRight className="h-5 w-5 text-green-400" /> },
              { label: "Active Channels", value: loading ? "..." : (activeChannels || "—").toString(), icon: <Shield className="h-5 w-5 text-[#c300ff]" /> },
            ].map((s) => (
              <Card key={s.label} className="glass-panel border border-white/10">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white/50 text-xs">{s.label}</p>
                    <p className="text-white text-2xl font-bold mt-1">{s.value}</p>
                  </div>
                  {s.icon}
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })()}

      <Card className="glass-panel neon-border-gold border-t-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white text-base">Issued Assets</CardTitle>
          {!loading && (
            <button onClick={() => window.location.reload()} className="text-white/50 hover:text-white transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-white/50">
              <div className="inline-block animate-spin h-6 w-6 border-2 border-[#ffae00] border-t-transparent rounded-full mb-2" />
              <p>Loading assets...</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-8 text-white/50">
              <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No assets found. Issue your first asset to get started.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr>
                    {["Asset", "Symbol", "Supply", "Type", "Channel", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-white/50 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a, i) => (
                    <tr key={i} className="border-t border-white/10 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{a.name}</td>
                      <td className="px-4 py-3 font-mono text-[#ffae00]">{a.symbol}</td>
                      <td className="px-4 py-3 text-white/70">{a.supply}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={a.type === "Fungible" ? "border-blue-500/40 text-blue-400 bg-blue-500/10" : "border-purple-500/40 text-purple-400 bg-purple-500/10"}>
                          {a.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-white/60 text-xs">{a.channel}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={a.status === "Active" ? "border-green-500/40 text-green-400 bg-green-500/10" : "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"}>
                          {a.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            title="Transfer tokens"
                            onClick={() => openModal("transfer", a)}
                            className="p-1.5 rounded text-white/40 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </button>
                          <button
                            title="Burn tokens"
                            onClick={() => openModal("burn", a)}
                            className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Flame className="h-4 w-4" />
                          </button>
                          <button
                            title="Sync from chain"
                            onClick={() => handleSync(a)}
                            disabled={syncingRow === a.symbol}
                            className="p-1.5 rounded text-white/40 hover:text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-40"
                          >
                            <RefreshCw className={`h-4 w-4 ${syncingRow === a.symbol ? "animate-spin" : ""}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
