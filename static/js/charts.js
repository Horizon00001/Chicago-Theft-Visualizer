// 图表绘制模块
export const colors = {
    indigo: "#6366f1", purple: "#a855f7", rose: "#f43f5e", sky: "#0ea5e9",
    amber: "#f59e0b", emerald: "#10b981", slate: "#64748b", grid: "#f1f5f9"
};

export const weekdayMap = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function showTooltip(html, x, y) {
    const tooltip = d3.select("#tooltip");
    tooltip.style("opacity", 1).html(html).style("left", (x + 15) + "px").style("top", (y - 15) + "px");
}

export function hideTooltip() {
    d3.select("#tooltip").style("opacity", 0);
}

// 自动重绘所有图表的辅助函数
const chartRegistry = new Map();
window.addEventListener('resize', () => {
    chartRegistry.forEach((fn, id) => {
        const container = document.getElementById(id);
        if (container && !container.classList.contains('hidden')) {
            fn();
        }
    });
});

export function registerChart(id, drawFn) {
    chartRegistry.set(id, drawFn);
}

export function drawBarChart(containerId, data, xAccessor, yAccessor) {
    const container = d3.select(`#${containerId}`);
    container.selectAll("*").remove();
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    const margin = {top: 30, right: 30, bottom: 30, left: 70};
    const IW = width - margin.left - margin.right;
    const IH = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(data.map(xAccessor)).range([0, IW]).padding(0.4);
    const y = d3.scaleLinear().domain([0, d3.max(data, yAccessor) * 1.1]).range([IH, 0]);

    const gradId = `grad-${containerId}`;
    const defs = svg.append("defs");
    const barGrad = defs.append("linearGradient").attr("id", gradId).attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
    barGrad.append("stop").attr("offset", "0%").attr("stop-color", "#14b8a6");
    barGrad.append("stop").attr("offset", "100%").attr("stop-color", "#10b981");

    svg.append("g").attr("class", "grid-lines").call(d3.axisLeft(y).ticks(5).tickSize(-IW).tickFormat("")).selectAll(".tick line").attr("stroke", "#f1f5f9").attr("stroke-dasharray", "4,4");
    
    svg.selectAll(".bar").data(data).enter().append("rect").attr("class", "bar")
        .attr("x", d => x(xAccessor(d))).attr("y", IH).attr("width", x.bandwidth()).attr("height", 0).attr("rx", 6).attr("fill", `url(#${gradId})`)
        .on("mouseover", (e, d) => showTooltip(`<b>${xAccessor(d)}</b><br/>案件数: ${yAccessor(d).toLocaleString()}`, e.pageX, e.pageY))
        .on("mouseout", hideTooltip)
        .transition().duration(800).delay((d, i) => i * 50).attr("y", d => y(yAccessor(d))).attr("height", d => IH - y(yAccessor(d)));

    svg.append("g").attr("transform", `translate(0,${IH})`).call(d3.axisBottom(x).tickSize(0).tickPadding(10)).style("color", "#64748b");
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(15)).style("color", "#64748b");
    svg.selectAll(".domain").remove();
}

