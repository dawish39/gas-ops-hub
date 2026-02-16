# Trend Chart Feature Handover Document

## 1. Feature Purpose

This feature provides a visual representation of the historical trends for three key metrics on the dashboard: "New", "Completed", and "Pending" tasks. It allows users to analyze the team's workload and performance over time.

## 2. UI Component Locations

All UI components are located within `src/index.html`.

*   **Trigger Button:**
    *   **Location:** `src/index.html:36`
    *   **Code:** `<button class="btn btn-secondary btn-sm" onclick="toggleTrendChart()">趨勢圖</button>`

*   **Chart Container:**
    *   **Location:** `src/index.html:81-83`
    *   **Code:**
        ```html
        <div id="trendChartContainer" style="display: none;">
          <canvas id="trendChart"></canvas>
        </div>
        ```

*   **Date Filters:**
    *   **Location:** `src/index.html:85-94`
    *   **Code:**
        ```html
        <div id="trendChartDateFilters" class="mt-2" style="display: none;">
            <button class="btn btn-outline-secondary btn-sm" onclick="setChartDateRange('7d')">7D</button>
            <button class="btn btn-outline-secondary btn-sm" onclick="setChartDateRange('30d')">30D</button>
            <button class="btn btn-outline-secondary btn-sm" onclick="setChartDateRange('90d')">90D</button>
            <input type="date" id="chartStartDate" class="form-control-sm">
            <span>to</span>
            <input type="date" id="chartEndDate" class="form-control-sm">
            <button class="btn btn-primary btn-sm" onclick="fetchTrendData()">查詢</button>
        </div>
        ```

## 3. Frontend Logic (Client-Side)

The client-side logic is located in a `<script>` tag within `src/index.html`, starting from line `455`.

*   **`toggleTrendChart()`:**
    *   **Location:** `src/index.html:619`
    *   **Purpose:** Toggles the visibility of the trend chart container (`trendChartContainer`) and the date filters (`trendChartDateFilters`). If the chart is being shown for the first time, it calls `fetchTrendData()` to load the initial data.

*   **`fetchTrendData()`:**
    *   **Location:** `src/index.html:641`
    *   **Purpose:** Retrieves the start and end dates from the input fields, shows a loading indicator, and then uses `google.script.run` to call the server-side function `apiGetTrendData`. On success, it calls `renderTrendChart` with the returned data.

*   **`renderTrendChart(data)`:**
    *   **Location:** `src/index.html:663`
    *   **Purpose:** Uses the Chart.js library to render the line chart on the `<canvas>` element with the ID `trendChart`. It configures the chart's datasets (New, Completed, Pending) and options. It also handles the destruction of any existing chart instance to allow for re-rendering.

*   **`setChartDateRange(period)`:**
    *   **Location:** `src/index.html:699`
    *   **Purpose:** Sets the start and end date inputs based on predefined shortcuts ('7d', '30d', '90d'). It calculates the date range and then automatically calls `fetchTrendData()` to update the chart.

## 4. Backend Logic (Server-Side)

*   **File:** `src/api_web_gui.js`
*   **`apiGetTrendData(startDate, endDate)`:**
    *   **Location:** `src/api_web_gui.js:145`
    *   **Purpose:** This function is the core of the backend logic. It receives the date range, iterates through each day, and calculates the counts for "New", "Completed", and "Pending" tasks for that specific day by filtering the main data sheet. It then returns this aggregated data to the client for rendering.

## 5. Known Issues (To Be Addressed)

*   **Performance Bottleneck:** The current implementation of `apiGetTrendData` is highly inefficient. It iterates day-by-day and filters the entire dataset for each day. This leads to extremely long execution times (often exceeding 15 seconds) when the date range is large (e.g., 90 days), causing the UI to freeze and providing a poor user experience.
*   **Redundant Rendering Requests:** The `setChartDateRange` function immediately triggers `fetchTrendData`. If a user clicks multiple date range buttons quickly, it initiates multiple, overlapping data requests. The current logic does not cancel previous, now-obsolete rendering processes, which can lead to a request pile-up and potentially crash the browser tab.