import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Get API URL - construct from current host with backend port
// The browser needs to use the host's address, not Docker container names
const getApiUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL;

  // If we're running in the browser, we can detect HTTPS and avoid mixed content.
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;

    // If an explicit HTTPS URL is provided, prefer it.
    if (envUrl && envUrl.startsWith("https://")) {
      return envUrl;
    }

    // If the page is served over HTTPS and the env URL is HTTP, browsers will block it
    // as mixed content. In that case, ignore the HTTP env URL and fall back to same-origin.
    if (protocol === "https:" && envUrl && envUrl.startsWith("http://")) {
      return `${protocol}//${hostname}`;
    }

    // For HTTP (local / direct IP access), allow using the env URL directly if set.
    if (protocol === "http:" && envUrl && envUrl.startsWith("http")) {
      return envUrl;
    }

    // Otherwise, construct from current host. If we're on a standard port (80/443) or
    // no port, assume reverse proxy and use same-origin. Otherwise, use backend port.
    if (!port || port === "80" || port === "443") {
      return `${protocol}//${hostname}`;
    }

    const backendPort = process.env.REACT_APP_BACKEND_PORT || "8181";
    return `${protocol}//${hostname}:${backendPort}`;
  }

  // Fallback for non-browser environments
  if (envUrl && envUrl.startsWith("http")) {
    return envUrl;
  }
  return "";
};

const API_URL = getApiUrl();

// Debug: log the API URL being used
console.log("API URL:", API_URL);
console.log("REACT_APP_BACKEND_PORT:", process.env.REACT_APP_BACKEND_PORT);