export function drawLineChart(containerId, data, xAccessor, yAccessor, color, unit = "") {
    const container = d3.select(`#${containerId}`);
    container.selectAll("*").remove();
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    const margin = {top: 40, right: 50, bottom: 35, left: 70};
    const IW = width - margin.left - margin.right;
    const IH = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint().domain(data.map(xAccessor)).range([0, IW]);
    const y = d3.scaleLinear().domain([0, d3.max(data, yAccessor) * 1.15]).range([IH, 0]);

    const line = d3.line().x(d => x(xAccessor(d))).y(d => y(yAccessor(d))).curve(d3.curveMonotoneX);
    const area = d3.area().x(d => x(xAccessor(d))).y0(IH).y1(d => y(yAccessor(d))).curve(d3.curveMonotoneX);

    const gradId = `grad-line-${containerId}`;
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", gradId).attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.3);
    grad.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0);

    svg.append("path").datum(data).attr("fill", `url(#${gradId})`).attr("d", area);
    const path = svg.append("path").datum(data).attr("fill", "none").attr("stroke", color).attr("stroke-width", 3.5).attr("d", line);
    const length = path.node().getTotalLength();
    path.attr("stroke-dasharray", length).attr("stroke-dashoffset", length).transition().duration(1500).attr("stroke-dashoffset", 0);

    const peakData = data.reduce((prev, curr) => (yAccessor(prev) > yAccessor(curr)) ? prev : curr);
    const valleyData = data.reduce((prev, curr) => (yAccessor(prev) < yAccessor(curr)) ? prev : curr);

    const peakGroup = svg.append("g").attr("class", "peak-mark").style("opacity", 0);
    peakGroup.append("circle").attr("cx", x(xAccessor(peakData))).attr("cy", y(yAccessor(peakData))).attr("r", 8).attr("fill", "none").attr("stroke", "#ef4444").attr("stroke-width", 2).attr("class", "animate-ping");
    peakGroup.append("text").attr("x", x(xAccessor(peakData))).attr("y", y(yAccessor(peakData)) - 15).attr("text-anchor", "middle").attr("fill", "#ef4444").attr("font-size", "10px").attr("font-weight", "bold").text("发案高峰");
    peakGroup.transition().delay(1600).duration(500).style("opacity", 1);

    const valleyGroup = svg.append("g").attr("class", "valley-mark").style("opacity", 0);
    valleyGroup.append("circle").attr("cx", x(xAccessor(valleyData))).attr("cy", y(yAccessor(valleyData))).attr("r", 8).attr("fill", "none").attr("stroke", "#10b981").attr("stroke-width", 2).attr("class", "animate-ping");
    valleyGroup.append("text").attr("x", x(xAccessor(valleyData))).attr("y", y(yAccessor(valleyData)) + 25).attr("text-anchor", "middle").attr("fill", "#10b981").attr("font-size", "10px").attr("font-weight", "bold").text("发案低谷");
    valleyGroup.transition().delay(1800).duration(500).style("opacity", 1);

    const dots = svg.selectAll(".dot").data(data).enter().append("circle").attr("cx", d => x(xAccessor(d))).attr("cy", d => y(yAccessor(d))).attr("r", 0).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 2).style("cursor", "pointer");
    dots.transition().delay((d, i) => i * 30).duration(500).attr("r", 5);

    const vlineGroup = svg.append("g").style("display", "none");
    vlineGroup.append("line").attr("stroke", "#cbd5e1").attr("stroke-width", 1).attr("stroke-dasharray", "4,4").attr("y1", 0).attr("y2", IH);
    const highlightCircle = vlineGroup.append("circle").attr("r", 7).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 2);

    svg.append("rect").attr("width", IW).attr("height", IH).attr("fill", "transparent").style("pointer-events", "all")
        .on("mousemove", function(e) {
            const mouseX = d3.pointer(e)[0];
            const domain = x.domain();
            const range = x.range();
            const step = (range[1] - range[0]) / (domain.length - 1);
            const index = Math.round((mouseX - range[0]) / step);
            const d = data[index];
            if (d) {
                const cx = x(xAccessor(d));
                const cy = y(yAccessor(d));
                vlineGroup.style("display", null).select("line").attr("x1", cx).attr("x2", cx);
                highlightCircle.attr("cx", cx).attr("cy", cy);
                showTooltip(`<b>${xAccessor(d)}</b><br/>案件数: ${yAccessor(d).toLocaleString()}${unit}`, e.pageX, e.pageY);
            }
        })
        .on("mouseout", () => { vlineGroup.style("display", "none"); hideTooltip(); });

    svg.append("g").attr("transform", `translate(0,${IH})`).call(d3.axisBottom(x).tickSize(0).tickPadding(15)).style("color", "#64748b");
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(15)).style("color", "#64748b");
    svg.selectAll(".domain").remove();
}

export function drawYoYChart(containerId, data, xAccessor, yAccessor) {
    const container = d3.select(`#${containerId}`);
    container.selectAll("*").remove();
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    const margin = {top: 30, right: 30, bottom: 40, left: 70};
    const IW = width - margin.left - margin.right;
    const IH = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const yMin = d3.min(data, yAccessor);
    const yMax = d3.max(data, yAccessor);
    const yLimit = Math.max(Math.abs(yMin), Math.abs(yMax)) * 1.2;
    
    const x = d3.scaleBand().domain(data.map(xAccessor)).range([0, IW]).padding(0.4);
    const y = d3.scaleLinear().domain([-yLimit, yLimit]).range([IH, 0]);

    svg.append("g").attr("class", "grid-lines").call(d3.axisLeft(y).ticks(5).tickSize(-IW).tickFormat("")).selectAll(".tick line").attr("stroke", "#f1f5f9").attr("stroke-dasharray", "4,4");
    
    // 零线
    svg.append("line").attr("x1", 0).attr("x2", IW).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "#cbd5e1").attr("stroke-width", 1);

    svg.selectAll(".bar").data(data).enter().append("rect").attr("class", "bar")
        .attr("x", d => x(xAccessor(d)))
        .attr("y", d => y(Math.max(0, yAccessor(d))))
        .attr("width", x.bandwidth())
        .attr("height", d => Math.abs(y(yAccessor(d)) - y(0)))
        .attr("rx", 4)
        .attr("fill", d => yAccessor(d) >= 0 ? "#f43f5e" : "#10b981")
        .on("mouseover", (e, d) => showTooltip(`<b>${xAccessor(d)}</b><br/>较去年: ${yAccessor(d) > 0 ? '+' : ''}${yAccessor(d).toLocaleString()} 件`, e.pageX, e.pageY))
        .on("mouseout", hideTooltip);

    svg.append("g").attr("transform", `translate(0,${IH})`).call(d3.axisBottom(x).tickSize(0).tickPadding(10)).style("color", "#64748b")
        .selectAll("text").attr("transform", "rotate(-45)").style("text-anchor", "end");
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d => (d > 0 ? "+" : "") + d).tickSize(0).tickPadding(15)).style("color", "#64748b");
    svg.selectAll(".domain").remove();
}

