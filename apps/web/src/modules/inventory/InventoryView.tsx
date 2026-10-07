import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { db } from '../../lib/db';
import type { StockItem, StockGroup, Godown, UnitOfMeasure } from '@newbal/shared';
import {
  Boxes,
  Plus,
  Search,
  FileSpreadsheet,
  AlertTriangle,
  Factory,
  Warehouse,
  Check,
  X,
} from 'lucide-react';
import { ExportEngine } from '../../lib/exportEngine';

export const InventoryView: React.FC = () => {
  const { activeCompany, triggerRefresh, refreshKey } = useApp();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockGroups, setStockGroups] = useState<StockGroup[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'GODOWNS' | 'MANUFACTURING'>('ITEMS');

  // Modal State
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [hsnCode, setHsnCode] = useState('');
  const [gstRate, setGstRate] = useState(18);
  const [openingQuantity, setOpeningQuantity] = useState(0);
  const [openingRate, setOpeningRate] = useState(0);
  const [standardSalesRate, setStandardSalesRate] = useState(0);
  const [standardPurchaseRate, setStandardPurchaseRate] = useState(0);
  const [reorderLevel, setReorderLevel] = useState(10);

  // Manufacturing run feedback state
  const [mfgSuccessMessage, setMfgSuccessMessage] = useState('');

  useEffect(() => {
    if (!activeCompany) return;

    async function loadInventory() {
      const itms = await db.stockItems.where('companyId').equals(activeCompany!.id).toArray();
      const grps = await db.stockGroups.where('companyId').equals(activeCompany!.id).toArray();
      const gdns = await db.godowns.where('companyId').equals(activeCompany!.id).toArray();
      const uoms = await db.unitsOfMeasure.toArray();

      setStockItems(itms);
      setStockGroups(grps);
      setGodowns(gdns);
      setUnits(uoms);
      if (grps.length > 0 && !groupId) {
        setGroupId(grps[0].id);
      }
    }
    loadInventory();
  }, [activeCompany, refreshKey]);

  const filteredItems = stockItems.filter((i) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return i.name.toLowerCase().includes(q) || (i.hsnCode && i.hsnCode.includes(q));
    }
    return true;
  });

  const totalInventoryValue = stockItems.reduce((acc, i) => {
    const qty = i.closingQuantity ?? i.openingQuantity;
    const rate = i.closingRate ?? i.openingRate;
    return acc + qty * rate;
  }, 0);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !activeCompany) return;

    const opVal = Number(openingQuantity) * Number(openingRate);

    const newItem: StockItem = {
      id: `itm-${Date.now()}`,
      companyId: activeCompany.id,
      name,
      groupId: groupId || stockGroups[0]?.id || 'stk-grp-components',
      unit,
      hsnCode: hsnCode || undefined,
      gstRate: Number(gstRate),
      openingQuantity: Number(openingQuantity),
      openingRate: Number(openingRate),
      openingValue: opVal,
      closingQuantity: Number(openingQuantity),
      closingRate: Number(openingRate),
      closingValue: opVal,
      standardPurchaseRate: Number(standardPurchaseRate),
      standardSalesRate: Number(standardSalesRate),
      reorderLevel: Number(reorderLevel),
      valuationMethod: 'FIFO',
    };

    await db.stockItems.add(newItem);
    await db.auditLogs.add({
      id: `log-${Date.now()}`,
      companyId: activeCompany.id,
      timestamp: new Date().toISOString(),
      action: 'CREATE',
      entity: 'STOCK_ITEM',
      entityId: newItem.id,
      details: `Created Stock Item "${newItem.name}"`,
      user: 'Administrator',
    });

    triggerRefresh();
    setIsNewItemModalOpen(false);
    setName('');
    setHsnCode('');
    setOpeningQuantity(0);
    setOpeningRate(0);
  };

  // Run Manufacturing Journal: Consumes 2 Sensors + 1 Power Supply to make 1 Finished Smart Controller
  const handleExecuteManufacturing = async () => {
    try {
      const controller = stockItems.find((i) => i.id === 'itm-smart-controller');
      const sensor = stockItems.find((i) => i.id === 'itm-sensor-module');
      const psu = stockItems.find((i) => i.id === 'itm-power-supply');

      if (!controller || !sensor || !psu) {
        alert('Items for Bill of Material not found');
        return;
      }

      const produceQty = 10;
      const sensorNeeded = produceQty * 2; // 20
      const psuNeeded = produceQty * 1; // 10

      // Update Stock Items in DB
      await db.stockItems.update(sensor.id, {
        closingQuantity: (sensor.closingQuantity ?? sensor.openingQuantity) - sensorNeeded,
      });
      await db.stockItems.update(psu.id, {
        closingQuantity: (psu.closingQuantity ?? psu.openingQuantity) - psuNeeded,
      });
      await db.stockItems.update(controller.id, {
        closingQuantity: (controller.closingQuantity ?? controller.openingQuantity) + produceQty,
      });

      // Add audit log
      await db.auditLogs.add({
        id: `log-${Date.now()}`,
        companyId: activeCompany!.id,
        timestamp: new Date().toISOString(),
        action: 'CREATE',
        entity: 'MFG_JOURNAL',
        details: `Manufacturing Journal: Produced 10 Smart IoT Controllers (Consumed 20 Sensors & 10 PSUs)`,
        user: 'Production Manager',
      });

      setMfgSuccessMessage(`Successfully manufactured 10 Units of Smart IoT Controller X1! Stock updated.`);
      triggerRefresh();
      setTimeout(() => setMfgSuccessMessage(''), 6000);
    } catch (err) {
      console.error(err);
      alert('Manufacturing journal execution error');
    }
  };

  const handleExportExcel = () => {
    const data = filteredItems.map((i) => ({
      'Item Name': i.name,
      'HSN / SAC': i.hsnCode || '-',
      'Unit of Measure': i.unit,
      'GST Rate': `${i.gstRate}%`,
      'Stock Quantity': i.closingQuantity ?? i.openingQuantity,
      'Standard Purchase Rate': i.standardPurchaseRate,
      'Standard Sales Rate': i.standardSalesRate,
      'Total Value (₹)': (i.closingQuantity ?? i.openingQuantity) * (i.closingRate ?? i.openingRate),
    }));
    ExportEngine.exportToExcel(data, `StockSummary_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center space-x-2">
            <Boxes className="w-6 h-6 text-emerald-400" />
            <span>Inventory & Stock Management</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time multi-godown stock valuation and BOM manufacturing for {activeCompany?.name}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Stock Summary Excel</span>
          </button>
          <button
            onClick={() => setIsNewItemModalOpen(true)}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition shadow-md shadow-emerald-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>Create Stock Item</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('ITEMS')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'ITEMS'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Stock Items & Valuation
        </button>
        <button
          onClick={() => setActiveTab('GODOWNS')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'GODOWNS'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Godowns & Warehouses
        </button>
        <button
          onClick={() => setActiveTab('MANUFACTURING')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'MANUFACTURING'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Bill of Materials & Manufacturing
        </button>
      </div>

      {/* Tab: ITEMS */}
      {activeTab === 'ITEMS' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs font-sans text-slate-400">Total Stock Value (FIFO)</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                ₹{totalInventoryValue.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] font-sans text-slate-500 mt-1">Reflected in Balance Sheet</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs font-sans text-slate-400">Total Catalog Items</div>
              <div className="text-2xl font-bold text-slate-100 mt-1">{stockItems.length} Items</div>
              <div className="text-[11px] font-sans text-slate-500 mt-1">Active SKUs tracked</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs font-sans text-slate-400">Warehouses / Godowns</div>
              <div className="text-2xl font-bold text-blue-400 mt-1">{godowns.length} Locations</div>
              <div className="text-[11px] font-sans text-slate-500 mt-1">Mumbai & Navi Mumbai</div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex items-center justify-between bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search stock item, HSN code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Stock Items Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-medium">Item Name</th>
                    <th className="py-3 px-4 font-medium">HSN / SAC</th>
                    <th className="py-3 px-4 font-medium text-center">GST %</th>
                    <th className="py-3 px-4 font-medium text-right">In Stock Qty</th>
                    <th className="py-3 px-4 font-medium text-right">Unit Rate (₹)</th>
                    <th className="py-3 px-4 font-medium text-right">Closing Value (₹)</th>
                    <th className="py-3 px-4 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {filteredItems.map((item) => {
                    const qty = item.closingQuantity ?? item.openingQuantity;
                    const rate = item.closingRate ?? item.openingRate;
                    const value = qty * rate;
                    const isLow = qty <= (item.reorderLevel || 10);

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 font-sans font-medium text-slate-200">{item.name}</td>
                        <td className="py-3.5 px-4 text-slate-400">{item.hsnCode || '-'}</td>
                        <td className="py-3.5 px-4 text-center text-slate-300">{item.gstRate}%</td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-100">
                          {qty} {item.unit}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400">
                          ₹{rate.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                          ₹{value.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 text-center font-sans">
                          {isLow ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-semibold">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Reorder</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold">
                              Adequate
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: GODOWNS */}
      {activeTab === 'GODOWNS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {godowns.map((g) => (
            <div key={g.id} className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Warehouse className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-slate-100 text-base">{g.name}</h3>
                </div>
                {g.isDefault && (
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                    Default
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{g.address || 'Standard Warehouse Facility'}</p>
              <div className="pt-2 text-xs font-mono text-slate-500">
                Location ID: {g.id}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: MANUFACTURING & BOM */}
      {activeTab === 'MANUFACTURING' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-100 text-base flex items-center space-x-2">
                <Factory className="w-5 h-5 text-emerald-400" />
                <span>Manufacturing Journal & Bill of Materials</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Convert raw materials & components into finished products automatically
              </p>
            </div>

            <button
              onClick={handleExecuteManufacturing}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center space-x-2 shadow-md shadow-emerald-950/40"
            >
              <Factory className="w-4 h-4" />
              <span>Run Production Batch (10 Units)</span>
            </button>
          </div>

          {mfgSuccessMessage && (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4" />
              <span>{mfgSuccessMessage}</span>
            </div>
          )}

          <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
            <div className="font-semibold text-xs text-slate-300">
              Active BOM: <span className="text-emerald-400">Smart IoT Controller X1 (Assembly)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 font-sans font-medium mb-2">Raw Materials Consumed (Per Unit)</div>
                <ul className="space-y-1 text-slate-200">
                  <li>• 2x Industrial Precision Sensor V2 (HSN 9031)</li>
                  <li>• 1x 24V Industrial Power Supply Unit (HSN 8504)</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 font-sans font-medium mb-2">Finished Good Produced</div>
                <ul className="space-y-1 text-emerald-400">
                  <li>• 1x Smart IoT Controller X1 (Ready for Sale)</li>
                  <li>• Automatically increases finished stock and decreases components</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Stock Item Modal */}
      {isNewItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">Create New Stock Item</h3>
              <button
                onClick={() => setIsNewItemModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5G Industrial Router Model R3"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Stock Group</label>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {stockGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Unit of Measure (UOM)</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.symbol}>
                        {u.formalName} ({u.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">HSN / SAC Code</label>
                  <input
                    type="text"
                    placeholder="85371000"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">GST Tax Rate (%)</label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  >
                    <option value={0}>0% (Nil / Exempt)</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18% (Standard)</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Opening Quantity</label>
                  <input
                    type="number"
                    value={openingQuantity}
                    onChange={(e) => setOpeningQuantity(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Opening Rate (₹)</label>
                  <input
                    type="number"
                    value={openingRate}
                    onChange={(e) => setOpeningRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Standard Sales Rate (₹)</label>
                  <input
                    type="number"
                    value={standardSalesRate}
                    onChange={(e) => setStandardSalesRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Reorder Alert Level</label>
                  <input
                    type="number"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewItemModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 shadow-md shadow-emerald-950/40"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Stock Item</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
