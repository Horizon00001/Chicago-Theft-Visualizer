// API 数据获取模块
export async function fetchYearlyTrend() {
    return fetch('/api/yearly_trend').then(r => r.json());
}

export async function fetchWeeklyDistribution() {
    return fetch('/api/weekly_distribution').then(r => r.json());
}

export async function fetchHourlyDistribution() {
    return fetch('/api/hourly_distribution').then(r => r.json());
}

export async function fetchTopCrimeTypes() {
    return fetch('/api/top_crime_types').then(r => r.json());
}

export async function fetchDistrictCrimes(primaryType = 'ALL') {
    const params = new URLSearchParams({ primary_type: primaryType });
    return fetch(`/api/district_crimes?${params.toString()}`).then(r => r.json());
}

export async function fetchArrestRate() {
    return fetch('/api/arrest_rate').then(r => r.json());
}

export async function fetchDomesticRatio() {
    return fetch('/api/domestic_ratio').then(r => r.json());
}

export async function fetchDomesticTrend() {
    return fetch('/api/domestic_trend').then(r => r.json());
}

export async function fetchTopLocations(primaryType = 'ALL') {
    const params = new URLSearchParams({ primary_type: primaryType });
    return fetch(`/api/top_locations?${params.toString()}`).then(r => r.json());
}

export async function fetchMonthlyTrend() {
    return fetch('/api/monthly_trend').then(r => r.json());
}

export async function fetchTheftByDistrict(primaryType = 'THEFT') {
    const params = new URLSearchParams({ primary_type: primaryType });
    return fetch(`/api/theft_by_district?${params.toString()}`).then(r => r.json());
}

export async function fetchCrimeTypeByMonth() {
    return fetch('/api/crime_type_by_month').then(r => r.json());
}

export async function fetchCrimeStructureChange() {
    return fetch('/api/crime_structure_change').then(r => r.json());
}

export async function fetchGeoJSON() {
    return fetch('/static/data/police_districts.geojson').then(r => r.json());
}

export async function fetchCrimeTypes() {
    return fetch('/api/crime_types').then(r => r.json());
}