export function drawHorizontalBarChart(containerId, data, xAccessor, yAccessor, color, customMargin = {}) {
    const container = d3.select(`#${containerId}`);
    container.selectAll("*").remove();
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    const margin = {top: 20, right: 100, bottom: 20, left: 140, ...customMargin};
    const IW = width - margin.left - margin.right;
    const IH = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand().domain(data.map(xAccessor)).range([0, IH]).padding(0.3);
    const x = d3.scaleLinear().domain([0, d3.max(data, yAccessor)]).range([0, IW]);

    svg.selectAll(".bar").data(data).enter().append("rect").attr("y", d => y(xAccessor(d))).attr("x", 0).attr("height", y.bandwidth()).attr("width", 0).attr("rx", 4).attr("fill", color)
        .transition().duration(800).delay((d, i) => i * 40).attr("width", d => x(yAccessor(d)));

    svg.selectAll(".label").data(data).enter().append("text").attr("x", d => x(yAccessor(d)) + 10).attr("y", d => y(xAccessor(d)) + y.bandwidth()/2 + 5).text(d => yAccessor(d).toLocaleString()).style("font-size", "12px").style("fill", "#64748b");

    svg.append("g").call(d3.axisLeft(y).tickSize(0).tickPadding(10)).style("font-size", "13px").style("color", "#475569");
    svg.selectAll(".domain").remove();
}

export function drawDonutChart(containerId, data, options = {}) {
    const container = d3.select(`#${containerId}`);
    container.selectAll("*").remove();
    const width = container.node().clientWidth || 300;
    const height = container.node().clientHeight || 300;
    const radius = Math.min(width, height) / 2;

    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const pie = d3.pie().value(d => d.cnt).sort(null).padAngle(0.04);
    const arc = d3.arc().innerRadius(radius * 0.65).outerRadius(radius * 0.9).cornerRadius(12);
    const arcHover = d3.arc().innerRadius(radius * 0.6).outerRadius(radius * 0.95).cornerRadius(12);

    const arcs = svg.selectAll(".arc-group").data(pie(data)).enter().append("g").attr("class", "arc-group");

    const paths = arcs.append("path").attr("d", arc).attr("fill", d => d.data.color).style("cursor", "pointer").style("filter", "drop-shadow(0 4px 6px rgba(0,0,0,0.1))")
        .on("mouseover", (e, d) => {
            const total = d3.sum(data, x => x.cnt);
            const percent = (d.data.cnt / total * 100).toFixed(1);
            showTooltip(`<b>${d.data.label}</b><br/>总数: ${d.data.cnt.toLocaleString()}<br/>比例: ${percent}%`, e.pageX, e.pageY);
            d3.select(e.currentTarget).transition().duration(400).ease(d3.easeElastic).attr("d", arcHover).style("opacity", 0.9);
        })
        .on("mouseout", (e, d) => {
            hideTooltip();
            d3.select(e.currentTarget).transition().duration(400).attr("d", arc).style("opacity", 1);
        });

    paths.transition().duration(1200).delay((d, i) => i * 150).attrTween("d", function(d) {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function(t) { return arc(interpolate(t)); };
    });

    const total = d3.sum(data, x => x.cnt);
    const centerLabel = options.centerLabel || data[0].label;
    const centerValue = options.centerValue || (data[0].cnt / total * 100).toFixed(0) + "%";

    const textGroup = svg.append("g").attr("text-anchor", "middle");
    textGroup.append("text").attr("y", -10).style("font-size", "14px").style("font-weight", "500").style("fill", "#94a3b8").text(centerLabel);
    textGroup.append("text").attr("y", 25).style("font-size", "32px").style("font-weight", "900").style("fill", "#1e293b").style("letter-spacing", "-0.025em").text(centerValue);
}

