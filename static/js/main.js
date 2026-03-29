import * as api from './api.js';
import * as charts from './charts.js';

let currentAnalysis = null;
let cachedCrimeTypes = null;

async function getCrimeTypeOptions() {
    if (cachedCrimeTypes) return cachedCrimeTypes;
    const types = await api.fetchCrimeTypes();
    cachedCrimeTypes = [{ primary_type: "ALL", cnt: 0 }, ...(types || [])];
    return cachedCrimeTypes;
}

async function renderCrimeTypeSelect(selectId, defaultValue = "ALL") {
    const select = document.getElementById(selectId);
    if (!select) return;
    const options = await getCrimeTypeOptions();
    const selected = String(defaultValue || "ALL").toUpperCase();
    select.innerHTML = options.map(item => {
        const value = String(item.primary_type || "ALL").toUpperCase();
        const label = value === "ALL" ? "全部类型" : value;
        return `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`;
    }).join("");
}

async function loadKPI() {
    const arrestRes = await api.fetchArrestRate();
    if (arrestRes.length) {
        const rates = arrestRes.map(d => parseFloat(d.arrest_rate)).filter(r => !isNaN(r));
        if (rates.length) {
            const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
            const kpiArrestVal = document.querySelector("#kpi-avg-arrest .text-3xl");
            if (kpiArrestVal) kpiArrestVal.innerHTML = avgRate.toFixed(2) + "%";

            const latestArrest = parseFloat(arrestRes[arrestRes.length - 1].arrest_rate);
            const compareEl = document.querySelector("#kpi-avg-arrest-compare");
            if (compareEl && !isNaN(latestArrest)) {
                const diff = latestArrest - avgRate;
                const isPositive = diff > 0;
                const colorClass = isPositive ? 'text-emerald-500' : 'text-rose-500';
                const icon = isPositive 
                    ? '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>'
                    : '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>';
                compareEl.innerHTML = `<span class="flex items-center gap-1 ${colorClass}">${icon} ${isPositive ? '高于' : '低于'}历史平均 ${Math.abs(diff).toFixed(2)}%</span>`;
            }
        }
    }

    const yearlyRes = await api.fetchYearlyTrend();
    if (yearlyRes.length) {
        const totalCrimes = yearlyRes.reduce((sum, d) => sum + d.cnt, 0);
        const kpiTotalVal = document.querySelector("#kpi-total .text-3xl");
        if (kpiTotalVal) kpiTotalVal.innerText = totalCrimes.toLocaleString();
        const firstYear = yearlyRes[0].year, lastYear = yearlyRes[yearlyRes.length - 1].year;
        const totalChangeEl = document.querySelector("#kpi-total-change");
        if (totalChangeEl) totalChangeEl.innerHTML = `${firstYear} - ${lastYear} 累计`;
    }

    const typeRes = await api.fetchTopCrimeTypes();
    if (typeRes.length) {
        const topTypeVal = document.querySelector("#kpi-top-type .text-2xl");
        if (topTypeVal) topTypeVal.innerText = typeRes[0].primary_type;
    }
}