function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [years, setYears] = useState(0);
  const [months, setMonths] = useState(3);
  const [days, setDays] = useState(0);
  const [hideSensitive, setHideSensitive] = useState(true);

  useEffect(() => {
    fetchData();
  }, [years, months, days, hideSensitive]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Always fetch absolute history; we derive returns client-side so that
      // percentages match between sensitive and non-sensitive modes.
      const url = `${API_URL}/history?years=${years}&months=${months}&days=${days}`;
      console.log("Fetching from:", url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const rawData = await response.json();

      // Transform data for recharts
      // rawData is a list of dicts with nz_date and investment names as keys
      const chartData = rawData.map((item) => {
        const transformed = { date: item.nz_date };
        // Copy all investment keys (everything except nz_date)
        Object.keys(item).forEach((key) => {
          if (key !== "nz_date") {
            transformed[key] = item[key] || 0;
          }
        });
        return transformed;
      });

      // Sort by date
      chartData.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Work out investment keys (exclude date)
      let investmentKeys = [];
      if (chartData.length > 0) {
        investmentKeys = Object.keys(chartData[0]).filter(
          (key) => key !== "date"
        );
      }

      // Compute baseline (oldest) values for each investment for returns mode
      const baselineByInvestment = {};
      investmentKeys.forEach((key) => {
        const firstWithValue = chartData.find(
          (row) => row[key] !== null && row[key] !== undefined && row[key] !== 0
        );
        baselineByInvestment[key] = firstWithValue ? firstWithValue[key] : 0;
      });

      const baselineTotal = investmentKeys.reduce(
        (sum, key) => sum + (baselineByInvestment[key] || 0),
        0
      );

      // Absolute data with total line
      const absoluteData = chartData.map((row) => {
        const total = investmentKeys.reduce(
          (sum, key) => sum + (row[key] || 0),
          0
        );
        return { ...row, Total: total };
      });

      // Returns data (cumulative return factors) with total factor
      const returnsData = chartData.map((row) => {
        const valueTotal = investmentKeys.reduce(
          (sum, key) => sum + (row[key] || 0),
          0
        );
        const totalFactor =
          baselineTotal > 0 ? valueTotal / baselineTotal : 1.0;

        const returnsRow = { date: row.date, Total: totalFactor };
        investmentKeys.forEach((key) => {
          const base = baselineByInvestment[key] || 0;
          const current = row[key] || 0;
          returnsRow[key] =
            base > 0 ? current / base : 1.0; // factor relative to baseline
        });
        return returnsRow;
      });

      const chartDataWithTotal = hideSensitive ? returnsData : absoluteData;

      setData(chartDataWithTotal);

      // Calculate stats from absolute data so percentages match between modes
      if (absoluteData.length > 0) {
        const latestAbs = absoluteData[absoluteData.length - 1];
        const oldestAbs = absoluteData[0];

        const investmentKeysForStats = Object.keys(latestAbs).filter(
          (key) => key !== "date" && key !== "Total"
        );

        const totalLatest = latestAbs.Total;
        const totalOldest = oldestAbs.Total;
        const totalChange = totalLatest - totalOldest;
        const totalChangePercent =
          totalOldest > 0
            ? parseFloat(((totalChange / totalOldest) * 100).toFixed(2))
            : 0;

        // Calculate period label
        const periodParts = [];
        if (years > 0) {
          periodParts.push(`${years} ${years === 1 ? "year" : "years"}`);
        }
        if (months > 0) {
          periodParts.push(`${months} ${months === 1 ? "month" : "months"}`);
        }
        if (days > 0) {
          periodParts.push(`${days} ${days === 1 ? "day" : "days"}`);
        }
        const periodLabelWithDays = (() => {
          return periodParts.join(" and ") || "period";
        })();

        setStats({
          totalLatest,
          totalOldest,
          totalChange,
          totalChangePercent,
          investmentKeys: investmentKeysForStats,
          latest: hideSensitive
            ? returnsData[returnsData.length - 1]
            : latestAbs,
          periodLabel: periodLabelWithDays,
          isReturns: hideSensitive,
        });
      }

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Generate colors for investments
  const colors = [
    "#3b82f6", // blue
    "#10b981", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // purple
    "#06b6d4", // cyan
    "#f97316", // orange
    "#ec4899", // pink
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading investment data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading data: {error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">No data available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4 sm:mb-0">
            Investment Performance
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setHideSensitive(!hideSensitive)}
              className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              title={
                hideSensitive
                  ? "Show sensitive information"
                  : "Hide sensitive information"
              }
            >
              {hideSensitive ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
            <div className="flex items-center gap-2">
              <label
                htmlFor="years"
                className="text-sm font-medium text-gray-700"
              >
                Years:
              </label>
              <select
                id="years"
                value={years}
                onChange={(e) => setYears(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="months"
                className="text-sm font-medium text-gray-700"
              >
                Months:
              </label>
              <select
                id="months"
                value={months}
                onChange={(e) => setMonths(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="days"
                className="text-sm font-medium text-gray-700"
              >
                Days:
              </label>
              <select
                id="days"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                {[0, 7, 14, 30, 60, 90, 180, 365].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Stats */}
          <div className="lg:col-span-1 space-y-6">
            {/* Total Value Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                {hideSensitive
                  ? "Portfolio Performance"
                  : "Total Portfolio Value"}
              </h2>
              <div className="space-y-4">
                {!hideSensitive && stats && stats.totalLatest !== null && (
                  <div>
                    <p className="text-sm text-gray-500">Current Value</p>
                    <p className="text-3xl font-bold text-gray-900">
                      $
                      {stats.totalLatest.toLocaleString("en-NZ", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                )}
                {stats && (
                  <div>
                    <p className="text-sm text-gray-500">
                      {stats.periodLabel.charAt(0).toUpperCase() +
                        stats.periodLabel.slice(1)}{" "}
                      {hideSensitive ? "Return" : "Change"}
                    </p>
                    {!hideSensitive &&
                      stats.totalChange !== null &&
                      stats.totalChange !== undefined && (
                        <p
                          className={`text-2xl font-semibold ${
                            stats.totalChange >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {stats.totalChange >= 0 ? "+" : ""}$
                          {stats.totalChange.toLocaleString("en-NZ", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      )}
                    <p
                      className={`${
                        hideSensitive ? "text-3xl" : "text-sm"
                      } font-bold ${
                        stats.totalChangePercent >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {stats.totalChangePercent >= 0 ? "+" : ""}
                      {stats.totalChangePercent}%
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Individual Investments */}
            {stats && stats.investmentKeys.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-700 mb-4">
                  Investments
                </h2>
                <div className="space-y-3">
                  {stats.investmentKeys.map((investment, index) => (
                    <div
                      key={investment}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <div
                          className="w-4 h-4 rounded-full mr-2"
                          style={{
                            backgroundColor: colors[index % colors.length],
                          }}
                        ></div>
                        <span className="text-sm text-gray-700">
                          {investment}
                        </span>
                      </div>
                      {hideSensitive ? (
                        <span className="text-sm font-semibold text-gray-900">
                          {((stats.latest[investment] || 1.0) - 1.0 >= 0
                            ? "+"
                            : "") +
                            (
                              ((stats.latest[investment] || 1.0) - 1.0) *
                              100
                            ).toFixed(2)}
                          %
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">
                          $
                          {(stats.latest[investment] || 0).toLocaleString(
                            "en-NZ",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Placeholder for additional stats */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                Additional Stats
              </h2>
              <p className="text-sm text-gray-500">
                More statistics can be added here
              </p>
            </div>
          </div>

          {/* Right Side - Chart */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                Performance Over Time
              </h2>
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString("en-NZ", {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(value) =>
                      hideSensitive
                        ? `${((value - 1) * 100).toFixed(1)}%`
                        : `$${value.toLocaleString("en-NZ")}`
                    }
                  />
                  <Tooltip
                    formatter={(value) =>
                      hideSensitive
                        ? `${((value - 1) * 100).toFixed(2)}%`
                        : `$${value.toLocaleString("en-NZ", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                    }
                    labelFormatter={(label) => {
                      const date = new Date(label);
                      return date.toLocaleDateString("en-NZ", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      });
                    }}
                  />
                  <Legend />
                  {stats?.investmentKeys.map((investment, index) => (
                    <Line
                      key={investment}
                      type="monotone"
                      dataKey={investment}
                      stroke={colors[index % colors.length]}
                      strokeWidth={2}
                      dot={false}
                      name={investment}
                    />
                  ))}
                  {/* Hidden Total series: available in tooltip but not drawn as its own line */}
                  <Line
                    type="monotone"
                    dataKey="Total"
                    stroke="#111827"
                    strokeWidth={2.5}
                    dot={false}
                    name="Total"
                    hide
                    legendType="none"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