export function drawDistrictChoroplethMap(containerId, geojson, data, valueKey, valueLabel, options = {}) {
    const container = d3.select(`#${containerId}`);
    container.selectAll("*").remove();

    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");

    svg.append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height).attr("rx", 28).attr("fill", "#f8fafc");

    const features = (geojson?.features || []).filter(feature => feature.geometry);
    const dataMap = new Map((data || []).map(item => [String(item.district).trim().replace(/^0+/, ''), Number(item[valueKey])]));
    const dataValues = [...dataMap.values()].filter(value => Number.isFinite(value));

    if (!features.length || !dataValues.length) {
        svg.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle").style("fill", "#64748b").style("font-size", "16px").text("暂无可用的警区地图数据");
        return;
    }

    const featureCollection = { type: "FeatureCollection", features };
    const projection = d3.geoMercator().fitExtent([[40, 30], [width - 190, height - 30]], featureCollection);
    const path = d3.geoPath(projection);
    const [minValue, maxValue] = d3.extent(dataValues);
    const colorScale = d3.scaleSequential(d3.interpolatePuRd).domain([minValue, maxValue]);
    const labelFeatures = features.map(feature => ({
        feature,
        district: String(feature.properties?.district || "").trim().replace(/^0+/, ''),
        value: dataMap.get(String(feature.properties?.district || "").trim().replace(/^0+/, '')) || 0,
        centroid: path.centroid(feature)
    })).filter(item => Number.isFinite(item.centroid[0]) && Number.isFinite(item.centroid[1]));

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient").attr("id", `legend-gradient-${containerId}`).attr("x1", "0%").attr("y1", "100%").attr("x2", "0%").attr("y2", "0%");
    d3.range(0, 1.01, 0.2).forEach(stop => {
        gradient.append("stop").attr("offset", `${stop * 100}%`).attr("stop-color", colorScale(minValue + (maxValue - minValue) * stop));
    });

    const districtShadow = defs.append("filter").attr("id", `shadow-${containerId}`);
    districtShadow.append("feDropShadow").attr("dx", 0).attr("dy", 4).attr("stdDeviation", 4).attr("flood-color", "#7c3aed").attr("flood-opacity", 0.1);

    svg.append("g").selectAll("path").data(features).enter().append("path").attr("data-district-shape", "1").attr("data-district", feature => String(feature.properties?.district || "").trim().replace(/^0+/, '')).attr("d", path).attr("fill", feature => {
        const district = String(feature.properties?.district || "").trim().replace(/^0+/, '');
        const value = dataMap.get(district);
        return Number.isFinite(value) ? colorScale(value) : "#e2e8f0";
    }).attr("stroke", "#ffffff").attr("stroke-width", 1.5).attr("filter", `url(#shadow-${containerId})`).style("cursor", "pointer")
    .on("mouseover", (e, feature) => {
        const district = String(feature.properties?.district || "").trim().replace(/^0+/, '');
        const districtName = String(feature.properties?.district_name || district).trim();
        const value = dataMap.get(district);
        showTooltip(Number.isFinite(value) ? `<b>警区 ${district}</b><br/>名称: ${districtName}<br/>${valueLabel}: ${value.toLocaleString()}` : `<b>警区 ${district}</b><br/>名称: ${districtName}<br/>${valueLabel}: 暂无统计`, e.pageX, e.pageY);
        options.onHover?.(district);
    }).on("mouseout", () => { hideTooltip(); options.onLeave?.(); }).on("click", (e, feature) => {
        const district = String(feature.properties?.district || "").trim().replace(/^0+/, '');
        options.onSelect?.(district);
    });

    svg.append("g").selectAll("text").data(labelFeatures).enter().append("text").attr("data-district-label", "1").attr("data-district", item => item.district).attr("x", item => item.centroid[0]).attr("y", item => item.centroid[1] + 4).attr("text-anchor", "middle").style("font-size", "12px").style("font-weight", "800").style("pointer-events", "none").style("fill", item => item.value >= (minValue + maxValue) * 0.4 ? "#ffffff" : "#4c1d95").attr("stroke", item => item.value >= (minValue + maxValue) * 0.4 ? "#4c1d95" : "#ffffff").attr("stroke-width", 2).attr("paint-order", "stroke").text(item => item.district);

    const legend = svg.append("g").attr("transform", `translate(${width - 150}, 40)`);
    legend.append("rect").attr("width", 110).attr("height", 184).attr("rx", 18).attr("fill", "#ffffff").attr("fill-opacity", 0.9).attr("stroke", "#e2e8f0");
    legend.append("text").attr("x", 18).attr("y", 26).style("font-size", "13px").style("font-weight", "700").style("fill", "#334155").text(`${valueLabel}热度`);
    legend.append("rect").attr("x", 22).attr("y", 42).attr("width", 18).attr("height", 104).attr("rx", 9).attr("fill", `url(#legend-gradient-${containerId})`);
    legend.append("text").attr("x", 52).attr("y", 52).style("font-size", "12px").style("fill", "#475569").text(`${Math.round(maxValue).toLocaleString()} 件`);
    legend.append("text").attr("x", 52).attr("y", 146).style("font-size", "12px").style("fill", "#475569").text(`${Math.round(minValue).toLocaleString()} 件`);
    legend.append("rect").attr("x", 22).attr("y", 158).attr("width", 18).attr("height", 18).attr("rx", 4).attr("fill", "#e2e8f0");
    legend.append("text").attr("x", 52).attr("y", 171).style("font-size", "12px").style("fill", "#64748b").text("暂无统计");
}