async function toggleAnalysis(type, el) {
    const container = document.getElementById('analysis-details-container');
    const title = document.getElementById('analysis-title');
    const content = document.getElementById('analysis-content');
    
    document.querySelectorAll('.nav-tile').forEach(tile => tile.classList.remove('active'));

    if (currentAnalysis === type) {
        closeAnalysis();
        return;
    }

    currentAnalysis = type;
    el.classList.add('active');
    container.classList.remove('hidden');
    
    setTimeout(() => {
        const yOffset = -40; 
        const y = container.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({top: y, behavior: 'smooth'});
    }, 100);

    const configs = {
        weekly: {
            title: "一周犯罪分布详情",
            html: `
                <div class="glass-card p-8 pb-4 xl:col-span-2 flex flex-col">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-lg font-bold text-slate-800">周内犯罪走势分析趋势图</h3>
                        <span class="text-xs text-slate-400 font-medium">单位：件</span>
                    </div>
                    <div id="detail-chart-1" class="h-[380px] w-full mb-6"></div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto mb-4">
                        <div class="p-4 rounded-2xl bg-red-50/50 border border-red-100 flex flex-col items-center justify-center text-center">
                            <div class="text-xs text-red-400 mb-1">案件最多的一天</div>
                            <div id="weekly-peak-day" class="text-lg font-bold text-red-600 leading-snug tabular-nums">--</div>
                        </div>
                        <div class="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex flex-col items-center justify-center text-center">
                            <div class="text-xs text-emerald-400 mb-1">案件最少的一天</div>
                            <div id="weekly-lowest-day" class="text-lg font-bold text-emerald-600 leading-snug tabular-nums">--</div>
                        </div>
                    </div>
                </div>
                <div class="glass-card p-8 flex flex-col gap-6">
                    <h3 class="text-lg font-bold text-slate-800">周内案件逮捕率对比</h3>
                    <div id="detail-chart-2" class="h-[350px] w-full mt-auto mb-auto"></div>
                    <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div class="text-xs text-slate-400 mb-2">趋势提示</div>
                        <p class="text-xs text-slate-600 leading-relaxed">展示了一周内不同日期的案件逮捕比例（逮捕数/案件总数）。通过此折线图可以直观分析在案件多发或少发日期的执法效果差异。</p>
                    </div>
                </div>
                <div class="glass-card p-8 xl:col-span-3">
                    <h3 class="text-lg font-bold text-slate-800 mb-6">一周犯罪数据清单</h3>
                    <div class="overflow-hidden rounded-2xl">
                        <table class="w-full text-left">
                            <thead class="bg-slate-50/50">
                                <tr>
                                    <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase">星期</th>
                                    <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase">案件总量</th>
                                    <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase">占比</th>
                                </tr>
                            </thead>
                            <tbody id="weekly-table-body" class="divide-y divide-slate-100"></tbody>
                        </table>
                    </div>
                </div>
            `,
            action: async () => {
                const res = await api.fetchWeeklyDistribution();
                const data = res.sort((a, b) => parseInt(a.dow) - parseInt(b.dow));
                const draw = () => {
                    charts.drawBarChart("detail-chart-1", data, d => charts.weekdayMap[parseInt(d.dow)], d => d.cnt);
                    charts.drawLineChart("detail-chart-2", data, d => charts.weekdayMap[parseInt(d.dow)], d => +(d.arrest_cnt / d.cnt * 100).toFixed(1), charts.colors.rose, "%", "逮捕率");
                };
                draw();
                charts.registerChart("detail-chart-1", draw);
                charts.registerChart("detail-chart-2", draw);
                
                const total = d3.sum(data, d => d.cnt);
                const peak = data.reduce((a, b) => a.cnt > b.cnt ? a : b);
                const lowest = data.reduce((a, b) => a.cnt < b.cnt ? a : b);
                document.getElementById('weekly-peak-day').innerText = `${charts.weekdayMap[peak.dow]} (${peak.cnt.toLocaleString()} 件)`;
                document.getElementById('weekly-lowest-day').innerText = `${charts.weekdayMap[lowest.dow]} (${lowest.cnt.toLocaleString()} 件)`;
                const tbody = document.getElementById('weekly-table-body');
                tbody.innerHTML = data.map(d => {
                    const percent = (d.cnt / total * 100).toFixed(1) + "%";
                    return `
                        <tr class="hover:bg-slate-50/50 transition-colors">
                            <td class="px-6 py-4 font-bold text-slate-700">${charts.weekdayMap[d.dow]}</td>
                            <td class="px-6 py-4 text-slate-600">${d.cnt.toLocaleString()}</td>
                            <td class="px-6 py-4"><div class="flex items-center gap-2"><div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-indigo-500 rounded-full" style="width: ${percent}"></div></div><span class="text-xs font-medium text-slate-400 w-10">${percent}</span></div></td>
                        </tr>
                    `;
                }).join('');
            }
        },
        hourly: {
            title: "一天犯罪分布详情",
            html: `
                <div class="glass-card p-8 xl:col-span-2">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-lg font-bold text-slate-800">一天犯罪时间分布曲线</h3>
                        <div class="flex gap-4"><span class="flex items-center gap-1 text-xs text-slate-500"><span class="w-3 h-3 rounded-full" style="background-color: #fef08a;"></span> 案件量</span></div>
                    </div>
                    <div id="detail-chart-1" class="h-[450px] w-full"></div>
                </div>
                <div class="glass-card p-8 flex flex-col">
                    <h3 class="text-lg font-bold text-slate-800 mb-6">时段汇总分析</h3>
                    <div id="detail-chart-2" class="h-[250px] w-full mb-6"></div>
                    <div class="space-y-4 mt-auto">
                        <div class="p-5 rounded-2xl bg-gradient-to-br from-rose-50 to-white border border-rose-100 flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-rose-100 text-rose-500 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <div class="text-xs font-bold text-rose-400 uppercase tracking-wider mb-0.5">高危时段</div>
                                    <div class="text-[11px] text-slate-400">22:00 - 02:00</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div id="hourly-danger-val" class="text-xl font-black text-rose-600">--</div>
                            </div>
                        </div>
                        <div class="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-500 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <div>
                                    <div class="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-0.5">相对安全</div>
                                    <div class="text-[11px] text-slate-400">04:00 - 08:00</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div id="hourly-safe-val" class="text-xl font-black text-emerald-600">--</div>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            action: async () => {
                const data = await api.fetchHourlyDistribution();
                data.sort((a, b) => a.hour - b.hour);
                const draw = () => {
                    charts.drawLineChart("detail-chart-1", data, d => `${d.hour}:00`, d => d.cnt, charts.colors.amber);
                    const periods = [
                        { label: "凌晨 (0-6)", cnt: 0, color: "#6366f1" },
                        { label: "上午 (6-12)", cnt: 0, color: "#0ea5e9" },
                        { label: "下午 (12-18)", cnt: 0, color: "#fef08a" },
                        { label: "晚上 (18-24)", cnt: 0, color: "#3ce4c8" }
                    ];
                    data.forEach(d => {
                        if (d.hour < 6) periods[0].cnt += d.cnt;
                        else if (d.hour < 12) periods[1].cnt += d.cnt;
                        else if (d.hour < 18) periods[2].cnt += d.cnt;
                        else periods[3].cnt += d.cnt;
                    });
                    charts.drawDonutChart("detail-chart-2", periods);
                };
                draw();
                charts.registerChart("detail-chart-1", draw);
                charts.registerChart("detail-chart-2", draw);

                const total = d3.sum(data, d => d.cnt);
                const dangerCnt = data.filter(d => d.hour >= 22 || d.hour <= 2).reduce((a, b) => a + b.cnt, 0);
                const safeCnt = data.filter(d => d.hour >= 4 && d.hour <= 8).reduce((a, b) => a + b.cnt, 0);
                document.getElementById('hourly-danger-val').innerText = `${(dangerCnt/total*100).toFixed(1)}% 的案件发生于此`;
                document.getElementById('hourly-safe-val').innerText = `仅占总案件的 ${(safeCnt/total*100).toFixed(1)}%`;
            }
        },
        district: {
            title: "警区案件排行详情",
            html: `
                <div class="glass-card p-8 xl:col-span-2">
                    <div class="flex items-start justify-between gap-4 mb-6">
                        <div class="flex flex-col gap-2"><h3 class="text-lg font-bold text-slate-800">各警区案件分布地图</h3><p class="text-sm text-slate-500">按警区边界进行着色，颜色越深表示该警区案件总量越高。</p></div>
                        <div class="min-w-[180px]">
                            <div class="text-[11px] text-slate-400 mb-1.5">犯罪类型</div>
                            <select id="district-type-select" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"></select>
                        </div>
                    </div>
                    <div id="detail-chart-1" class="h-[600px] w-full"></div>
                </div>
                <div class="glass-card p-8">
                    <div class="district-focus-card p-4 rounded-3xl mb-6"><div id="district-focus-card"></div></div>
                    <div class="flex items-center justify-between gap-4 mb-6"><h3 class="text-lg font-bold text-slate-800">警区案件热度排行</h3><span class="text-xs font-semibold text-slate-400">悬停或点击地图即可跟随</span></div>
                    <div id="district-top-list" class="space-y-4 max-h-[420px] overflow-y-auto pr-2"></div>
                </div>
            `,
            action: async () => {
                await renderCrimeTypeSelect("district-type-select", "ALL");
                const select = document.getElementById("district-type-select");
                const geojson = await api.fetchGeoJSON();
                const districtNameMap = new Map((geojson?.features || []).map(feature => [String(feature.properties?.district || "").trim().replace(/^0+/, ''), String(feature.properties?.district_name || "").trim()]));

                const renderByType = async (primaryType = "ALL") => {
                    const data = await api.fetchDistrictCrimes(primaryType);
                    const districtData = (data || []).map(item => {
                        const dId = String(item.district).trim().replace(/^0+/, '');
                        return {...item, district: dId, district_name: districtNameMap.get(dId) || `警区 ${dId}`, cnt: Number(item.cnt)};
                    }).filter(item => item.district && Number.isFinite(item.cnt)).sort((a, b) => b.cnt - a.cnt);

                    let lockedDistrict = null, hoverDistrict = null;
                    const syncState = () => {
                        const active = hoverDistrict || lockedDistrict;
                        charts.setDistrictFollowState("detail-chart-1", "district-top-list", active, lockedDistrict);
                        charts.renderDistrictFocus("district-focus-card", districtData, active, "cnt", "案件总数");
                    };

                    const draw = () => {
                        charts.drawDistrictChoroplethMap("detail-chart-1", geojson, districtData, "cnt", "案件总量", {
                            onHover: d => { hoverDistrict = d; syncState(); },
                            onLeave: () => { hoverDistrict = null; syncState(); },
                            onSelect: d => { lockedDistrict = d; syncState(); }
                        });
                        charts.renderDistrictRanking("district-top-list", districtData, "cnt", "案件总数", {
                            limit: 10,
                            onHover: d => { hoverDistrict = d; syncState(); },
                            onLeave: () => { hoverDistrict = null; syncState(); },
                            onSelect: d => { lockedDistrict = d; syncState(); }
                        });
                        syncState();
                    };
                    draw();
                    charts.registerChart("detail-chart-1", draw);
                };
                await renderByType("ALL");
                if (select) {
                    select.onchange = async () => {
                        await renderByType(select.value || "ALL");
                    };
                }
            }
        },
        structure: {
            title: "犯罪类型结构性变化",
            html: `
                <div class="glass-card p-8 xl:col-span-3">
                    <h3 class="text-lg font-bold text-slate-800 mb-6">犯罪类型结构对比</h3>
                    <div id="detail-chart-1" class="h-[600px] w-full"></div>
                </div>
            `,
            action: async () => {
                const data = await api.fetchCrimeStructureChange();
                const draw = () => charts.drawButterflyChart("detail-chart-1", data);
                draw();
                charts.registerChart("detail-chart-1", draw);
            }
        },
        domestic: {
            title: "家暴案件趋势深度分析",
            html: `
                <div class="xl:col-span-3 grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div class="glass-card p-8 flex flex-col">
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <h3 class="text-lg font-bold text-slate-800">历年家暴案件数量趋势</h3>
                                <p class="text-sm text-slate-400">展示家暴案件随年份变化的绝对数量波动</p>
                            </div>
                            <div class="flex gap-4">
                                <span class="flex items-center gap-1 text-xs text-slate-500">
                                    <span class="w-3 h-3 bg-rose-500 rounded-full"></span> 家暴案件数
                                </span>
                            </div>
                        </div>
                        <div id="detail-chart-1" class="h-[400px] w-full"></div>
                    </div>
                    <div class="glass-card p-8 flex flex-col">
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <h3 class="text-lg font-bold text-slate-800">家暴案件同比增减</h3>
                                <p class="text-sm text-slate-400">展示各年份家暴案件数量较上一年的变化情况</p>
                            </div>
                            <div class="flex gap-4">
                                <span class="flex items-center gap-1 text-xs text-slate-500">
                                    <span class="w-3 h-3 bg-rose-500 rounded-full"></span> 增长
                                </span>
                                <span class="flex items-center gap-1 text-xs text-slate-500">
                                    <span class="w-3 h-3 bg-emerald-500 rounded-full"></span> 减少
                                </span>
                            </div>
                        </div>
                        <div id="detail-chart-2" class="h-[400px] w-full"></div>
                    </div>
                </div>
            `,
            action: async () => {
                const trendData = await api.fetchDomesticTrend();
                if (!trendData || trendData.length === 0) return;

                // 计算同比变动
                const yoyData = trendData.map((d, i) => {
                    if (i === 0) return { ...d, diff: 0, diff_percent: 0 };
                    const diff = d.domestic_cnt - trendData[i-1].domestic_cnt;
                    const diff_percent = ((diff / trendData[i-1].domestic_cnt) * 100).toFixed(1);
                    return { ...d, diff, diff_percent: parseFloat(diff_percent) };
                }).slice(1); // 移除第一年，因为它没有对比项

                const draw = () => {
                    // 绘制家暴案件数量趋势
                    charts.drawLineChart("detail-chart-1", trendData, d => d.year, d => d.domestic_cnt, charts.colors.rose, " 宗");
                    // 绘制同比增减图
                    charts.drawYoYChart("detail-chart-2", yoyData, d => d.year, d => d.diff);
                };
                draw();
                charts.registerChart("detail-chart-1", draw);
                charts.registerChart("detail-chart-2", draw);
            }
        },
        locations: {
            title: "高危案发场所详情",
            html: `
                <div class="glass-card p-8 xl:col-span-2">
                    <div class="flex items-start justify-between gap-4 mb-6">
                        <h3 class="text-lg font-bold text-slate-800">Top 10 犯罪高发场所类型</h3>
                        <div class="min-w-[180px]">
                            <div class="text-[11px] text-slate-400 mb-1.5">犯罪类型</div>
                            <select id="location-type-select" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"></select>
                        </div>
                    </div>
                    <div id="detail-chart-1" class="h-[500px] w-full"></div>
                </div>
                <div class="glass-card p-8 flex flex-col"><h3 class="text-lg font-bold text-slate-800 mb-6">场所类型风险评估</h3><div id="location-risk-list" class="flex-1 space-y-3 overflow-y-auto max-h-[450px] pr-2"></div></div>
            `,
            action: async () => {
                await renderCrimeTypeSelect("location-type-select", "ALL");
                const select = document.getElementById("location-type-select");

                const renderByType = async (primaryType = "ALL") => {
                    const data = await api.fetchTopLocations(primaryType);
                    const draw = () => charts.drawHorizontalBarChart("detail-chart-1", data, d => d.location_description, d => d.cnt, charts.colors.amber, { left: 260, right: 80 });
                    draw();
                    charts.registerChart("detail-chart-1", draw);
                    const total = d3.sum(data, d => d.cnt);
                    const list = document.getElementById('location-risk-list');
                    list.innerHTML = data.map(d => {
                        const percent = total ? (d.cnt / total * 100).toFixed(1) + "%" : "0.0%";
                        return `<div class="group p-4 rounded-2xl bg-slate-50 border border-transparent hover:border-yellow-200 hover:bg-yellow-50/30 transition-all cursor-default"><div class="flex justify-between items-center mb-2"><span class="text-sm font-bold text-slate-700 group-hover:text-yellow-700 transition-colors">${d.location_description}</span><span class="text-xs font-bold text-slate-400">${d.cnt.toLocaleString()}</span></div><div class="flex items-center gap-3"><div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div class="h-full" style="background-color: #fef08a; width: ${percent}"></div></div><span class="text-[10px] font-black text-slate-400 w-8">${percent}</span></div></div>`;
                    }).join('');
                };
                await renderByType("ALL");
                if (select) {
                    select.onchange = async () => {
                        await renderByType(select.value || "ALL");
                    };
                }
            }
        },
        monthly: {
            title: "月度季节性规律详情",
            html: `
                <div class="glass-card p-8 xl:col-span-2"><h3 class="text-lg font-bold text-slate-800 mb-6">全年度犯罪月度波动趋势</h3><div id="detail-chart-1" class="h-[450px] w-full"></div></div>
                <div class="glass-card p-8 flex flex-col justify-center"><h3 class="text-lg font-bold text-slate-800 mb-6">季度特征概览</h3><div class="grid grid-cols-1 gap-4"><div class="flex items-center gap-4 p-4 rounded-2xl bg-sky-50/50 border border-sky-100"><div class="w-10 h-10 flex items-center justify-center rounded-full bg-sky-100 text-sky-600"><svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div><div class="flex-1"><div class="text-xs text-sky-400">第一季度 (Q1)</div><div id="q1-val" class="text-lg font-bold text-sky-700">--</div></div></div><div class="flex items-center gap-4 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100"><div class="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></div><div class="flex-1"><div class="text-xs text-emerald-400">第二季度 (Q2)</div><div id="q2-val" class="text-lg font-bold text-emerald-700">--</div></div></div><div class="flex items-center gap-4 p-4 rounded-2xl bg-yellow-50/50 border border-yellow-100"><div class="w-10 h-10 flex items-center justify-center rounded-full bg-yellow-100 text-yellow-600"><svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg></div><div class="flex-1"><div class="text-xs text-yellow-400">第三季度 (Q3)</div><div id="q3-val" class="text-lg font-bold text-yellow-700">--</div></div></div><div class="flex items-center gap-4 p-4 rounded-2xl bg-rose-50/50 border border-rose-100"><div class="w-10 h-10 flex items-center justify-center rounded-full bg-rose-100 text-rose-600"><svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></div><div class="flex-1"><div class="text-xs text-rose-400">第四季度 (Q4)</div><div id="q4-val" class="text-lg font-bold text-rose-700">--</div></div></div></div></div>
            `,
            action: async () => {
                const data = await api.fetchMonthlyTrend();
                const mNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
                const draw = () => charts.drawLineChart("detail-chart-1", data, d => mNames[d.month - 1], d => d.cnt, charts.colors.sky);
                draw();
                charts.registerChart("detail-chart-1", draw);
                const q1 = data.filter(d => d.month <= 3).reduce((a, b) => a + b.cnt, 0);
                const q2 = data.filter(d => d.month > 3 && d.month <= 6).reduce((a, b) => a + b.cnt, 0);
                const q3 = data.filter(d => d.month > 6 && d.month <= 9).reduce((a, b) => a + b.cnt, 0);
                const q4 = data.filter(d => d.month > 9).reduce((a, b) => a + b.cnt, 0);
                document.getElementById('q1-val').innerText = q1.toLocaleString() + " 件";
                document.getElementById('q2-val').innerText = q2.toLocaleString() + " 件";
                document.getElementById('q3-val').innerText = q3.toLocaleString() + " 件";
                document.getElementById('q4-val').innerText = q4.toLocaleString() + " 件";
            }
        },
        theft: {
            title: "盗窃地区专项分析",
            html: `
                <div class="glass-card p-8 xl:col-span-2">
                    <div class="flex items-start justify-between gap-4 mb-6">
                        <div class="flex flex-col gap-2"><h3 class="text-lg font-bold text-slate-800">各警区地区分区地图</h3><p class="text-sm text-slate-500">按警区边界进行着色，颜色越深表示该警区该类型案发量越高。</p></div>
                        <div class="min-w-[180px]">
                            <div class="text-[11px] text-slate-400 mb-1.5">犯罪类型</div>
                            <select id="theft-type-select" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"></select>
                        </div>
                    </div>
                    <div id="detail-chart-1" class="h-[600px] w-full"></div>
                </div>
                <div class="glass-card p-8">
                    <div class="theft-focus-card p-4 rounded-3xl mb-6"><div id="theft-focus-card"></div></div>
                    <div class="flex items-center justify-between gap-4 mb-6"><h3 class="text-lg font-bold text-slate-800">高发警区排行</h3><span class="text-xs font-semibold text-slate-400">悬停或点击地图即可跟随</span></div>
                    <div id="theft-top-list" class="space-y-4 max-h-[420px] overflow-y-auto pr-2"></div>
                </div>
            `,
            action: async () => {
                await renderCrimeTypeSelect("theft-type-select", "THEFT");
                const select = document.getElementById("theft-type-select");
                const geojson = await api.fetchGeoJSON();
                const districtNameMap = new Map((geojson?.features || []).map(feature => [String(feature.properties?.district || "").trim().replace(/^0+/, ''), String(feature.properties?.district_name || "").trim()]));

                const renderByType = async (primaryType = "THEFT") => {
                    const data = await api.fetchTheftByDistrict(primaryType);
                    const theftData = (data || []).map(item => {
                        const dId = String(item.district).trim().replace(/^0+/, '');
                        return {...item, district: dId, district_name: districtNameMap.get(dId) || `警区 ${dId}`, theft_cnt: Number(item.theft_cnt)};
                    }).filter(item => item.district && Number.isFinite(item.theft_cnt)).sort((a, b) => b.theft_cnt - a.theft_cnt);

                    let lockedDistrict = null, hoverDistrict = null;
                    const syncState = () => {
                        const active = hoverDistrict || lockedDistrict;
                        charts.setDistrictFollowState("detail-chart-1", "theft-top-list", active, lockedDistrict);
                        charts.renderDistrictFocus("theft-focus-card", theftData, active, "theft_cnt", "案件总数");
                    };

                    const draw = () => {
                        charts.drawDistrictChoroplethMap("detail-chart-1", geojson, theftData, "theft_cnt", "案件总量", {
                            onHover: d => { hoverDistrict = d; syncState(); },
                            onLeave: () => { hoverDistrict = null; syncState(); },
                            onSelect: d => { lockedDistrict = d; syncState(); }
                        });
                        charts.renderDistrictRanking("theft-top-list", theftData, "theft_cnt", "案件总数", {
                            limit: 10,
                            onHover: d => { hoverDistrict = d; syncState(); },
                            onLeave: () => { hoverDistrict = null; syncState(); },
                            onSelect: d => { lockedDistrict = d; syncState(); }
                        });
                        syncState();
                    };
                    draw();
                    charts.registerChart("detail-chart-1", draw);
                };
                await renderByType("THEFT");
                if (select) {
                    select.onchange = async () => {
                        await renderByType(select.value || "THEFT");
                    };
                }
            }
        },
        concentration: {
            title: "案件空间集中度分析",
            html: `
                <div class="glass-card p-8 xl:col-span-2 flex flex-col">
                    <div class="flex items-start justify-between gap-4 mb-6">
                        <div>
                            <h3 class="text-lg font-bold text-slate-800">警区案件集中度洛伦兹曲线</h3>
                            <p class="text-sm text-slate-500 mt-1">偏离均等线越明显，表示案件在少数警区越集中。</p>
                        </div>
                        <div class="min-w-[180px]">
                            <div class="text-[11px] text-slate-400 mb-1.5">犯罪类型</div>
                            <select id="concentration-type-select" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"></select>
                        </div>
                    </div>
                    <div id="detail-chart-1" class="h-[520px] w-full"></div>
                </div>
                <div class="glass-card p-8 flex flex-col">
                    <h3 class="text-lg font-bold text-slate-800 mb-6">集中度指标</h3>
                    <div class="flex-1 flex flex-col justify-center space-y-4">
                        <div class="p-4 rounded-2xl" style="background-color: #f5c4cb;">
                            <div class="text-xs text-rose-800 mb-1">Gini 系数</div>
                            <div id="concentration-gini" class="text-2xl font-black text-rose-900">--</div>
                        </div>
                        <div class="p-4 rounded-2xl" style="background-color: #9ee5c9;">
                            <div class="text-xs text-teal-800 mb-1">Top 20%警区案件占比</div>
                            <div id="concentration-top20" class="text-2xl font-black text-teal-900">--</div>
                        </div>
                        <div class="p-4 rounded-2xl" style="background-color: #fef08a;">
                            <div class="text-xs text-yellow-800 mb-1">参与统计警区数</div>
                            <div id="concentration-count" class="text-2xl font-black text-yellow-900">--</div>
                        </div>
                    </div>
                </div>
            `,
            action: async () => {
                await renderCrimeTypeSelect("concentration-type-select", "ALL");
                const select = document.getElementById("concentration-type-select");
                const geojson = await api.fetchGeoJSON();
                const districtNameMap = new Map((geojson?.features || []).map(feature => [String(feature.properties?.district || "").trim().replace(/^0+/, ''), String(feature.properties?.district_name || "").trim()]));
                const renderByType = async (primaryType = "ALL") => {
                    const data = await api.fetchDistrictCrimes(primaryType);
                    const districtData = (data || []).map(item => {
                        const dId = String(item.district).trim().replace(/^0+/, '');
                        return {...item, district: dId, district_name: districtNameMap.get(dId) || `警区 ${dId}`, cnt: Number(item.cnt)};
                    }).filter(item => item.district && Number.isFinite(item.cnt)).sort((a, b) => b.cnt - a.cnt);
                    const draw = () => charts.drawLorenzCurve("detail-chart-1", districtData, "cnt");
                    const metrics = draw();
                    charts.registerChart("detail-chart-1", draw);
                    document.getElementById("concentration-gini").innerText = metrics.gini.toFixed(3);
                    document.getElementById("concentration-top20").innerText = `${(metrics.top20Share * 100).toFixed(1)}%`;
                    document.getElementById("concentration-count").innerText = `${metrics.districtCount} 个`;
                };
                await renderByType("ALL");
                if (select) {
                    select.onchange = async () => {
                        await renderByType(select.value || "ALL");
                    };
                }
            }
        },
        crosstab: {
            title: "案件类型月度分布热力图",
            html: `
                <div class="glass-card p-8 xl:col-span-2">
                    <div class="flex items-start justify-between gap-4 mb-6">
                        <div class="flex flex-col gap-2">
                            <h3 class="text-lg font-bold text-slate-800">各类型案件月度分布情况</h3>
                            <p class="text-sm text-slate-500">横轴为月份，纵轴为犯罪类型，颜色越深表示该类型在该月份的案件量越高。</p>
                        </div>
                        <div class="min-w-[180px]">
                            <div class="text-[11px] text-slate-400 mb-1.5">犯罪类型</div>
                            <select id="crosstab-type-select" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"></select>
                        </div>
                    </div>
                    <div id="detail-chart-1" class="h-[500px] w-full"></div>
                </div>
                <div class="glass-card p-8">
                    <h3 class="text-lg font-bold text-slate-800 mb-6">分析洞察</h3>
                    <div id="crosstab-insights" class="space-y-4"></div>
                </div>
            `,
            action: async () => {
                const rawData = await api.fetchCrimeTypeByMonth();
                if (!rawData || rawData.length === 0) return;

                const TOP_N = 10;
                const crimeTypeTotals = {};
                rawData.forEach(d => {
                    crimeTypeTotals[d.primary_type] = (crimeTypeTotals[d.primary_type] || 0) + d.cnt;
                });
                const topTypes = Object.entries(crimeTypeTotals)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, TOP_N)
                    .map(([type]) => type);

                const baseData = rawData
                    .filter(d => topTypes.includes(d.primary_type))
                    .map(d => ({ ...d, month: parseInt(d.month) }));

                const select = document.getElementById("crosstab-type-select");
                if (select) {
                    select.innerHTML = `<option value="ALL">全部类型</option>${topTypes.map(type => `<option value="${type}">${type}</option>`).join("")}`;
                }

                const renderByType = (selectedType = "ALL") => {
                    const data = selectedType === "ALL" ? baseData : baseData.filter(d => d.primary_type === selectedType);
                    const draw = () => charts.drawHeatmap("detail-chart-1", data, "month", "primary_type", "cnt");
                    draw();
                    charts.registerChart("detail-chart-1", draw);

                    const typesForInsight = selectedType === "ALL" ? topTypes.slice(0, 5) : [selectedType];
                    const insights = [];
                    typesForInsight.forEach(type => {
                        const typeData = baseData.filter(d => d.primary_type === type);
                        if (!typeData.length) return;
                        const peak = typeData.reduce((a, b) => a.cnt > b.cnt ? a : b);
                        const low = typeData.reduce((a, b) => a.cnt < b.cnt ? a : b);
                        const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
                        insights.push({
                            type,
                            peakMonth: monthNames[parseInt(peak.month) - 1],
                            peakCnt: peak.cnt,
                            lowMonth: monthNames[parseInt(low.month) - 1],
                            lowCnt: low.cnt
                        });
                    });
                    const insightsEl = document.getElementById('crosstab-insights');
                    insightsEl.innerHTML = insights.map(item => `
                        <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <div class="text-xs font-bold text-indigo-500 mb-2">${item.type}</div>
                            <div class="flex items-center gap-2 text-xs text-slate-600">
                                <span class="text-rose-500">●</span> 高峰: ${item.peakMonth} (${item.peakCnt.toLocaleString()}件)
                            </div>
                            <div class="flex items-center gap-2 text-xs text-slate-600 mt-1">
                                <span class="text-emerald-500">●</span> 低谷: ${item.lowMonth} (${item.lowCnt.toLocaleString()}件)
                            </div>
                        </div>
                    `).join('');
                };
                renderByType("ALL");
                if (select) {
                    select.onchange = () => renderByType(select.value || "ALL");
                }
            }
        }
    };

    const config = configs[type];
    title.innerHTML = config.title;
    content.innerHTML = config.html;
    await config.action();
}

function closeAnalysis() {
    document.getElementById('analysis-details-container').classList.add('hidden');
    document.querySelectorAll('.nav-tile').forEach(tile => tile.classList.remove('active'));
    currentAnalysis = null;
}

// 暴露函数到全局，供 HTML onclick 使用
window.toggleAnalysis = toggleAnalysis;
window.closeAnalysis = closeAnalysis;

window.onload = async () => {
    await loadKPI();
    const drawTrend = () => charts.drawAreaChart('yearly-trend', '/api/yearly_trend', 'year', 'cnt', charts.colors.emerald);
    const drawPie = () => charts.drawPieChart('pie-chart', '/api/top_crime_types');
    drawTrend();
    drawPie();
    charts.registerChart('yearly-trend', drawTrend);
    charts.registerChart('pie-chart', drawPie);
};
