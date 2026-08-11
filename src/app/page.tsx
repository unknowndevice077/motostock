"use client";

import React, { useState, useMemo, useEffect } from "react";

// --- BUSINESS DATA INTERFACES ---
interface Motorcycle {
  id: string;
  modelName: string;
  vin: string;
  displacement: string;
  price: number;
  cost: number;
  stock: number;
  category: "Sport" | "Scooter" | "Naked" | "Off-Road";
}

interface SparePart {
  id: string;
  partName: string;
  partNumber: string;
  stock: number;
  minThreshold: number;
  costPrice: number;
  sellingPrice: number;
  category: "Engine" | "Brakes" | "Electrical" | "Accessories";
}

// --- ONLINE DATABASE ENDPOINT HUB ---
const DATABASE_ENDPOINT = "https://morlitz-default-rtdb.asia-southeast1.firebasedatabase.app";

// --- LOCAL ACCESS GATE PASSKEY ---
const MANAGER_PASSKEY = "yamahadealer";

export default function MorlitzMotorsApp() {
  // Navigation & Access Control States
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passkeyInput, setPasskeyInput] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "showroom" | "parts">("dashboard");
  const [isDatabaseLoading, setIsDatabaseLoading] = useState<boolean>(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  // --- CLEAN DATA STATES (PLACEHOLDERS WIPED) ---
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [parts, setParts] = useState<SparePart[]>([]);

  // --- MODAL CONTROL STATES ---
  const [showAddBikeModal, setShowAddBikeModal] = useState<boolean>(false);
  const [showAddPartModal, setShowAddPartModal] = useState<boolean>(false);
  
  const [editingBikeId, setEditingBikeId] = useState<string | null>(null);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);

  const [bikeIdToDelete, setBikeIdToDelete] = useState<string | null>(null);
  const [partIdToDelete, setPartIdToDelete] = useState<string | null>(null);

  // --- FORM ENTRY BUFFER STATES ---
  const [bikeForm, setBikeForm] = useState({ modelName: "", vin: "", displacement: "", price: "", cost: "", stock: "", category: "Sport" as Motorcycle["category"] });
  const [partForm, setPartForm] = useState({ partName: "", partNumber: "", stock: "", minThreshold: "", costPrice: "", sellingPrice: "", category: "Engine" as SparePart["category"] });

  const [editBikeForm, setEditBikeForm] = useState({ modelName: "", vin: "", displacement: "", price: "", cost: "", stock: "", category: "Sport" as Motorcycle["category"] });
  const [editPartForm, setEditPartForm] = useState({ partName: "", partNumber: "", stock: "", minThreshold: "", costPrice: "", sellingPrice: "", category: "Engine" as SparePart["category"] });

  // Search/Filter State Strings
  const [showroomSearch, setShowroomSearch] = useState<string>("");
  const [partsSearch, setPartsSearch] = useState<string>("");

  // --- ONLINE ASYNCHRONOUS DATA INTEGRATIONS ---
  useEffect(() => {
    async function pullDatabaseRecords() {
      try {
        setIsDatabaseLoading(true);
        
        // Fetch Showroom Fleet Items
        const bikeResponse = await fetch(`${DATABASE_ENDPOINT}/showroom.json`);
        const bikeData = await bikeResponse.json();
        if (bikeData) {
          const parsedBikes: Motorcycle[] = Object.keys(bikeData).map((key) => ({
            id: key,
            ...bikeData[key],
          }));
          setMotorcycles(parsedBikes);
        }

        // Fetch Stockroom Spare Parts
        const partsResponse = await fetch(`${DATABASE_ENDPOINT}/parts.json`);
        const partsData = await partsResponse.json();
        if (partsData) {
          const parsedParts: SparePart[] = Object.keys(partsData).map((key) => ({
            id: key,
            ...partsData[key],
          }));
          setParts(parsedParts);
        }
        
        setDatabaseError(null);
      } catch (error) {
        console.error("Database sync dropout, deploying local fallback layers:", error);
        setDatabaseError("Operating in offline framework backup cache mode.");
        const localBikes = localStorage.getItem("morlitz_bikes");
        const localParts = localStorage.getItem("morlitz_parts");
        if (localBikes) setMotorcycles(JSON.parse(localBikes));
        if (localParts) setParts(JSON.parse(localParts));
      } finally {
        setIsDatabaseLoading(false);
      }
    }

    pullDatabaseRecords();
  }, []);

  useEffect(() => {
    localStorage.setItem("morlitz_bikes", JSON.stringify(motorcycles));
  }, [motorcycles]);

  useEffect(() => {
    localStorage.setItem("morlitz_parts", JSON.stringify(parts));
  }, [parts]);

  // --- INVENTORY FINANCIAL ARITHMETIC PARSER ---
  const metrics = useMemo(() => {
    const totalVehicleCost = motorcycles.reduce((sum, item) => sum + ((Number(item.stock) || 0) * (Number(item.cost) || 0)), 0);
    const totalVehicleRetail = motorcycles.reduce((sum, item) => sum + ((Number(item.stock) || 0) * (Number(item.price) || 0)), 0);

    const totalPartsCost = parts.reduce((sum, item) => sum + ((Number(item.stock) || 0) * (Number(item.costPrice) || 0)), 0);
    const totalPartsRetail = parts.reduce((sum, item) => sum + ((Number(item.stock) || 0) * (Number(item.sellingPrice) || 0)), 0);

    const totalAssetsCost = totalVehicleCost + totalPartsCost;
    const totalAssetsValue = totalVehicleRetail + totalPartsRetail;
    const potentialProfit = totalAssetsValue - totalAssetsCost;

    const lowStockPartsCount = parts.filter(p => (Number(p.stock) || 0) <= (Number(p.minThreshold) || 0)).length;

    return { totalAssetsCost, totalAssetsValue, potentialProfit, lowStockPartsCount };
  }, [motorcycles, parts]);

  // --- VEHICLE MAIN CRUD OPERATIONS ---
  const handleCreateMotorcycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bikeForm.modelName || !bikeForm.vin) return;

    const payload = {
      modelName: bikeForm.modelName,
      vin: bikeForm.vin,
      displacement: bikeForm.displacement || "N/A",
      price: Number(bikeForm.price) || 0,
      cost: Number(bikeForm.cost) || 0,
      stock: Number(bikeForm.stock) || 0,
      category: bikeForm.category
    };

    try {
      const response = await fetch(`${DATABASE_ENDPOINT}/showroom.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      setMotorcycles([...motorcycles, { id: data.name, ...payload }]);
    } catch (err) {
      setMotorcycles([...motorcycles, { id: `L-V-${Date.now()}`, ...payload }]);
    }

    setBikeForm({ modelName: "", vin: "", displacement: "", price: "", cost: "", stock: "", category: "Sport" });
    setShowAddBikeModal(false);
  };

  const startEditBike = (bike: Motorcycle) => {
    setEditingBikeId(bike.id);
    setEditBikeForm({
      modelName: bike.modelName || "",
      vin: bike.vin || "",
      displacement: bike.displacement || "",
      price: (bike.price || 0).toString(),
      cost: (bike.cost || 0).toString(),
      stock: (bike.stock || 0).toString(),
      category: bike.category || "Sport"
    });
  };

  const handleUpdateMotorcycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBikeId) return;

    const payload = {
      modelName: editBikeForm.modelName,
      vin: editBikeForm.vin,
      displacement: editBikeForm.displacement,
      price: Number(editBikeForm.price) || 0,
      cost: Number(editBikeForm.cost) || 0,
      stock: Number(editBikeForm.stock) || 0,
      category: editBikeForm.category
    };

    try {
      await fetch(`${DATABASE_ENDPOINT}/showroom/${editingBikeId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn("Cached modification changes locally.");
    }

    setMotorcycles(motorcycles.map(b => b.id === editingBikeId ? { id: editingBikeId, ...payload } : b));
    setEditingBikeId(null);
  };

  const confirmDeleteBike = async () => {
    if (!bikeIdToDelete) return;

    try {
      await fetch(`${DATABASE_ENDPOINT}/showroom/${bikeIdToDelete}.json`, { method: "DELETE" });
    } catch (err) {
      console.warn("Purged operational listing entry locally.");
    }

    setMotorcycles(motorcycles.filter(b => b.id !== bikeIdToDelete));
    setBikeIdToDelete(null);
  };

  // --- SPARE PARTS MAIN CRUD OPERATIONS ---
  const handleCreatePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partForm.partName || !partForm.partNumber) return;

    const payload = {
      partName: partForm.partName,
      partNumber: partForm.partNumber,
      stock: Number(partForm.stock) || 0,
      minThreshold: Number(partForm.minThreshold) || 0,
      costPrice: Number(partForm.costPrice) || 0,
      sellingPrice: Number(partForm.sellingPrice) || 0,
      category: partForm.category
    };

    try {
      const response = await fetch(`${DATABASE_ENDPOINT}/parts.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      setParts([...parts, { id: data.name, ...payload }]);
    } catch (err) {
      setParts([...parts, { id: `L-P-${Date.now()}`, ...payload }]);
    }

    setPartForm({ partName: "", partNumber: "", stock: "", minThreshold: "", costPrice: "", sellingPrice: "", category: "Engine" });
    setShowAddPartModal(false);
  };

  const startEditPart = (part: SparePart) => {
    setEditingPartId(part.id);
    setEditPartForm({
      partName: part.partName || "",
      partNumber: part.partNumber || "",
      stock: (part.stock || 0).toString(),
      minThreshold: (part.minThreshold || 0).toString(),
      costPrice: (part.costPrice || 0).toString(),
      sellingPrice: (part.sellingPrice || 0).toString(),
      category: part.category || "Engine"
    });
  };

  const handleUpdatePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartId) return;

    const payload = {
      partName: editPartForm.partName,
      partNumber: editPartForm.partNumber,
      stock: Number(editPartForm.stock) || 0,
      minThreshold: Number(editPartForm.minThreshold) || 0,
      costPrice: Number(editPartForm.costPrice) || 0,
      sellingPrice: Number(editPartForm.sellingPrice) || 0,
      category: editPartForm.category
    };

    try {
      await fetch(`${DATABASE_ENDPOINT}/parts/${editingPartId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn("Wrote spare adjustment straight down to local fallback structures.");
    }

    setParts(parts.map(p => p.id === editingPartId ? { id: editingPartId, ...payload } : p));
    setEditingPartId(null);
  };

  const confirmDeletePart = async () => {
    if (!partIdToDelete) return;

    try {
      await fetch(`${DATABASE_ENDPOINT}/parts/${partIdToDelete}.json`, { method: "DELETE" });
    } catch (err) {
      console.warn("Processed database row removal over cache.");
    }

    setParts(parts.filter(p => p.id !== partIdToDelete));
    setPartIdToDelete(null);
  };

  // --- ACCESS GATE LOGIN HANDLER ---
  const handleLogin = () => {
    if (passkeyInput === MANAGER_PASSKEY) {
      setLoginError("");
      setIsAuthenticated(true);
    } else {
      setLoginError("Invalid security passkey.");
    }
  };

  // --- SAFE NULL-GUARD FILTERS ---
  const filteredBikes = motorcycles.filter(b => {
    const model = (b.modelName || "").toLowerCase();
    const vinCode = (b.vin || "").toLowerCase();
    const search = (showroomSearch || "").toLowerCase();
    return model.includes(search) || vinCode.includes(search);
  });

  const filteredParts = parts.filter(p => {
    const name = (p.partName || "").toLowerCase();
    const num = (p.partNumber || "").toLowerCase();
    const search = (partsSearch || "").toLowerCase();
    return name.includes(search) || num.includes(search);
  });

  // --- VISUAL PRESENTATION LAYERS ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-hidden relative font-sans select-none animate-fadeIn">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] animate-pulse" />
        
        <header className="z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center font-black text-slate-950 shadow-lg shadow-cyan-500/20 transform hover:rotate-12 transition-all duration-300">M</div>
            <span className="text-xl font-bold tracking-tight text-white">Morlitz OS</span>
            <span className="text-xs bg-slate-800 text-slate-400 border border-slate-700 rounded-full px-2 py-0.5 font-mono">Inventory Hub</span>
          </div>
          <div className="text-xs font-mono text-slate-500 hidden sm:block">Secure Cloud Core Integrated</div>
        </header>

        <main className="z-10 max-w-7xl mx-auto w-full px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-grow">
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left transform translate-x-0 transition-transform duration-500">
            <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-white leading-none">
              Streamlined Asset & <br/>
              <span className="bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 bg-clip-text text-transparent">Inventory Manager</span>
            </h1>
            <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Maintain absolute structural control over your vehicle showroom fleets and replacement part stocks. Execute real-time database modifications and lookups with no intermediate configurations required.
            </p>
          </div>

          <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800/80 p-8 rounded-2xl shadow-2xl backdrop-blur-md max-w-md w-full mx-auto transform scale-100 hover:scale-[1.01] transition-all duration-300">
            <h2 className="text-xl font-bold text-white mb-1">Manager Access</h2>
            <p className="text-xs text-slate-400 mb-6">Authorize terminal session deployment variables.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Authorized Node Scope</label>
                <input type="text" disabled value="yamaha-dealership-inventory" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-500 cursor-not-allowed font-mono" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Security Passkey</label>
                <input
                  type="password"
                  placeholder="•••••••••••••••••••••"
                  value={passkeyInput}
                  onChange={(e) => { setPasskeyInput(e.target.value); setLoginError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                  className={`w-full bg-slate-950 border rounded-lg px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono transition-all duration-200 ${loginError ? "border-red-800" : "border-slate-800"}`}
                />
                {loginError && <p className="text-[10px] text-red-400 font-mono mt-1.5">{loginError}</p>}
              </div>
              <button onClick={handleLogin} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold py-3 px-4 rounded-lg shadow-lg hover:brightness-110 active:scale-[0.99] transition-all duration-200 text-xs mt-2 uppercase tracking-wider">
                Initialize Store Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased font-sans animate-fadeIn">
      
      {/* HEADER NAVBAR CONTAINER */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md z-20">
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2 select-none">
            <div className="h-8 w-8 bg-cyan-500 rounded-lg flex items-center justify-center font-black text-slate-950 text-sm shadow shadow-cyan-500/20">M</div>
            <div className="text-left">
              <span className="font-bold text-base block tracking-tight">Morlitz Motors</span>
              <span className="text-[9px] text-cyan-400 font-mono block tracking-widest uppercase">Stock Hub</span>
            </div>
          </div>
          
          <nav className="flex items-center bg-slate-950/60 p-1 rounded-lg border border-slate-800 overflow-x-auto">
            <button onClick={() => setActiveTab("dashboard")} className={`px-4 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider font-mono transition-all duration-200 whitespace-nowrap ${activeTab === "dashboard" ? "bg-slate-800 text-white border-b-2 border-cyan-500" : "text-slate-400 hover:text-slate-200"}`}>
              Market Dashboard
            </button>
            <button onClick={() => setActiveTab("showroom")} className={`px-4 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider font-mono transition-all duration-200 whitespace-nowrap ${activeTab === "showroom" ? "bg-slate-800 text-white border-b-2 border-cyan-500" : "text-slate-400 hover:text-slate-200"}`}>
              Vehicle Showroom
            </button>
            <button onClick={() => setActiveTab("parts")} className={`px-4 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider font-mono transition-all duration-200 whitespace-nowrap ${activeTab === "parts" ? "bg-slate-800 text-white border-b-2 border-cyan-500" : "text-slate-400 hover:text-slate-200"}`}>
              Parts Stockroom
            </button>
          </nav>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800 font-mono select-none">
          <div className="text-left">
            <p className="text-xs font-bold text-slate-300">Operations Console</p>
            <p className="text-[9px] text-slate-500">Live Server Connected</p>
          </div>
          <button onClick={() => setIsAuthenticated(false)} className="bg-slate-800 hover:bg-red-950/40 border border-slate-700 hover:border-red-900 text-slate-400 hover:text-red-400 transition-all duration-200 text-xs px-3 py-1.5 rounded-lg">
            Lock Session
          </button>
        </div>
      </header>

      {/* FRAME CENTRAL GRID CONTAINER */}
      <div className="flex-grow flex flex-col overflow-hidden">
        <main className="w-full p-6 overflow-y-auto max-h-[calc(100vh-73px)] space-y-6 transition-all duration-300">

          {isDatabaseLoading && (
            <div className="bg-cyan-950/40 border border-cyan-800/60 text-cyan-400 p-3 rounded-lg text-xs font-mono flex items-center gap-2 animate-pulse">
              <span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full"></span>
              Synchronizing cloud databases vectors...
            </div>
          )}

          {databaseError && (
            <div className="bg-amber-950/40 border border-amber-900 text-amber-400 p-3 rounded-lg text-xs font-mono animate-fadeIn">
              ⚠️ {databaseError}
            </div>
          )}
          
          {/* TAB 1: EXECUTIVE PERFORMANCE METRICS */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-slideUp">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">Stock Asset Evaluation</h2>
                <p className="text-xs text-slate-400">Total metrics reflecting current asset holds across categories.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm transform hover:translate-y-[-2px] transition-all duration-200">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Capital Inventory Cost</p>
                  <p className="text-2xl font-black text-cyan-400 mt-1">${metrics.totalAssetsCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm transform hover:translate-y-[-2px] transition-all duration-200">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Potential Gross Valuation</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">${metrics.totalAssetsValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm transform hover:translate-y-[-2px] transition-all duration-200">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Projected Yield Gains</p>
                  <p className="text-2xl font-black text-blue-400 mt-1">${metrics.potentialProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm transform hover:translate-y-[-2px] transition-all duration-200">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Flagged Parts Thresholds</p>
                  <p className="text-2xl font-black text-amber-400 mt-1">{metrics.lowStockPartsCount} Critical Shortages</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between shadow-lg">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Department Capital Concentration Sizing</h3>
                  <p className="text-[11px] text-slate-500">Visual layout mapping wholesales configurations directly via SVG rendering graphs.</p>
                </div>
                <div className="w-full h-40 mt-6 relative flex items-end justify-around border-b border-l border-slate-800/80 px-4 pb-2">
                  <div className="flex flex-col items-center gap-2 w-1/3">
                    <div className="bg-gradient-to-t from-cyan-600 to-cyan-400 w-full rounded-t-md transition-all duration-700 h-32" />
                    <span className="text-[10px] text-slate-400 font-mono">Showroom Vehicles Pool</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 w-1/3">
                    <div className="bg-gradient-to-t from-teal-600 to-teal-400 w-full rounded-t-md transition-all duration-700 h-12" />
                    <span className="text-[10px] text-slate-400 font-mono">Stockroom Components Pool</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SHOWROOM MOTORCYCLES CONTROL CENTER */}
          {activeTab === "showroom" && (
            <div className="space-y-6 animate-slideUp">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white">Showroom Fleet Management</h2>
                  <p className="text-xs text-slate-400">Complete execution workspace tracking whole vehicle showroom assets.</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <input type="text" placeholder="Filter by model or VIN..." value={showroomSearch} onChange={(e) => setShowroomSearch(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-w-[200px] transition-all duration-200" />
                  <button onClick={() => setShowAddBikeModal(true)} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-all duration-200 whitespace-nowrap transform hover:scale-[1.02]">
                    + Ingest Vehicle
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono uppercase tracking-wider text-[11px]">
                      <th className="p-4">Motorcycle Variant</th>
                      <th className="p-4">VIN Serial Key</th>
                      <th className="p-4 text-center">Engine Displacement</th>
                      <th className="p-4 text-center">Floor Stock</th>
                      <th className="p-4 text-right">Retail Base Price</th>
                      <th className="p-4 text-center">Modifications</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredBikes.map(bike => (
                      <tr key={bike.id} className="hover:bg-slate-800/20 transition-all duration-150 group">
                        <td className="p-4">
                          <p className="font-bold text-white group-hover:text-cyan-400 transition-colors duration-150">{bike.modelName}</p>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 font-medium">{bike.category}</span>
                        </td>
                        <td className="p-4 font-mono text-slate-400">{bike.vin}</td>
                        <td className="p-4 text-center font-mono text-slate-300">{bike.displacement}</td>
                        <td className="p-4 text-center font-bold font-mono text-slate-200">{bike.stock} units</td>
                        <td className="p-4 text-right font-mono text-cyan-400 font-bold">${bike.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => startEditBike(bike)} className="text-[10px] bg-cyan-950 text-cyan-400 hover:bg-cyan-900 border border-cyan-800/50 px-2 py-1 rounded font-mono transition-all duration-150">Edit</button>
                            <button onClick={() => setBikeIdToDelete(bike.id)} className="text-[10px] bg-red-950/40 text-red-400 hover:bg-red-900/60 border border-red-900/40 px-2 py-1 rounded font-mono transition-all duration-150">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredBikes.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 font-mono">No matching vehicles listed within cloud nodes.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SPARE PARTS INVENTORY DEPOT */}
          {activeTab === "parts" && (
            <div className="space-y-6 animate-slideUp">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white">Parts Department Stockroom</h2>
                  <p className="text-xs text-slate-400">Complete tracking array for replacement components records.</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <input type="text" placeholder="Search parts room inventory..." value={partsSearch} onChange={(e) => setPartsSearch(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-w-[200px] transition-all duration-200" />
                  <button onClick={() => setShowAddPartModal(true)} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-all duration-200 whitespace-nowrap transform hover:scale-[1.02]">
                    + Ingest Part
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono uppercase tracking-wider text-[11px]">
                      <th className="p-4">Component Profile</th>
                      <th className="p-4">OEM Code Identifier</th>
                      <th className="p-4 text-center">Stock Volume Available</th>
                      <th className="p-4 text-right">Retail Base Price</th>
                      <th className="p-4 text-center">Modifications Management</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredParts.map(part => {
                      const isLow = part.stock <= part.minThreshold;
                      return (
                        <tr key={part.id} className="hover:bg-slate-800/20 transition-all duration-150">
                          <td className="p-4">
                            <p className="font-bold text-white">{part.partName}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 font-mono font-medium">{part.category} Section</span>
                          </td>
                          <td className="p-4 font-mono text-slate-400">{part.partNumber}</td>
                          <td className="p-4 text-center">
                            <span className={`font-mono font-bold px-2 py-0.5 rounded ${isLow ? "text-amber-400 bg-amber-950/40 border border-amber-900/40 animate-pulse" : "text-slate-300 bg-slate-950"}`}>
                              {part.stock} units
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-slate-200">${part.sellingPrice.toFixed(2)}</td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => startEditPart(part)} className="text-[10px] bg-cyan-950 text-cyan-400 hover:bg-cyan-900 border border-cyan-800/50 px-2 py-1 rounded font-mono transition-all duration-150">Edit</button>
                              <button onClick={() => setPartIdToDelete(part.id)} className="text-[10px] bg-red-950/40 text-red-400 hover:bg-red-900/60 border border-red-900/40 px-2 py-1 rounded font-mono transition-all duration-150">Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredParts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 font-mono">No spare parts profiles logged inside database nodes.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ========================================================================= */}
      {/* ======================= HARDWARE MODAL OVERLAYS ======================== */}
      {/* ========================================================================= */}

      {/* POP-UP: VEHICLE CREATION ENTRY FORM */}
      {showAddBikeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-scaleUp">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">Ingest New Showroom Vehicle</h3>
              <button onClick={() => setShowAddBikeModal(false)} className="text-slate-400 hover:text-white text-xs transition-colors">✕</button>
            </div>
            <form onSubmit={handleCreateMotorcycle} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Model Name</label>
                <input type="text" required value={bikeForm.modelName} onChange={(e) => setBikeForm({ ...bikeForm, modelName: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">VIN Code</label>
                  <input type="text" required value={bikeForm.vin} onChange={(e) => setBikeForm({ ...bikeForm, vin: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Displacement (cc)</label>
                  <input type="text" value={bikeForm.displacement} onChange={(e) => setBikeForm({ ...bikeForm, displacement: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Class Type</label>
                  <select value={bikeForm.category} onChange={(e) => setBikeForm({ ...bikeForm, category: e.target.value as Motorcycle["category"] })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500">
                    <option value="Sport">Sport</option>
                    <option value="Scooter">Scooter</option>
                    <option value="Naked">Naked</option>
                    <option value="Off-Road">Off-Road</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Stock Level</label>
                  <input type="number" value={bikeForm.stock} onChange={(e) => setBikeForm({ ...bikeForm, stock: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Dealer Invoice Cost ($)</label>
                  <input type="number" value={bikeForm.cost} onChange={(e) => setBikeForm({ ...bikeForm, cost: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Retail Floor Price ($)</label>
                  <input type="number" value={bikeForm.price} onChange={(e) => setBikeForm({ ...bikeForm, price: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <button type="submit" className="w-full bg-cyan-500 text-slate-950 font-bold py-2.5 rounded-lg transition-all duration-200 uppercase font-mono tracking-wider text-xs hover:brightness-110">
                Save Record Profile
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP: VEHICLE UPDATE MODIFICATION WINDOW */}
      {editingBikeId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-scaleUp">
          <div className="bg-slate-900 border border-cyan-500/20 p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 font-mono">Modify Target Vehicle Fields</h3>
              <button onClick={() => setEditingBikeId(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <form onSubmit={handleUpdateMotorcycle} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Model Variant Title</label>
                <input type="text" value={editBikeForm.modelName} onChange={(e) => setEditBikeForm({ ...editBikeForm, modelName: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">VIN Code Identifier</label>
                  <input type="text" value={editBikeForm.vin} onChange={(e) => setEditBikeForm({ ...editBikeForm, vin: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">CC Displacement</label>
                  <input type="text" value={editBikeForm.displacement} onChange={(e) => setEditBikeForm({ ...editBikeForm, displacement: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Category Class</label>
                  <select value={editBikeForm.category} onChange={(e) => setEditBikeForm({ ...editBikeForm, category: e.target.value as Motorcycle["category"] })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500">
                    <option value="Sport">Sport</option>
                    <option value="Scooter">Scooter</option>
                    <option value="Naked">Naked</option>
                    <option value="Off-Road">Off-Road</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Stock Vol</label>
                  <input type="number" value={editBikeForm.stock} onChange={(e) => setEditBikeForm({ ...editBikeForm, stock: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Dealer Cost ($)</label>
                  <input type="number" value={editBikeForm.cost} onChange={(e) => setEditBikeForm({ ...editBikeForm, cost: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Showroom Retail Price ($)</label>
                  <input type="number" value={editBikeForm.price} onChange={(e) => setEditBikeForm({ ...editBikeForm, price: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <button type="submit" className="w-full bg-cyan-500 text-slate-950 font-bold py-2.5 rounded-lg transition-all duration-200 uppercase font-mono tracking-wider text-xs hover:brightness-110">
                Commit Modifications
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP: SHOWROOM DELETION SYSTEM PURGE VERIFICATION */}
      {bikeIdToDelete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-scaleUp">
          <div className="bg-slate-900 border border-red-900/40 p-6 rounded-xl max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="text-red-400 text-3xl">⚠️</div>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">Confirm Record Deletion</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Are you certain you want to purge this vehicle configuration from your active data cache? This operational data loop cannot be reversed.</p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setBikeIdToDelete(null)} className="w-1/2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 font-bold py-2 rounded-lg text-xs transition-colors">Cancel</button>
              <button onClick={confirmDeleteBike} className="w-1/2 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-xs transition-colors">Confirm Purge</button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP: SPARE PARTS INVENTORY GENERATION FORM */}
      {showAddPartModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-scaleUp">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">Catalog New Component Variant</h3>
              <button onClick={() => setShowAddPartModal(false)} className="text-slate-400 hover:text-white text-xs transition-colors">✕</button>
            </div>
            <form onSubmit={handleCreatePart} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Part Descriptive Designation</label>
                <input type="text" required value={partForm.partName} onChange={(e) => setPartForm({ ...partForm, partName: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">OEM Factory Part Code</label>
                  <input type="text" required value={partForm.partNumber} onChange={(e) => setPartForm({ ...partForm, partNumber: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Component Segment</label>
                  <select value={partForm.category} onChange={(e) => setPartForm({ ...partForm, category: e.target.value as SparePart["category"] })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500">
                    <option value="Engine">Engine</option>
                    <option value="Brakes">Brakes</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Accessories">Accessories</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Quantity Ingested</label>
                  <input type="number" value={partForm.stock} onChange={(e) => setPartForm({ ...partForm, stock: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Minimum Safe Boundary</label>
                  <input type="number" value={partForm.minThreshold} onChange={(e) => setPartForm({ ...partForm, minThreshold: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Wholesale Cost ($)</label>
                  <input type="number" step="0.01" value={partForm.costPrice} onChange={(e) => setPartForm({ ...partForm, costPrice: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Retail Price ($)</label>
                  <input type="number" step="0.01" value={partForm.sellingPrice} onChange={(e) => setPartForm({ ...partForm, sellingPrice: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <button type="submit" className="w-full bg-cyan-500 text-slate-950 font-bold py-2.5 rounded-lg transition-all duration-200 uppercase font-mono tracking-wider text-xs hover:brightness-110">
                Save Component Profile
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP: SPARE PARTS MODIFICATION CORE WINDOW */}
      {editingPartId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-scaleUp">
          <div className="bg-slate-900 border border-cyan-500/20 p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 font-mono">Modify Target Part Parameters</h3>
              <button onClick={() => setEditingPartId(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <form onSubmit={handleUpdatePart} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Component Name</label>
                <input type="text" value={editPartForm.partName} onChange={(e) => setEditPartForm({ ...editPartForm, partName: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">OEM Key Identifier</label>
                  <input type="text" value={editPartForm.partNumber} onChange={(e) => setEditPartForm({ ...editPartForm, partNumber: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Segment Block</label>
                  <select value={editPartForm.category} onChange={(e) => setEditPartForm({ ...editPartForm, category: e.target.value as SparePart["category"] })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500">
                    <option value="Engine">Engine</option>
                    <option value="Brakes">Brakes</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Accessories">Accessories</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Units Quantity</label>
                  <input type="number" value={editPartForm.stock} onChange={(e) => setEditPartForm({ ...editPartForm, stock: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Minimum Threshold</label>
                  <input type="number" value={editPartForm.minThreshold} onChange={(e) => setEditPartForm({ ...editPartForm, minThreshold: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Dealer Wholesale Cost ($)</label>
                  <input type="number" value={editPartForm.costPrice} onChange={(e) => setEditPartForm({ ...editPartForm, costPrice: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Retail Price ($)</label>
                  <input type="number" value={editPartForm.sellingPrice} onChange={(e) => setEditPartForm({ ...editPartForm, sellingPrice: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <button type="submit" className="w-full bg-cyan-500 text-slate-950 font-bold py-2.5 rounded-lg transition-all duration-200 uppercase font-mono tracking-wider text-xs hover:brightness-110">
                Commit Modifications
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP: STOCKROOM SPARE PART DELETION PURGE VERIFICATION */}
      {partIdToDelete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-scaleUp">
          <div className="bg-slate-900 border border-red-900/40 p-6 rounded-xl max-sm w-full shadow-2xl text-center space-y-4">
            <div className="text-red-400 text-3xl animate-bounce">⚠️</div>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">Confirm Record Deletion</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Are you completely certain you want to purge this component configuration out of the stockroom catalog mapping? This action will remove the asset node completely.</p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setPartIdToDelete(null)} className="w-1/2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 font-bold py-2 rounded-lg text-xs transition-colors">Cancel</button>
              <button onClick={confirmDeletePart} className="w-1/2 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-xs transition-colors">Confirm Purge</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}