export async function drawAreaChart(id, api, xKey, yKey, color) {
    const data = await d3.json(api);
    if (!data || data.length === 0) return;
    const windowSize = 3;
    const maData = data.map((d, i) => {
        if (i < windowSize - 1) return { [xKey]: d[xKey], ma: d[yKey] };
        let sum = 0;
        for (let j = 0; j < windowSize; j++) sum += data[i - j][yKey];
        return { [xKey]: d[xKey], ma: sum / windowSize };
    });

    const firstYear = data[0][yKey];
    const lastYear = data[data.length - 1][yKey];
    const peakYearData = data.reduce((prev, current) => (prev[yKey] > current[yKey]) ? prev : current);
    const valleyYearData = data.reduce((prev, current) => (prev[yKey] < current[yKey]) ? prev : current);
    const overallChange = ((lastYear - firstYear) / firstYear * 100).toFixed(1);
    const trendText = lastYear < firstYear ? "呈整体下降趋势" : "呈整体上升趋势";
    const summaryEl = document.getElementById('trend-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `芝加哥犯罪率较 2001 年${trendText} (${overallChange}%)，峰值出现在 ${peakYearData[xKey]} 年，历史最低值出现在 ${valleyYearData[xKey]} 年。`;
    }

    const container = d3.select(`#${id}`);
    container.selectAll("*").remove();
    let width = container.node().clientWidth || 800;
    const height = container.node().clientHeight;
    const margin = {top: 20, right: 30, bottom: 40, left: 60};
    const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet").append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const IW = width - margin.left - margin.right;
    const IH = height - margin.top - margin.bottom;

    const x = d3.scaleLinear().domain(d3.extent(data, d => d[xKey])).range([0, IW]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d[yKey]) * 1.15]).range([IH, 0]);

    const defs = svg.append("defs");
    const gradId = `grad-${id}`;
    const grad = defs.append("linearGradient").attr("id", gradId).attr("x1","0%").attr("y1","0%").attr("x2","0%").attr("y2","100%");
    grad.append("stop").attr("offset","0%").attr("stop-color", color).attr("stop-opacity", 0.3);
    grad.append("stop").attr("offset","100%").attr("stop-color", color).attr("stop-opacity", 0);

    const area = d3.area().x(d => x(d[xKey])).y0(IH).y1(d => y(d[yKey])).curve(d3.curveMonotoneX);
    const line = d3.line().x(d => x(d[xKey])).y(d => y(d[yKey])).curve(d3.curveMonotoneX);
    const maLine = d3.line().x(d => x(d[xKey])).y(d => y(d.ma)).curve(d3.curveMonotoneX);

    svg.append("path").datum(data).attr("fill", `url(#${gradId})`).attr("d", area);
    const path = svg.append("path").datum(data).attr("fill", "none").attr("stroke", color).attr("stroke-width", 3.5).attr("d", line);
    svg.append("path").datum(maData).attr("fill", "none").attr("stroke", "#f59e0b").attr("stroke-width", 2).attr("stroke-dasharray", "5,5").attr("d", maLine).style("opacity", 0.8);

    const len = path.node().getTotalLength();
    path.attr("stroke-dasharray", len).attr("stroke-dashoffset", len).transition().duration(1500).attr("stroke-dashoffset", 0);

    const peakX = x(peakYearData[xKey]), peakY = y(peakYearData[yKey]);
    const annotation = svg.append("g").attr("class", "peak-annotation").style("opacity", 0);
    annotation.append("circle").attr("cx", peakX).attr("cy", peakY).attr("r", 8).attr("fill", "none").attr("stroke", "#ef4444").attr("stroke-width", 2).attr("class", "animate-ping");
    annotation.append("text").attr("x", peakX).attr("y", peakY - 15).attr("text-anchor", "middle").attr("fill", "#ef4444").attr("font-size", "10px").attr("font-weight", "bold").text("历史峰值");
    annotation.transition().delay(1600).duration(500).style("opacity", 1);

    const valleyX = x(valleyYearData[xKey]), valleyY = y(valleyYearData[yKey]);
    const valleyAnnotation = svg.append("g").attr("class", "valley-annotation").style("opacity", 0);
    valleyAnnotation.append("circle").attr("cx", valleyX).attr("cy", valleyY).attr("r", 8).attr("fill", "none").attr("stroke", "#10b981").attr("stroke-width", 2).attr("class", "animate-ping");
    valleyAnnotation.append("text").attr("x", valleyX).attr("y", valleyY + 25).attr("text-anchor", "middle").attr("fill", "#10b981").attr("font-size", "10px").attr("font-weight", "bold").text("历史低值");
    valleyAnnotation.transition().delay(1800).duration(500).style("opacity", 1);

    svg.selectAll(".dot").data(data).enter().append("circle").attr("class", "dot").attr("cx", d => x(d[xKey])).attr("cy", d => y(d[yKey])).attr("r", 0).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 2).style("cursor", "pointer").transition().delay((d, i) => i * 50).duration(500).attr("r", 5);

    const vlineGroup = svg.append("g").attr("class", "vline-group").style("display", "none");
    vlineGroup.append("line").attr("class", "vline").attr("y1", 0).attr("y2", IH);
    const highlightCircle = vlineGroup.append("circle").attr("r", 7).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 2);

    svg.append("rect").attr("width", IW).attr("height", IH).style("fill", "none").style("pointer-events", "all").on("mousemove", function(event) {
        const mouseX = d3.pointer(event)[0];
        let minDist = Infinity, closest = null;
        data.forEach(d => {
            const cx = x(d[xKey]);
            const dist = Math.abs(cx - mouseX);
            if (dist < minDist) { minDist = dist; closest = d; }
        });
        if (closest) {
            const cx = x(closest[xKey]), cy = y(closest[yKey]);
            vlineGroup.select(".vline").attr("x1", cx).attr("x2", cx);
            highlightCircle.attr("cx", cx).attr("cy", cy);
            vlineGroup.style("display", null);
            const yoyColor = closest.yoy > 0 ? '#ef4444' : '#10b981';
            const yoyIcon = closest.yoy > 0 ? '↑' : '↓';
            const yoyHtml = closest.yoy !== 0 ? `<br/><span style="color:${yoyColor}">同比: ${yoyIcon} ${Math.abs(closest.yoy)}%</span>` : '';
            showTooltip(`<b>年份:</b> ${closest[xKey]}<br/><b>案件数:</b> ${closest[yKey].toLocaleString()}${yoyHtml}`, event.pageX, event.pageY);
        }
    }).on("mouseout", () => { vlineGroup.style("display", "none"); hideTooltip(); });

    svg.append("g").attr("transform", `translate(0,${IH})`).call(d3.axisBottom(x).tickFormat(d3.format("d")).tickSize(0).tickPadding(10)).attr("color", colors.slate);
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(10)).attr("color", colors.slate);
    svg.selectAll(".domain").remove();
}

