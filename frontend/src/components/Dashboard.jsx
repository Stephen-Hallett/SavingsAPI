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
  // If explicitly set and it's a full URL (not a container name), use it
  if (
    process.env.REACT_APP_API_URL &&
    process.env.REACT_APP_API_URL.startsWith("http")
  ) {
    return process.env.REACT_APP_API_URL;
  }

  // For browser: use same host with backend port
  // Use the backend port from environment variable, or default to 8181
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    // Get port from REACT_APP_BACKEND_PORT env var, or default to 8181
    const backendPort = process.env.REACT_APP_BACKEND_PORT || "8181";
    return `${protocol}//${hostname}:${backendPort}`;
  }
  // Fallback (shouldn't happen in React)
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
  const [months, setMonths] = useState(6);

  useEffect(() => {
    fetchData();
  }, [years, months]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `${API_URL}/history?years=${years}&months=${months}`;
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

      setData(chartData);

      // Calculate stats from the latest data point
      if (chartData.length > 0) {
        const latest = chartData[chartData.length - 1];
        const oldest = chartData[0];

        const investmentKeys = Object.keys(latest).filter(
          (key) => key !== "date"
        );

        const totalLatest = investmentKeys.reduce(
          (sum, key) => sum + (latest[key] || 0),
          0
        );
        const totalOldest = investmentKeys.reduce(
          (sum, key) => sum + (oldest[key] || 0),
          0
        );
        const totalChange = totalLatest - totalOldest;
        const totalChangePercent =
          totalOldest > 0 ? ((totalChange / totalOldest) * 100).toFixed(2) : 0;

        // Calculate period label
        const periodParts = [];
        if (years > 0) {
          periodParts.push(`${years} ${years === 1 ? "year" : "years"}`);
        }
        if (months > 0) {
          periodParts.push(`${months} ${months === 1 ? "month" : "months"}`);
        }
        const periodLabel = periodParts.join(" and ") || "period";

        setStats({
          totalLatest,
          totalOldest,
          totalChange,
          totalChangePercent,
          investmentKeys,
          latest,
          periodLabel,
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
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Stats */}
          <div className="lg:col-span-1 space-y-6">
            {/* Total Value Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                Total Portfolio Value
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Current Value</p>
                  <p className="text-3xl font-bold text-gray-900">
                    $
                    {stats?.totalLatest.toLocaleString("en-NZ", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || "0.00"}
                  </p>
                </div>
                {stats && (
                  <div>
                    <p className="text-sm text-gray-500">
                      {stats.periodLabel.charAt(0).toUpperCase() +
                        stats.periodLabel.slice(1)}{" "}
                      Change
                    </p>
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
                    <p
                      className={`text-sm ${
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
                      <span className="text-sm font-semibold text-gray-900">
                        $
                        {(stats.latest[investment] || 0).toLocaleString(
                          "en-NZ",
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}
                      </span>
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
                    tickFormatter={(value) =>
                      `$${value.toLocaleString("en-NZ")}`
                    }
                  />
                  <Tooltip
                    formatter={(value) =>
                      `$${value.toLocaleString("en-NZ", {
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
