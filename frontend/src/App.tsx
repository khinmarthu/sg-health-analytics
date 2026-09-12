import { useGetFiltersQuery, useGetRecordsQuery } from "./app/api.js";

// Placeholder only — verifies the RTK Query wiring end-to-end.
// Real UI (filters, table, insight display) is Step 5.
export function App() {
  const filters = useGetFiltersQuery();
  const records = useGetRecordsQuery({ limit: 5, offset: 0 });

  return (
    <div>
      <h1>SG Health Analytics (scaffold check)</h1>
      <section>
        <h2>/api/filters</h2>
        {filters.isLoading && <p>Loading...</p>}
        {filters.error && <p>Error loading filters</p>}
        {filters.data?.success && <pre>{JSON.stringify(filters.data.data, null, 2)}</pre>}
      </section>
      <section>
        <h2>/api/records (first 5)</h2>
        {records.isLoading && <p>Loading...</p>}
        {records.error && <p>Error loading records</p>}
        {records.data?.success && <pre>{JSON.stringify(records.data.data, null, 2)}</pre>}
      </section>
    </div>
  );
}