export async function drawPieChart(id, api) {
    const data = await d3.json(api);
    if (!data || data.length === 0) return;
    const TOP_N = 15;
    let pieData = data.length <= TOP_N ? data : [...data.slice(0, TOP_N), { primary_type: "其他", cnt: d3.sum(data.slice(TOP_N), d => d.cnt) }];
    pieData.sort((a, b) => b.cnt - a.cnt);

    const container = d3.select(`#${id}`);
    container.selectAll("*").remove();
    const baseWidth = 900, baseHeight = 600;
    const svgContainer = container.append("svg").attr("viewBox", `0 0 ${baseWidth} ${baseHeight}`).attr("preserveAspectRatio", "xMidYMid meet").attr("width", "100%").attr("height", "100%");
    const chartGroup = svgContainer.append("g").attr("transform", `translate(${baseWidth * 0.38},${baseHeight/2})`);
    const maxRadius = 250, minRadius = 55;
    const rScale = d3.scaleSqrt().domain([0, d3.max(pieData, d => d.cnt)]).range([minRadius, maxRadius]);
    const pieColors = Array.from({length: TOP_N}, (_, i) => d3.interpolateRdBu(1 - (i / (TOP_N - 1))));
    pieColors.push("#94A3B8");
    const color = d3.scaleOrdinal().domain(pieData.map(d => d.primary_type)).range(pieColors);
    const pie = d3.pie().value(1).sort(null);
    const arc = d3.arc().innerRadius(minRadius).outerRadius(d => rScale(d.data.cnt));

    let highlightedType = null;
    const arcs = chartGroup.selectAll(".arc").data(pie(pieData)).enter().append("g").attr("class", "arc");
    const paths = arcs.append("path").attr("fill", d => color(d.data.primary_type)).style("cursor", "pointer").style("opacity", 1).each(function(d) { this._current = d; });
    paths.transition().duration(1000).attrTween("d", function(d) {
        const interpolate = d3.interpolate({startAngle: 0, endAngle: 0}, d);
        return function(t) { return arc(interpolate(t)); };
    });

    chartGroup.append("circle").attr("r", minRadius).attr("fill", "white");
    const labelsGroup = chartGroup.append("g").attr("class", "arc-labels");
    const labels = labelsGroup.selectAll("text").data(pie(pieData)).enter().append("text").text(d => d.data.cnt.toLocaleString()).attr("font-size", "12px").attr("font-weight", "600").attr("fill", "#1e293b").style("opacity", 0)
        .attr("transform", function(d) {
            const labelRadius = rScale(d.data.cnt) + 10;
            const midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
            const angleDeg = midangle * 180 / Math.PI;
            const x = Math.sin(midangle) * labelRadius, y = -Math.cos(midangle) * labelRadius;
            let rotate = angleDeg - 90;
            if (angleDeg > 180) rotate += 180;
            return `translate(${x}, ${y}) rotate(${rotate})`;
        })
        .style("text-anchor", d => ((d.startAngle + (d.endAngle - d.startAngle) / 2) * 180 / Math.PI) > 180 ? "end" : "start")
        .style("dominant-baseline", "middle");
    labels.transition().delay(1000).duration(500).style("opacity", 1);

    const legendGroup = svgContainer.append("g").attr("class", "rose-legend").attr("transform", `translate(${baseWidth * 0.78}, ${baseHeight/2 - (pieData.length * 25)/2})`);
    const legendItems = legendGroup.selectAll(".legend-item").data(pieData).enter().append("g").attr("class", "legend-item").attr("transform", (d, i) => `translate(0, ${i * 25})`).style("cursor", "pointer");
    legendItems.append("rect").attr("width", 15).attr("height", 15).attr("rx", 3).attr("fill", d => color(d.primary_type));
    legendItems.append("text").attr("x", 25).attr("y", 12).attr("font-size", "14px").attr("fill", "#475569").text(d => d.primary_type.length > 20 ? d.primary_type.slice(0, 18) + '...' : d.primary_type);

    const updateVisuals = (activeType) => {
        paths.transition().duration(400).style("opacity", p => activeType ? (p.data.primary_type === activeType ? 1 : 0.2) : 1)
            .attr("transform", p => p.data.primary_type === activeType ? "scale(1.03)" : "scale(1)");
        labels.transition().duration(400).style("opacity", l => activeType ? (l.data.primary_type === activeType ? 1 : 0.2) : 1);
        legendItems.transition().duration(400).style("opacity", l => activeType ? (l.primary_type === activeType ? 1 : 0.3) : 1);
    };

    paths.on("mouseover", (e, d) => {
        if (highlightedType) return;
        updateVisuals(d.data.primary_type);
        const totalVal = d3.sum(pieData, x => x.cnt);
        showTooltip(`<b>${d.data.primary_type}</b><br/><b>数量:</b> ${d.data.cnt.toLocaleString()}<br/><b>占比:</b> ${((d.data.cnt / totalVal) * 100).toFixed(1)}%`, e.pageX, e.pageY);
    }).on("mouseout", () => {
        if (!highlightedType) updateVisuals(null);
        hideTooltip();
    }).on("click", (e, d) => {
        highlightedType = highlightedType === d.data.primary_type ? null : d.data.primary_type;
        updateVisuals(highlightedType);
        e.stopPropagation();
    });

    legendItems.on("click", (e, d) => {
        highlightedType = highlightedType === d.primary_type ? null : d.primary_type;
        updateVisuals(highlightedType);
        e.stopPropagation();
    });

    svgContainer.on("click", () => {
        highlightedType = null;
        updateVisuals(null);
    });
}

export function renderDistrictRanking(containerId, data, valueKey, valueLabel, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const limit = options.limit || 10;
    const maxValue = d3.max(data, d => d[valueKey]) || 1;
    const ranking = data.slice(0, limit);
    container.innerHTML = ranking.map((item, index) => {
        const share = maxValue ? (item[valueKey] / maxValue) * 100 : 0;
        return `
            <div class="district-card rounded-2xl p-4" data-district-card="1" data-district="${item.district}">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg">${index + 1}</div>
                        <div>
                            <div class="text-base font-black text-slate-800">警区 ${item.district}</div>
                            <div class="text-xs text-slate-400 mt-0.5">${item.district_name || `警区 ${item.district}`}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-xl font-black text-indigo-600">${item[valueKey].toLocaleString()}</div>
                        <div class="text-[11px] font-semibold text-slate-400">${valueLabel}</div>
                    </div>
                </div>
                <div class="mt-4">
                    <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style="width: ${Math.max(share, 8)}%"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    container.querySelectorAll('[data-district-card]').forEach(card => {
        const district = card.getAttribute('data-district');
        card.addEventListener('mouseenter', () => options.onHover?.(district));
        card.addEventListener('mouseleave', () => options.onLeave?.(district));
        card.addEventListener('click', () => options.onSelect?.(district));
    });
}

export function renderDistrictFocus(containerId, data, district, valueKey, valueLabel) {
    const container = document.getElementById(containerId);
    if (!container || !data.length) return;
    const current = data.find(item => item.district === district) || data[0];
    const total = d3.sum(data, item => item[valueKey]);
    const rank = data.findIndex(item => item.district === current.district) + 1;
    const share = total ? ((current[valueKey] / total) * 100).toFixed(1) : "0.0";
    container.innerHTML = `
        <div class="flex items-start justify-between gap-4">
            <div>
                <div class="text-xs font-bold text-indigo-500 uppercase tracking-[0.3em] mb-2">当前聚焦警区</div>
                <div class="text-3xl font-black text-slate-800">警区 ${current.district}</div>
                <div class="text-sm text-slate-500 mt-1">${current.district_name || `警区 ${current.district}`}</div>
            </div>
            <div class="w-14 h-14 rounded-2xl bg-white/80 text-indigo-600 flex items-center justify-center shadow-sm text-2xl">📍</div>
        </div>
        <div class="grid grid-cols-3 gap-2.5 mt-6">
            <div class="rounded-2xl bg-white/70 p-3 shadow-sm min-w-0 border border-white/40">
                <div class="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">排名</div>
                <div class="text-xl font-black text-slate-800">#${rank}</div>
            </div>
            <div class="rounded-2xl bg-white/70 p-3 shadow-sm min-w-0 border border-white/40">
                <div class="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider truncate" title="${valueLabel}">${valueLabel}</div>
                <div class="text-xl font-black text-indigo-600 truncate" title="${current[valueKey].toLocaleString()}">${current[valueKey].toLocaleString()}</div>
            </div>
            <div class="rounded-2xl bg-white/70 p-3 shadow-sm min-w-0 border border-white/40">
                <div class="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">占比</div>
                <div class="text-xl font-black text-fuchsia-600">${share}%</div>
            </div>
        </div>
    `;
}

export function setDistrictFollowState(mapContainerId, listContainerId, activeDistrict, lockedDistrict) {
    const mapContainer = d3.select(`#${mapContainerId}`);
    mapContainer.selectAll('[data-district-shape]').each(function() {
        const district = this.getAttribute('data-district');
        const isActive = district === activeDistrict, isLocked = district === lockedDistrict;
        d3.select(this).style('opacity', activeDistrict ? (isActive ? 1 : 0.72) : 1).attr('stroke', isActive ? '#4c1d95' : isLocked ? '#7c3aed' : '#ffffff').attr('stroke-width', isActive ? 3 : isLocked ? 2.2 : 1.5);
    });
    mapContainer.selectAll('[data-district-label]').each(function() {
        const district = this.getAttribute('data-district');
        const isActive = district === activeDistrict, isLocked = district === lockedDistrict;
        d3.select(this)
            .style('opacity', activeDistrict ? (isActive || isLocked ? 1 : 0.35) : 1)
            .style('font-size', isActive ? '14px' : '12px')
            .style('font-weight', isActive ? '900' : '800');
    });
    const listContainer = document.getElementById(listContainerId);
    if (listContainer) {
        listContainer.querySelectorAll('[data-district-card]').forEach(card => {
            const district = card.getAttribute('data-district');
            card.classList.toggle('is-active', district === activeDistrict);
            card.classList.toggle('is-muted', !!activeDistrict && district !== activeDistrict);
        });
    }
}

export function drawHeatmap(containerId, data, xKey, yKey, valueKey) {
    const container = d3.select(`#${containerId}`);
    container.selectAll("*").remove();
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    const margin = {top: 60, right: 120, bottom: 50, left: 140};
    const IW = width - margin.left - margin.right;
    const IH = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const months = [...new Set(data.map(d => d[xKey]))].sort((a, b) => a - b);
    
    // 按总量对犯罪类型进行排序（越红越往上）
    const typeTotals = d3.rollup(data, v => d3.sum(v, d => d[valueKey]), d => d[yKey]);
    const crimeTypes = [...new Set(data.map(d => d[yKey]))].sort((a, b) => typeTotals.get(b) - typeTotals.get(a));
    
    const maxValue = d3.max(data, d => d[valueKey]);

    const x = d3.scaleBand().domain(months).range([0, IW]).padding(0.05);
    const y = d3.scaleBand().domain(crimeTypes).range([0, IH]).padding(0.05);
    
    // 自定义色阶：由黄到红，最高值趋向黑色
    const colorScale = d3.scaleSequential(t => {
        if (t > 0.8) {
            return d3.interpolateRgb(d3.interpolateYlOrRd(0.8), "#000000")((t - 0.8) / 0.2);
        }
        return d3.interpolateYlOrRd(t);
    }).domain([0, maxValue]);

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient").attr("id", `heatmap-legend-gradient-${containerId}`).attr("x1", "0%").attr("y1", "100%").attr("x2", "0%").attr("y2", "0%");
    d3.range(0, 1.01, 0.1).forEach(stop => {
        gradient.append("stop").attr("offset", `${stop * 100}%`).attr("stop-color", colorScale(maxValue * stop));
    });

    svg.selectAll(".cell").data(data).enter().append("rect")
        .attr("class", "cell")
        .attr("x", d => x(d[xKey]))
        .attr("y", d => y(d[yKey]))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("rx", 4)
        .attr("fill", d => colorScale(d[valueKey]))
        .style("cursor", "pointer")
        .on("mouseover", (e, d) => {
            d3.select(e.currentTarget).attr("stroke", "#1e293b").attr("stroke-width", 2);
            const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
            const monthLabel = Number.isInteger(d[xKey]) ? monthNames[d[xKey] - 1] : d[xKey];
            showTooltip(`<b>${d[yKey]}</b><br/>${monthLabel}<br/>案件数: ${d[valueKey].toLocaleString()}`, e.pageX, e.pageY);
        })
        .on("mouseout", (e) => {
            d3.select(e.currentTarget).attr("stroke", null);
            hideTooltip();
        });

    const monthLabels = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    svg.append("g")
        .attr("transform", `translate(0,${IH})`)
        .call(d3.axisBottom(x).tickFormat(d => monthLabels[months.indexOf(d)]).tickSize(0).tickPadding(12))
        .style("color", "#64748b")
        .selectAll("text")
        .style("font-size", "11px")
        .style("font-weight", "500");

    svg.append("g")
        .call(d3.axisLeft(y).tickSize(0).tickPadding(10))
        .selectAll("text")
        .style("font-size", "10px")
        .style("fill", "#475569")
        .style("font-weight", "500");

    svg.selectAll(".domain").remove();

    const legend = svg.append("g").attr("transform", `translate(${IW + 30}, 0)`);
    legend.append("rect").attr("width", 20).attr("height", IH).attr("rx", 10).attr("fill", `url(#heatmap-legend-gradient-${containerId})`);
    legend.append("text").attr("x", 30).attr("y", 10).style("font-size", "12px").style("fill", "#475569").text("高");
    legend.append("text").attr("x", 30).attr("y", IH).style("font-size", "12px").style("fill", "#475569").text("低");
}
